package probe

// 扩展字段 —— 与上游 probe.go 分离，便于合并

// ProbeInput 扩展字段说明:
// - Prompt:    自定义探测 prompt（上游默认 "hi"，此处支持用户自定义）
// - DelayMs:   批次间隔（毫秒），上游无此字段
// - ResponseText: 响应文本，上游无此字段
//
// 这些字段已直接添加到 probe.go 的 ProbeResult/ProbeInput 中，
// 因为它们是纯新增字段，不影响上游结构体布局。
// 如果上游新增同名字段产生冲突，将在此文件中用 wrapper 模式解决。

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
	"unicode/utf8"
)

// probeSingleFull 对单个模型发起流式探测（扩展版：支持自定义 prompt、headers、响应文本提取、代理）
// 与上游 probeSingle 分离，便于合并
func probeSingleFull(ctx context.Context, url, apiKey, modelName, prompt string, timeoutSec int, headers map[string]string, httpClient *http.Client) ProbeResult {
	start := time.Now()

	reqBody := chatRequest{
		Model: modelName,
		Messages: []chatMessage{
			{Role: "user", Content: prompt},
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

	// 应用自定义 header（不覆盖已设置的保留头）
	probeHeaders := headers
	if probeHeaders == nil {
		probeHeaders = DefaultProbeHeaders()
	}
	reservedHeaders := map[string]bool{"Content-Type": true, "Authorization": true}
	for k, v := range probeHeaders {
		if !reservedHeaders[k] {
			req.Header.Set(k, v)
		}
	}

	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	resp, err := httpClient.Do(req)
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
			ModelName:    modelName,
			Status:       status,
			HTTPStatus:   resp.StatusCode,
			Error:        strings.TrimSpace(string(bodyBytes)),
			ResponseText: strings.TrimSpace(string(bodyBytes)),
		}
	}

	// 解析 SSE 流，提取 TTFT 和响应文本
	ttftMs, responseText, err := parseSSEStream(resp.Body)
	if err != nil {
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
		ModelName:    modelName,
		Status:       StatusSupported,
		TTFTMs:       int(elapsed),
		HTTPStatus:   200,
		ResponseText: responseText,
	}
}

// ProbeModelsFull 对一批模型进行流式探测（扩展版：支持自定义 prompt、headers）
// 与上游 ProbeModels 分离，便于合并
func ProbeModelsFull(ctx context.Context, input ProbeInput, onResult func(ProbeResult)) ([]ProbeResult, error) {
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

	prompt := input.Prompt
	if prompt == "" {
		prompt = "hi"
	}

	results := make([]ProbeResult, len(input.ModelNames))
	sem := make(chan struct{}, input.Concurrency)

	for i, modelName := range input.ModelNames {
		sem <- struct{}{}
		go func(idx int, model string) {
			defer func() { <-sem }()
			r := probeSingleFull(ctx, url, input.APIKey, model, prompt, input.Timeout, input.Headers, input.HTTPClient)
			results[idx] = r
			if onResult != nil {
				onResult(r)
			}
		}(i, modelName)

		// 批次间隔：控制探测请求的发送节奏
		if input.DelayMs > 0 && i < len(input.ModelNames)-1 {
			select {
			case <-ctx.Done():
				return results, ctx.Err()
			case <-time.After(time.Duration(input.DelayMs) * time.Millisecond):
			}
		}
	}

	// 等待所有 goroutine 完成
	for i := 0; i < cap(sem); i++ {
		sem <- struct{}{}
	}

	return results, nil
}

// parseSSEStream 从 SSE 流中解析第一个 content token 的延迟和响应文本
func parseSSEStream(body io.Reader) (ttftMs int, responseText string, err error) {
	start := time.Now()
	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 0, 64*1024), 64*1024)
	var firstTokenTime int
	var content strings.Builder

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
			if firstTokenTime == 0 {
				firstTokenTime = int(time.Since(start).Milliseconds())
			}
			content.WriteString(chunk.Choices[0].Delta.Content)
		}
	}
	if err := scanner.Err(); err != nil {
		if firstTokenTime == 0 {
			return 0, "", fmt.Errorf("scan error: %w", err)
		}
		return firstTokenTime, truncateUTF8(content.String(), 500), nil
	}

	if firstTokenTime == 0 {
		return 0, "", fmt.Errorf("no content token received")
	}

	return firstTokenTime, truncateUTF8(content.String(), 500), nil
}

// truncateUTF8 在 UTF-8 字符边界处截断字符串
func truncateUTF8(s string, maxRunes int) string {
	if utf8.RuneCountInString(s) <= maxRunes {
		return s
	}
	runes := []rune(s)
	return string(runes[:maxRunes]) + "..."
}
