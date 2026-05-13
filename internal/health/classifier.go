package health

import "strings"

// FailureKind 失败类型枚举
type FailureKind int

const (
	// FailureNone 无失败
	FailureNone FailureKind = iota
	// FailureHard 硬失败：认证错误、权限拒绝、模型不存在等不可恢复的错误
	FailureHard
	// FailureSoftRateLimit 软限流：429/503 等可恢复的限流错误
	FailureSoftRateLimit
	// FailureSoftUpstream 软上游错误：502/504 等上游暂时不可用
	FailureSoftUpstream
)

// ClassifyFailure 根据状态码和错误文本分类失败类型
func ClassifyFailure(statusCode int, errorText string) FailureKind {
	normalized := strings.ToLower(strings.TrimSpace(errorText))

	// 软限流：429 或 503
	if statusCode == 429 || statusCode == 503 {
		return FailureSoftRateLimit
	}

	// 软上游错误：502/504
	if statusCode == 502 || statusCode == 504 {
		return FailureSoftUpstream
	}

	// 硬失败信号（文本匹配）
	hardSignals := []string{
		"invalid_api_key",
		"account_banned",
		"account_suspended",
		"billing",
		"insufficient_quota",
		"permission_denied",
		"token_expired",
		"authentication",
		"unauthorized",
	}
	for _, sig := range hardSignals {
		if strings.Contains(normalized, sig) {
			return FailureHard
		}
	}

	// 基于状态码的硬失败
	switch statusCode {
	case 401, 403:
		return FailureHard
	case 400:
		// 400 可能是客户端错误，不算通道故障
		return FailureNone
	case 0:
		// 连接错误归为软上游
		return FailureSoftUpstream
	}

	// 其他 5xx 归为软上游
	if statusCode >= 500 {
		return FailureSoftUpstream
	}

	return FailureNone
}
