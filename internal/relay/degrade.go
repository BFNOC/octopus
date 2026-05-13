package relay

import "strings"

// DegradeDecision 降级决策结果
type DegradeDecision struct {
	ShouldDegrade bool   `json:"should_degrade"`
	Reason        string `json:"reason,omitempty"`
	Signal        string `json:"signal,omitempty"` // forbidden | rate_limit | overloaded | upstream_error
}

// DegradeMap 状态码 → 降级信号映射
var DegradeMap = map[int]string{
	403: "forbidden",
	429: "rate_limit",
	502: "upstream_error",
	503: "overloaded",
	504: "upstream_error",
	529: "overloaded",
}

// forbiddenBlockSignals 被禁止的响应特征：命中时直接降级，不做重试
var forbiddenBlockSignals = []string{
	"account_banned",
	"account_suspended",
	"billing",
	"insufficient_quota",
	"invalid_api_key",
	"permission_denied",
	"token_expired",
}

// forbiddenExclusions 排除列表：即使匹配到 forbidden 信号也不降级
var forbiddenExclusions = []string{
	"model_not_found",
	"model_not_available",
	"context_length_exceeded",
}

// ShouldDegrade 判断是否应触发自动降级
func ShouldDegrade(statusCode int, errText string) DegradeDecision {
	normalized := strings.ToLower(strings.TrimSpace(errText))

	// 检查排除列表
	for _, exc := range forbiddenExclusions {
		if strings.Contains(normalized, exc) {
			return DegradeDecision{ShouldDegrade: false}
		}
	}

	// 检查禁止信号（无论状态码）
	for _, sig := range forbiddenBlockSignals {
		if strings.Contains(normalized, sig) {
			return DegradeDecision{
				ShouldDegrade: true,
				Reason:        "forbidden signal detected: " + sig,
				Signal:        "forbidden",
			}
		}
	}

	// 基于状态码判断
	if signal, ok := DegradeMap[statusCode]; ok {
		return DegradeDecision{
			ShouldDegrade: true,
			Reason:        "status code indicates degradation",
			Signal:        signal,
		}
	}

	return DegradeDecision{ShouldDegrade: false}
}
