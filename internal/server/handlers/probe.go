package handlers

import (
	"net/http"
	"strconv"
	"strings"

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

	var input struct {
		Timeout     int    `json:"timeout"`
		Concurrency int    `json:"concurrency"`
		APIKey      string `json:"api_key"`
	}
	_ = c.ShouldBindJSON(&input)

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

	// 解析模型名列表
	names := splitModelNames(modelNames)
	if len(names) == 0 {
		resp.Error(c, http.StatusBadRequest, "no valid model names")
		return
	}

	scheduleInput := probe.ScheduleInput{
		ChannelID:   channelID,
		BaseURL:     baseURL,
		APIKey:      apiKey,
		ModelNames:  names,
		Timeout:     input.Timeout,
		Concurrency: input.Concurrency,
	}

	result, err := probe.RunSingleChannel(c.Request.Context(), scheduleInput, nil)
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	// 持久化结果
	if len(result.Results) > 0 {
		dbResults := make([]model.ModelProbeResult, 0, len(result.Results))
		for _, r := range result.Results {
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

	resp.Success(c, result.Results)
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
