package health

import (
	"context"

	"github.com/bestruirui/octopus/internal/op"
)

// ChannelHealthView 单通道健康视图
type ChannelHealthView struct {
	ChannelID   int          `json:"channel_id"`
	ChannelName string       `json:"channel_name"`
	Enabled     bool         `json:"enabled"`
	State       HealthState  `json:"state"`
	Signal      *ChannelHealthSignal `json:"signal,omitempty"`
}

// ChannelHealthSummary 全局通道健康汇总
type ChannelHealthSummary struct {
	Total    int                `json:"total"`
	Active   int                `json:"active"`
	Penalized int              `json:"penalized"`
	Recovering int             `json:"recovering"`
	Quarantined int            `json:"quarantined"`
	Channels []ChannelHealthView `json:"channels"`
}

// ListChannelHealthStates 列出所有通道的健康状态
func ListChannelHealthStates(ctx context.Context) (*ChannelHealthSummary, error) {
	channels, err := op.ChannelList(ctx)
	if err != nil {
		return nil, err
	}

	signals := GetAllSignals()
	views := make([]ChannelHealthView, 0, len(channels))
	summary := &ChannelHealthSummary{Total: len(channels)}

	for _, ch := range channels {
		sig := signals[ch.ID]
		state := DeriveHealthState(HealthInput{
			Signal: sig,
		})

		view := ChannelHealthView{
			ChannelID:   ch.ID,
			ChannelName: ch.Name,
			Enabled:     ch.Enabled,
			State:       state,
			Signal:      sig,
		}
		views = append(views, view)

		switch state {
		case HealthStateActive:
			summary.Active++
		case HealthStatePenalized:
			summary.Penalized++
		case HealthStateRecovering:
			summary.Recovering++
		case HealthStateQuarantined:
			summary.Quarantined++
		}
	}

	summary.Channels = views
	return summary, nil
}

// GetChannelHealthState 获取单通道健康状态
func GetChannelHealthState(channelID int, ctx context.Context) (*ChannelHealthView, error) {
	ch, err := op.ChannelGet(channelID, ctx)
	if err != nil {
		return nil, err
	}

	sig := GetChannelSignal(channelID)
	state := DeriveHealthState(HealthInput{
		Signal: sig,
	})

	return &ChannelHealthView{
		ChannelID:   ch.ID,
		ChannelName: ch.Name,
		Enabled:     ch.Enabled,
		State:       state,
		Signal:      sig,
	}, nil
}
