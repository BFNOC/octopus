package migrate

import (
	"github.com/bestruirui/octopus/internal/model"
	"gorm.io/gorm"
)

func init() {
	RegisterAfterAutoMigration(Migration{
		Version: 2026052101,
		Up:      migrateSiteType,
	})
}

func migrateSiteType(db *gorm.DB) error {
	if err := db.AutoMigrate(&model.Site{}); err != nil {
		return err
	}
	return db.Model(&model.Site{}).
		Where("site_type IS NULL OR site_type = ''").
		Update("site_type", string(model.SiteTypeFree)).Error
}
