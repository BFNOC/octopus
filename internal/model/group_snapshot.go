package model

import "time"

// GroupDecisionSnapshot 存储路由决策快照，用于调试和回溯
type GroupDecisionSnapshot struct {
	ID           int       `json:"id" gorm:"primaryKey"`
	GroupID      int       `json:"group_id" gorm:"not null;index:idx_snapshot_group"`
	RequestModel string    `json:"request_model"`
	APIKeyID     int       `json:"api_key_id"`
	Snapshot     string    `json:"snapshot" gorm:"type:text"`
	RefreshedAt  time.Time `json:"refreshed_at"`
}
