package model

import "time"

// ModelProbeResult 模型探测结果
type ModelProbeResult struct {
	ID        int       `json:"id" gorm:"primaryKey"`
	ChannelID int       `json:"channel_id" gorm:"index"`
	ModelName string    `json:"model_name" gorm:"index"`
	Status    string    `json:"status"` // supported, unsupported, skipped, inconclusive
	TTFTMs    int       `json:"ttft_ms"`
	HTTPStatus int      `json:"http_status"`
	Error     string    `json:"error,omitempty"`
	ProbedAt  time.Time `json:"probed_at" gorm:"index"`
}
