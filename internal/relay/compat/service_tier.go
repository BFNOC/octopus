package compat

import "strings"

// ServiceTierPolicy 控制 service_tier 字段的处理策略
type ServiceTierPolicy int

const (
	// ServiceTierPolicyPass 透传：不修改 service_tier
	ServiceTierPolicyPass ServiceTierPolicy = iota
	// ServiceTierPolicyForceDefault 强制设为 default
	ServiceTierPolicyForceDefault
	// ServiceTierPolicyStrip 移除 service_tier 字段（置 nil）
	ServiceTierPolicyStrip
)

// NormalizeServiceTier 标准化 service_tier 值
// OpenAI 定义的合法值：auto, default, flex
// 其他值统一归为 "default"
func NormalizeServiceTier(tier *string) *string {
	if tier == nil {
		return nil
	}
	normalized := strings.ToLower(strings.TrimSpace(*tier))
	switch normalized {
	case "auto", "default", "flex":
		return &normalized
	default:
		def := "default"
		return &def
	}
}

// ApplyServiceTierPolicy 根据策略处理 service_tier
func ApplyServiceTierPolicy(tier *string, policy ServiceTierPolicy) *string {
	switch policy {
	case ServiceTierPolicyPass:
		return NormalizeServiceTier(tier)
	case ServiceTierPolicyForceDefault:
		def := "default"
		return &def
	case ServiceTierPolicyStrip:
		return nil
	default:
		return NormalizeServiceTier(tier)
	}
}
