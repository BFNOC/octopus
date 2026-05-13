package probe

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ProbeResult 单个模型的探测结果
type ProbeResult struct {
	ModelName  string `json:"model_name"`
	Status     string `json:"status"`
	TTFTMs     int    `json:"ttft_ms"`
	HTTPStatus int    `json:"http_status"`
	Error      string `json:"error,omitempty"`
}

// ProbeInput 探测输入参数
type ProbeInput struct {
	BaseURL     string   `json:"base_url"`
	APIKey      string   `json:"api_key"`
	ModelNames  []string `json:"model_names"`
	Timeout     int      `json:"timeout"`      // 单次请求超时（秒）
	Concurrency int      `json:"concurrency"`  // 并发数
}

// chatRequest 用于构造 OpenAI 兼容的 chat completions 请求
type chatRequest struct {
	Model    string        `json:"model"`
	Messages []chatMessage `json:"messages"`
	Stream   bool          `json:"stream"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// sseChunk SSE 流式响应片段
type sseChunk struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
	} `json:"choices"`
}

// ProbeModels 对一批模型进行流式探测，通过 onResult 回调实时返回结果
func ProbeModels(ctx context.Context, input ProbeInput, onResult func(ProbeResult)) ([]ProbeResult, error) {
	if len(input.ModelNames) == 0 {
		return nil, fmt.Errorf("model_names is empty")
	}
	if input.Timeout <= 0 {
		input.Timeout = 10
	}
	if input.Concurrency <= 0 {
		input.Concurrency = 3
	}

	baseURL := strings.TrimRight(input.BaseURL, "/")
	url := baseURL + "/chat/completions"

	results := make([]ProbeResult, len(input.ModelNames))
	sem := make(chan struct{}, input.Concurrency)

	for i, modelName := range input.ModelNames {
		sem <- struct{}{}
		go func(idx int, model string) {
			defer func() { <-sem }()
			r := probeSingle(ctx, url, input.APIKey, model, input.Timeout)
			results[idx] = r
			if onResult != nil {
				onResult(r)
			}
		}(i, modelName)
	}

	// 等待所有 goroutine 完成
	for i := 0; i < cap(sem); i++ {
		sem <- struct{}{}
	}

	return results, nil
}

// probeSingle 对单个模型发起流式探测
func probeSingle(ctx context.Context, url, apiKey, modelName string, timeoutSec int) ProbeResult {
	start := time.Now()

	reqBody := chatRequest{
		Model: modelName,
		Messages: []chatMessage{
			{Role: "user", Content: "hi"},
		},
		Stream: true,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return ProbeResult{
			ModelName: modelName,
			Status:    StatusInconclusive,
			Error:     fmt.Sprintf("marshal request: %v", err),
		}
	}

	reqCtx, cancel := context.WithTimeout(ctx, time.Duration(timeoutSec)*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return ProbeResult{
			ModelName: modelName,
			Status:    StatusInconclusive,
			Error:     fmt.Sprintf("create request: %v", err),
		}
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return ProbeResult{
			ModelName: modelName,
			Status:    StatusInconclusive,
			Error:     fmt.Sprintf("http request: %v", err),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		status := classifyProbeResult(resp.StatusCode, string(bodyBytes))
		return ProbeResult{
			ModelName:  modelName,
			Status:     status,
			HTTPStatus: resp.StatusCode,
			Error:      strings.TrimSpace(string(bodyBytes)),
		}
	}

	// 解析 SSE 流，寻找 choices[0].delta.content
	ttftMs, err := parseSSEFirstToken(resp.Body)
	if err != nil {
		// 流已收到 200 但解析异常，视为 supported（至少连通）
		return ProbeResult{
			ModelName:  modelName,
			Status:     StatusSupported,
			TTFTMs:     int(time.Since(start).Milliseconds()),
			HTTPStatus: 200,
		}
	}

	elapsed := time.Since(start).Milliseconds()
	if ttftMs > 0 {
		elapsed = int64(ttftMs)
	}

	return ProbeResult{
		ModelName:  modelName,
		Status:     StatusSupported,
		TTFTMs:     int(elapsed),
		HTTPStatus: 200,
	}
}

// parseSSEFirstToken 从 SSE 流中解析第一个 content token 的延迟（毫秒）
func parseSSEFirstToken(body io.Reader) (int, error) {
	start := time.Now()
	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 0, 64*1024), 64*1024)

	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		var chunk sseChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			return int(time.Since(start).Milliseconds()), nil
		}
	}

	return 0, fmt.Errorf("no content token received")
}
