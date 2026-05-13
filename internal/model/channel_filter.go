package model

// ChannelDisabledModel stores models explicitly disabled for a channel.
type ChannelDisabledModel struct {
	ID        int    `json:"id" gorm:"primaryKey"`
	ChannelID int    `json:"channel_id" gorm:"uniqueIndex:idx_channel_disabled_model"`
	ModelName string `json:"model_name" gorm:"uniqueIndex:idx_channel_disabled_model"`
}

// ChannelAllowedModel stores models explicitly allowed for a channel (when in allow-list mode).
type ChannelAllowedModel struct {
	ID        int    `json:"id" gorm:"primaryKey"`
	ChannelID int    `json:"channel_id" gorm:"uniqueIndex:idx_channel_allowed_model"`
	ModelName string `json:"model_name" gorm:"uniqueIndex:idx_channel_allowed_model"`
}
