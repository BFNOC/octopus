package probe

import "strings"

// Status 常量
const (
	StatusSupported   = "supported"
	StatusUnsupported = "unsupported"
	StatusSkipped     = "skipped"
	StatusInconclusive = "inconclusive"
)

// classifyProbeResult 根据 HTTP 状态码和响应体判断模型探测结果
func classifyProbeResult(statusCode int, body string) string {
	switch {
	case statusCode == 200:
		return StatusSupported
	case statusCode == 404 || (statusCode >= 400 && statusCode < 500 && strings.Contains(strings.ToLower(body), "model not found")):
		return StatusUnsupported
	case statusCode == 401 || statusCode == 403 || statusCode == 429:
		return StatusSkipped
	case statusCode >= 500:
		return StatusInconclusive
	default:
		return StatusInconclusive
	}
}
