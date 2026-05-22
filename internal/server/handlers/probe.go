package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/bestruirui/octopus/internal/helper"
	"github.com/bestruirui/octopus/internal/model"
	"github.com/bestruirui/octopus/internal/op"
	"github.com/bestruirui/octopus/internal/probe"
	"github.com/bestruirui/octopus/internal/server/middleware"
	"github.com/bestruirui/octopus/internal/server/resp"
	"github.com/bestruirui/octopus/internal/server/router"
	"github.com/gin-gonic/gin"
)

func init() {
	router.NewGroupRouter("/api/v1/channel").
		Use(middleware.Auth()).
		AddRoute(
			router.NewRoute("/:id/probe", http.MethodPost).
				Handle(probeChannel),
		).
		AddRoute(
			router.NewRoute("/:id/probe-results", http.MethodGet).
				Handle(getProbeResults),
		).
		AddRoute(
			router.NewRoute("/:id/probe-results", http.MethodDelete).
				Handle(deleteProbeResults),
		)
}

func probeChannel(c *gin.Context) {
	idStr := c.Param("id")
	channelID, err := strconv.Atoi(idStr)
	if err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidParam)
		return
	}

	channel, err := op.ChannelGet(channelID, c.Request.Context())
	if err != nil {
		resp.Error(c, http.StatusNotFound, "channel not found")
		return
	}

	var input struct {
		ModelNames  []string          `json:"model_names"`
		Prompt      string            `json:"prompt"`
		Timeout     int               `json:"timeout"`
		Concurrency int               `json:"concurrency"`
		DelayMs     int               `json:"delay_ms"`
		APIKey      string            `json:"api_key"`
		Headers     map[string]string `json:"headers"`
	}
	if err := c.ShouldBindJSON(&input); err != nil && err.Error() != "EOF" {
		resp.Error(c, http.StatusBadRequest, resp.ErrBadRequest)
		return
	}

	// 确定模型列表：优先用请求传入的，否则用通道全部模型
	var names []string
	if len(input.ModelNames) > 0 {
		names = input.ModelNames
	} else {
		modelNames := channel.Model
		if channel.CustomModel != "" {
			if modelNames != "" {
				modelNames += ","
			}
			modelNames += channel.CustomModel
		}
		if modelNames == "" {
			resp.Error(c, http.StatusBadRequest, "channel has no models configured")
			return
		}
		names = splitModelNames(modelNames)
	}

	// 应用模型黑白名单过滤
	names = filterModelsByChannel(channelID, names)

	if len(names) == 0 {
		resp.Error(c, http.StatusBadRequest, "no valid model names (all filtered out)")
		return
	}

	baseURL := channel.GetBaseUrl()
	if baseURL == "" {
		resp.Error(c, http.StatusBadRequest, "channel has no base url")
		return
	}

	// 选择 API Key
	apiKey := input.APIKey
	if apiKey == "" {
		key := channel.GetChannelKey()
		apiKey = key.ChannelKey
	}
	if apiKey == "" {
		resp.Error(c, http.StatusBadRequest, "no api key available")
		return
	}

	// 解析通道代理 HTTP 客户端
	httpClient, err := helper.ChannelHTTPClientWithContext(c.Request.Context(), channel)
	if err != nil {
		resp.Error(c, http.StatusBadRequest, fmt.Sprintf("failed to resolve channel proxy: %v", err))
		return
	}

	scheduleInput := probe.ScheduleInput{
		ChannelID:   channelID,
		BaseURL:     baseURL,
		APIKey:      apiKey,
		ModelNames:  names,
		Prompt:      input.Prompt,
		Timeout:     input.Timeout,
		Concurrency: input.Concurrency,
		DelayMs:     input.DelayMs,
		Headers:     input.Headers,
		HTTPClient:  httpClient,
	}

	// SSE 流式返回
	if strings.Contains(c.GetHeader("Accept"), "text/event-stream") {
		probeChannelSSE(c, channelID, scheduleInput)
		return
	}

	// 普通 JSON 返回
	result, err := probe.RunSingleChannel(c.Request.Context(), scheduleInput, nil)
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	// 持久化结果
	if len(result.Results) > 0 {
		persistProbeResults(c, channelID, result.Results)
	}

	resp.Success(c, result.Results)
}

func probeChannelSSE(c *gin.Context, channelID int, input probe.ScheduleInput) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		resp.Error(c, http.StatusInternalServerError, "streaming not supported")
		return
	}

	var allResults []probe.ProbeResult

	_, err := probe.RunSingleChannel(c.Request.Context(), input, func(_ int, r probe.ProbeResult) {
		allResults = append(allResults, r)
		data, _ := json.Marshal(r)
		fmt.Fprintf(c.Writer, "data: %s\n\n", data)
		flusher.Flush()
	})

	if err != nil {
		data, _ := json.Marshal(map[string]string{"error": err.Error()})
		fmt.Fprintf(c.Writer, "data: %s\n\n", data)
		flusher.Flush()
	}

	fmt.Fprintf(c.Writer, "data: [DONE]\n\n")
	flusher.Flush()

	// 持久化结果
	if len(allResults) > 0 {
		persistProbeResults(c, channelID, allResults)
	}
}

func persistProbeResults(c *gin.Context, channelID int, results []probe.ProbeResult) {
	dbResults := make([]model.ModelProbeResult, 0, len(results))
	for _, r := range results {
		dbResults = append(dbResults, model.ModelProbeResult{
			ChannelID:  channelID,
			ModelName:  r.ModelName,
			Status:     r.Status,
			TTFTMs:     r.TTFTMs,
			HTTPStatus: r.HTTPStatus,
			Error:      r.Error,
		})
	}
	_ = op.ProbeResultBatchInsert(c.Request.Context(), dbResults)
}

func getProbeResults(c *gin.Context) {
	idStr := c.Param("id")
	channelID, err := strconv.Atoi(idStr)
	if err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidParam)
		return
	}

	results, err := op.ProbeResultList(channelID, c.Request.Context())
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, results)
}

func deleteProbeResults(c *gin.Context) {
	idStr := c.Param("id")
	channelID, err := strconv.Atoi(idStr)
	if err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidParam)
		return
	}

	if err := op.ProbeResultDeleteByChannel(channelID, c.Request.Context()); err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, nil)
}

func splitModelNames(modelStr string) []string {
	parts := strings.Split(modelStr, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}

// filterModelsByChannel 根据通道的模型过滤规则（黑白名单）过滤模型列表
func filterModelsByChannel(channelID int, models []string) []string {
	filtered := make([]string, 0, len(models))
	for _, m := range models {
		if op.IsModelAllowedByChannel(channelID, m) {
			filtered = append(filtered, m)
		}
	}
	return filtered
}
