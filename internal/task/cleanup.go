package task

import (
	"context"
	"time"

	"github.com/bestruirui/octopus/internal/db"
	"github.com/bestruirui/octopus/internal/model"
	"github.com/bestruirui/octopus/internal/op"
	"github.com/bestruirui/octopus/internal/utils/log"
)

const TaskCleanupFilters = "cleanup_filters"

func CleanupFiltersTask() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	log.Debugf("cleanup filters task started")
	startTime := time.Now()
	defer func() {
		log.Debugf("cleanup filters task finished, elapsed: %s", time.Since(startTime))
	}()

	// 先清理孤立的过滤条目（渠道已删除但过滤记录残留）
	cleanupOrphanedChannelFilters(ctx)

	// 再刷新所有渠道过滤缓存（从 DB 全量重载，此时 DB 已干净）
	op.RefreshAllChannelFilterCaches(ctx)

	// 刷新所有 APIKey 过滤缓存（逐个失效，下次访问时从 DB 重载）
	var apiKeys []model.APIKey
	if err := db.GetDB().WithContext(ctx).Select("id").Find(&apiKeys).Error; err != nil {
		log.Warnf("failed to list API keys for filter cache refresh: %v", err)
		return
	}
	for _, k := range apiKeys {
		op.InvalidateAPIKeyFilterCache(k.ID)
	}

	log.Debugf("cleanup filters: refreshed %d API key filter caches", len(apiKeys))
}

func cleanupOrphanedChannelFilters(ctx context.Context) {
	// 渠道禁用模型：删除已不存在的渠道的记录
	res := db.GetDB().WithContext(ctx).Exec(
		"DELETE FROM channel_disabled_models WHERE channel_id NOT IN (SELECT id FROM channels)",
	)
	if res.Error != nil {
		log.Warnf("failed to cleanup orphaned channel_disabled_models: %v", res.Error)
	} else if res.RowsAffected > 0 {
		log.Infof("cleanup: removed %d orphaned channel_disabled_models", res.RowsAffected)
	}

	// 渠道允许模型：删除已不存在的渠道的记录
	res = db.GetDB().WithContext(ctx).Exec(
		"DELETE FROM channel_allowed_models WHERE channel_id NOT IN (SELECT id FROM channels)",
	)
	if res.Error != nil {
		log.Warnf("failed to cleanup orphaned channel_allowed_models: %v", res.Error)
	} else if res.RowsAffected > 0 {
		log.Infof("cleanup: removed %d orphaned channel_allowed_models", res.RowsAffected)
	}
}
