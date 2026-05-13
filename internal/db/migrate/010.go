package migrate

import (
	"fmt"

	"gorm.io/gorm"
)

func init() {
	RegisterAfterAutoMigration(Migration{
		Version: 10,
		Up:      migrateChannelFilterModels,
	})
}

// 010:
// - create channel_disabled_models and channel_allowed_models tables
//   承载渠道级别的模型黑名单/白名单，用于精细控制渠道可转发的模型。
func migrateChannelFilterModels(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}

	if !db.Migrator().HasTable("channel_disabled_models") {
		if err := db.Exec(`CREATE TABLE IF NOT EXISTS channel_disabled_models (
			id INTEGER PRIMARY KEY,
			channel_id INTEGER NOT NULL,
			model_name TEXT NOT NULL,
			UNIQUE(channel_id, model_name)
		)`).Error; err != nil {
			return fmt.Errorf("failed to create channel_disabled_models: %w", err)
		}
	}

	if !db.Migrator().HasTable("channel_allowed_models") {
		if err := db.Exec(`CREATE TABLE IF NOT EXISTS channel_allowed_models (
			id INTEGER PRIMARY KEY,
			channel_id INTEGER NOT NULL,
			model_name TEXT NOT NULL,
			UNIQUE(channel_id, model_name)
		)`).Error; err != nil {
			return fmt.Errorf("failed to create channel_allowed_models: %w", err)
		}
	}

	return nil
}
