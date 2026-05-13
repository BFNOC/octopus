package compat

import (
	"fmt"
	"strings"

	"github.com/bestruirui/octopus/internal/transformer/model"
)

// PreflightResult 预检结果
type PreflightResult struct {
	Valid  bool   `json:"valid"`
	Reason string `json:"reason,omitempty"`
}

// ValidateResponsesRequest 对 OpenAI Responses API 请求进行预检
// 验证请求参数的合法性，返回预检结果
func ValidateResponsesRequest(request *model.InternalLLMRequest) PreflightResult {
	if request == nil {
		return PreflightResult{Valid: false, Reason: "request is nil"}
	}

	// 检查 model 是否为空
	if strings.TrimSpace(request.Model) == "" {
		return PreflightResult{Valid: false, Reason: "model is required"}
	}

	// Responses API 必须有输入（messages 或 input）
	if len(request.Messages) == 0 && request.EmbeddingInput == nil {
		return PreflightResult{Valid: false, Reason: "no input provided (messages or input required)"}
	}

	// 检查 max_completion_tokens / max_tokens 合法性
	if request.MaxCompletionTokens != nil && *request.MaxCompletionTokens <= 0 {
		return PreflightResult{Valid: false, Reason: fmt.Sprintf("max_completion_tokens must be positive, got %d", *request.MaxCompletionTokens)}
	}
	if request.MaxTokens != nil && *request.MaxTokens <= 0 {
		return PreflightResult{Valid: false, Reason: fmt.Sprintf("max_tokens must be positive, got %d", *request.MaxTokens)}
	}

	// 检查 temperature 范围
	if request.Temperature != nil {
		if *request.Temperature < 0 || *request.Temperature > 2 {
			return PreflightResult{Valid: false, Reason: fmt.Sprintf("temperature must be between 0 and 2, got %f", *request.Temperature)}
		}
	}

	// 检查 top_p 范围
	if request.TopP != nil {
		if *request.TopP < 0 || *request.TopP > 1 {
			return PreflightResult{Valid: false, Reason: fmt.Sprintf("top_p must be between 0 and 1, got %f", *request.TopP)}
		}
	}

	// 检查 reasoning_effort 合法值
	if request.ReasoningEffort != "" {
		effort := strings.ToLower(strings.TrimSpace(request.ReasoningEffort))
		switch effort {
		case "low", "medium", "high", "none":
			// valid
		default:
			return PreflightResult{Valid: false, Reason: fmt.Sprintf("invalid reasoning_effort: %s (must be low/medium/high/none)", request.ReasoningEffort)}
		}
	}

	// 检查 truncation 合法值
	if request.Truncation != nil {
		val := strings.ToLower(strings.TrimSpace(*request.Truncation))
		if val != "auto" && val != "disabled" {
			return PreflightResult{Valid: false, Reason: fmt.Sprintf("invalid truncation: %s (must be auto/disabled)", *request.Truncation)}
		}
	}

	return PreflightResult{Valid: true}
}
