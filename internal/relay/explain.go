package relay

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/bestruirui/octopus/internal/model"
	"github.com/bestruirui/octopus/internal/op"
	"github.com/bestruirui/octopus/internal/relay/balancer"
	"github.com/bestruirui/octopus/internal/transformer/outbound"
)

// CandidateExplained 描述单个候选通道的评估结果
type CandidateExplained struct {
	ChannelID   int    `json:"channel_id"`
	ChannelName string `json:"channel_name"`
	ModelName   string `json:"model_name"`
	Priority    int    `json:"priority"`
	Weight      int    `json:"weight"`
	Sticky      bool   `json:"sticky"`
	Skipped     bool   `json:"skipped"`
	SkipReason  string `json:"skip_reason,omitempty"`
	Selected    bool   `json:"selected"`
}

// RouteExplanation 路由决策解释
type RouteExplanation struct {
	RequestModel string               `json:"request_model"`
	GroupID      int                  `json:"group_id"`
	GroupName    string               `json:"group_name"`
	GroupMode    model.GroupMode      `json:"group_mode"`
	APIKeyID     int                  `json:"api_key_id"`
	Candidates   []CandidateExplained `json:"candidates"`
	Selected     *CandidateExplained  `json:"selected,omitempty"`
	Error        string               `json:"error,omitempty"`
}

// ExplainSelection 干跑路由引擎：模拟路由决策但不实际发送请求
func ExplainSelection(ctx context.Context, requestModel string, apiKeyID int) (*RouteExplanation, error) {
	group, err := op.GroupGetEnabledMap(requestModel, ctx)
	if err != nil {
		return &RouteExplanation{
			RequestModel: requestModel,
			APIKeyID:     apiKeyID,
			Error:        fmt.Sprintf("model group not found: %v", err),
		}, nil
	}

	explain := &RouteExplanation{
		RequestModel: requestModel,
		GroupID:      group.ID,
		GroupName:    group.Name,
		GroupMode:    group.Mode,
		APIKeyID:     apiKeyID,
	}

	iter := balancer.NewIterator(group, apiKeyID, requestModel)
	if iter.Len() == 0 {
		explain.Error = "no candidates in group"
		return explain, nil
	}

	for iter.Next() {
		item := iter.Item()
		ce := CandidateExplained{
			ChannelID: item.ChannelID,
			ModelName: item.ModelName,
			Priority:  item.Priority,
			Weight:    item.Weight,
			Sticky:    iter.IsSticky(),
		}

		// 获取通道信息
		channel, err := op.ChannelGet(item.ChannelID, ctx)
		if err != nil {
			ce.Skipped = true
			ce.SkipReason = fmt.Sprintf("channel not found: %v", err)
			explain.Candidates = append(explain.Candidates, ce)
			continue
		}
		ce.ChannelName = channel.Name

		// 检查通道是否启用
		if !channel.Enabled {
			ce.Skipped = true
			ce.SkipReason = "channel disabled"
			explain.Candidates = append(explain.Candidates, ce)
			continue
		}

		// 检查出站适配器
		outAdapter := outbound.Get(channel.Type)
		if outAdapter == nil {
			ce.Skipped = true
			ce.SkipReason = fmt.Sprintf("unsupported channel type: %d", channel.Type)
			explain.Candidates = append(explain.Candidates, ce)
			continue
		}

		// 检查熔断状态
		if iter.SkipCircuitBreak(item.ChannelID, 0, channel.Name) {
			ce.Skipped = true
			ce.SkipReason = "circuit breaker tripped"
			explain.Candidates = append(explain.Candidates, ce)
			continue
		}

		// 通道可用，标记为选中
		ce.Selected = true
		explain.Candidates = append(explain.Candidates, ce)
		if explain.Selected == nil {
			selected := ce
			explain.Selected = &selected
			break // 找到第一个可用通道即可
		}
	}

	if explain.Selected == nil && len(explain.Candidates) > 0 {
		explain.Error = "all candidates skipped"
	}

	return explain, nil
}

// SnapshotToJSON 将路由解释序列化为 JSON 字符串用于快照存储
func SnapshotToJSON(explain *RouteExplanation) (string, error) {
	data, err := json.MarshalIndent(explain, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal snapshot: %w", err)
	}
	return string(data), nil
}
