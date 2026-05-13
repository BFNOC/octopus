package health

import "time"

// HealthState 通道健康状态
type HealthState string

const (
	// HealthStateActive 活跃：正常服务
	HealthStateActive HealthState = "active"
	// HealthStatePenalized 受罚：因失败被降权
	HealthStatePenalized HealthState = "penalized"
	// HealthStateRecovering 恢复中：从惩罚状态逐步恢复
	HealthStateRecovering HealthState = "recovering"
	// HealthStateQuarantined 隔离：严重故障，暂时不可用
	HealthStateQuarantined HealthState = "quarantined"
)

// HealthInput 用于推导健康状态的输入
type HealthInput struct {
	Signal         *ChannelHealthSignal // 当前信号（可为 nil）
	TotalRequests  int                  // 总请求数
	RecentFailures int                  // 近期失败数
}

// DeriveHealthState 根据输入推导通道健康状态
func DeriveHealthState(input HealthInput) HealthState {
	// 无信号 = 活跃
	if input.Signal == nil {
		return HealthStateActive
	}

	sig := input.Signal

	// 硬失败：直接隔离
	if sig.FailureKind == FailureHard {
		return HealthStateQuarantined
	}

	// 软限流失败
	if sig.FailureKind == FailureSoftRateLimit {
		if sig.Count >= 10 {
			return HealthStateQuarantined
		}
		if sig.Count >= 3 {
			return HealthStatePenalized
		}
		return HealthStateRecovering
	}

	// 软上游错误
	if sig.FailureKind == FailureSoftUpstream {
		if sig.Count >= 5 {
			return HealthStateQuarantined
		}
		if sig.Count >= 2 {
			return HealthStatePenalized
		}
		return HealthStateRecovering
	}

	// 基于失败率判断（有总请求数时）
	if input.TotalRequests > 0 {
		failureRate := float64(input.RecentFailures) / float64(input.TotalRequests)
		if failureRate >= 0.8 {
			return HealthStateQuarantined
		}
		if failureRate >= 0.5 {
			return HealthStatePenalized
		}
		if failureRate >= 0.2 {
			return HealthStateRecovering
		}
	}

	// 信号距今超过 5 分钟视为恢复中
	if time.Since(sig.Timestamp) > 5*time.Minute {
		return HealthStateRecovering
	}

	return HealthStateActive
}
