package handlers

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/bestruirui/octopus/internal/model"
	"github.com/bestruirui/octopus/internal/op"
	"github.com/bestruirui/octopus/internal/server/middleware"
	"github.com/bestruirui/octopus/internal/transformer/outbound"
	"github.com/bestruirui/octopus/internal/server/resp"
	"github.com/bestruirui/octopus/internal/server/router"
	"github.com/bestruirui/octopus/internal/utils/xstrings"
	"github.com/gin-gonic/gin"
)

func init() {
	router.NewGroupRouter("/api/v1/test").
		Use(middleware.Auth()).
		Use(middleware.RequireJSON()).
		AddRoute(
			router.NewRoute("/chat", http.MethodPost).
				Handle(testChat),
		)
}

type testChatRequest struct {
	Model       string        `json:"model" binding:"required"`
	Protocol    string        `json:"protocol"` // openai-chat (default), anthropic, gemini, volcengine
	Messages    []testMessage `json:"messages" binding:"required,min=1"`
	Temperature *float64      `json:"temperature,omitempty"`
	MaxTokens   *int          `json:"max_tokens,omitempty"`
	Stream      bool          `json:"stream"`
}

type testMessage struct {
	Role    string `json:"role" binding:"required"`
	Content string `json:"content"`
}

type channelMatch struct {
	baseURL  string
	key      string
	protocol string
}

func testChat(c *gin.Context) {
	var req testChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrBadRequest)
		return
	}

	ctx := c.Request.Context()
	channels, err := op.ChannelList(ctx)
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, resp.ErrInternalServer)
		return
	}

	// 协议：优先用请求指定的，否则用通道类型推断
	protocol := normalizeProtocol(req.Protocol)

	var target *channelMatch
	for i := range channels {
		ch := &channels[i]
		if !ch.Enabled {
			continue
		}
		if !channelHasModel(ch, req.Model) {
			continue
		}
		baseURL := ch.GetBaseUrl()
		key := ch.GetChannelKey()
		if baseURL == "" || key.ChannelKey == "" {
			continue
		}
		// 如果请求没有指定协议，从通道类型推断
		chProtocol := protocol
		if req.Protocol == "" {
			chProtocol = protocolFromChannelType(ch.Type)
		}
		target = &channelMatch{baseURL: baseURL, key: key.ChannelKey, protocol: chProtocol}
		break
	}

	if target == nil {
		resp.Error(c, http.StatusBadRequest, fmt.Sprintf("no enabled channel found for model: %s", req.Model))
		return
	}

	endpoint, headers, bodyBytes, err := buildProtocolRequest(target.protocol, target.baseURL, target.key, req)
	if err != nil {
		resp.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, resp.ErrInternalServer)
		return
	}
	for k, v := range headers {
		httpReq.Header.Set(k, v)
	}

	client := &http.Client{Timeout: 300 * time.Second}
	httpResp, err := client.Do(httpReq)
	if err != nil {
		resp.Error(c, http.StatusBadGateway, fmt.Sprintf("upstream request failed: %v", err))
		return
	}
	defer httpResp.Body.Close()

	if httpResp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(io.LimitReader(httpResp.Body, 4096))
		resp.Error(c, httpResp.StatusCode, fmt.Sprintf("upstream error: %s", string(errBody)))
		return
	}

	if req.Stream {
		forwardSSE(c, httpResp.Body)
	} else {
		forwardJSON(c, httpResp.Body)
	}
}

// ─── Protocol helpers ──────────────────────────────────────────────────────

func normalizeProtocol(p string) string {
	switch strings.ToLower(strings.TrimSpace(p)) {
	case "anthropic", "claude":
		return "anthropic"
	case "gemini", "google":
		return "gemini"
	case "volcengine", "volc":
		return "volcengine"
	default:
		return "openai-chat"
	}
}

func protocolFromChannelType(chType outbound.OutboundType) string {
	switch chType {
	case outbound.OutboundTypeAnthropic:
		return "anthropic"
	case outbound.OutboundTypeGemini:
		return "gemini"
	case outbound.OutboundTypeVolcengine:
		return "volcengine"
	default:
		return "openai-chat"
	}
}

func buildProtocolRequest(protocol, baseURL, apiKey string, req testChatRequest) (endpoint string, headers map[string]string, body []byte, err error) {
	baseURL = strings.TrimRight(baseURL, "/")
	headers = map[string]string{"Content-Type": "application/json"}

	switch protocol {
	case "anthropic":
		return buildAnthropicRequest(baseURL, apiKey, req)
	case "gemini":
		return buildGeminiRequest(baseURL, apiKey, req)
	case "volcengine":
		return buildVolcengineRequest(baseURL, apiKey, req)
	default:
		return buildOpenAIChatRequest(baseURL, apiKey, req)
	}
}

func buildOpenAIChatRequest(baseURL, apiKey string, req testChatRequest) (string, map[string]string, []byte, error) {
	messages := make([]map[string]string, 0, len(req.Messages))
	for _, m := range req.Messages {
		messages = append(messages, map[string]string{"role": m.Role, "content": m.Content})
	}
	body := map[string]any{
		"model":    req.Model,
		"messages": messages,
		"stream":   req.Stream,
	}
	if req.Temperature != nil {
		body["temperature"] = *req.Temperature
	}
	if req.MaxTokens != nil {
		body["max_tokens"] = *req.MaxTokens
	}
	b, err := json.Marshal(body)
	if err != nil {
		return "", nil, nil, err
	}
	headers := map[string]string{
		"Content-Type":  "application/json",
		"Authorization": "Bearer " + apiKey,
	}
	return baseURL + "/chat/completions", headers, b, nil
}

func buildAnthropicRequest(baseURL, apiKey string, req testChatRequest) (string, map[string]string, []byte, error) {
	// Anthropic 格式: messages 里 user/assistant 交替，system 单独提取
	var system string
	messages := make([]map[string]any, 0, len(req.Messages))
	for _, m := range req.Messages {
		if m.Role == "system" {
			system = m.Content
			continue
		}
		messages = append(messages, map[string]any{"role": m.Role, "content": m.Content})
	}
	if len(messages) == 0 {
		return "", nil, nil, fmt.Errorf("anthropic requires at least one user/assistant message")
	}
	body := map[string]any{
		"model":      req.Model,
		"messages":   messages,
		"max_tokens": 1024,
		"stream":     req.Stream,
	}
	if system != "" {
		body["system"] = system
	}
	if req.Temperature != nil {
		body["temperature"] = *req.Temperature
	}
	if req.MaxTokens != nil {
		body["max_tokens"] = *req.MaxTokens
	}
	b, err := json.Marshal(body)
	if err != nil {
		return "", nil, nil, err
	}
	headers := map[string]string{
		"Content-Type":     "application/json",
		"X-API-Key":        apiKey,
		"Anthropic-Version": "2023-06-01",
	}
	return baseURL + "/messages", headers, b, nil
}

func buildGeminiRequest(baseURL, apiKey string, req testChatRequest) (string, map[string]string, []byte, error) {
	// Gemini 格式: contents 数组，role 为 user/model
	contents := make([]map[string]any, 0, len(req.Messages))
	for _, m := range req.Messages {
		role := "user"
		if m.Role == "assistant" {
			role = "model"
		}
		// system 消息跳过（Gemini 用 systemInstruction 字段，这里简化处理）
		if m.Role == "system" {
			continue
		}
		contents = append(contents, map[string]any{
			"role": role,
			"parts": []map[string]string{{"text": m.Content}},
		})
	}
	if len(contents) == 0 {
		return "", nil, nil, fmt.Errorf("gemini requires at least one user message")
	}
	body := map[string]any{
		"contents": contents,
	}
	if req.Temperature != nil || req.MaxTokens != nil {
		genConfig := map[string]any{}
		if req.Temperature != nil {
			genConfig["temperature"] = *req.Temperature
		}
		if req.MaxTokens != nil {
			genConfig["maxOutputTokens"] = *req.MaxTokens
		}
		body["generationConfig"] = genConfig
	}
	b, err := json.Marshal(body)
	if err != nil {
		return "", nil, nil, err
	}
	// Gemini URL: /v1beta/models/{model}:streamGenerateContent?alt=sse
	method := "generateContent"
	if req.Stream {
		method = "streamGenerateContent"
	}
	endpoint := fmt.Sprintf("%s/v1beta/models/%s:%s", baseURL, req.Model, method)
	if req.Stream {
		endpoint += "?alt=sse"
	}
	headers := map[string]string{
		"Content-Type": "application/json",
		"x-goog-api-key": apiKey,
	}
	return endpoint, headers, b, nil
}

func buildVolcengineRequest(baseURL, apiKey string, req testChatRequest) (string, map[string]string, []byte, error) {
	// Volcengine 使用 OpenAI 兼容格式
	return buildOpenAIChatRequest(baseURL, apiKey, req)
}

// ─── Channel / Model helpers ───────────────────────────────────────────────

func channelHasModel(ch *model.Channel, target string) bool {
	for _, m := range xstrings.SplitTrimCompact(",", ch.Model, ch.CustomModel) {
		if m == target {
			return true
		}
	}
	return false
}

func forwardSSE(c *gin.Context, body io.Reader) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
	c.Status(http.StatusOK)

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		return
	}

	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 0, 256*1024), 256*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if _, err := fmt.Fprintf(c.Writer, "%s\n", line); err != nil {
			break
		}
		if line == "" {
			flusher.Flush()
		}
	}
}

func forwardJSON(c *gin.Context, body io.Reader) {
	bodyBytes, err := io.ReadAll(io.LimitReader(body, 10*1024*1024))
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, resp.ErrInternalServer)
		return
	}
	c.Data(http.StatusOK, "application/json", bodyBytes)
}
