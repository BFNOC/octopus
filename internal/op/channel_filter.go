package op

import (
	"context"
	"strings"
	"sync"

	"github.com/bestruirui/octopus/internal/db"
	"github.com/bestruirui/octopus/internal/model"
	"github.com/bestruirui/octopus/internal/utils/log"
)

var (
	channelDisabledModels sync.Map // map[int]map[string]struct{}
	channelAllowedModels  sync.Map // map[int]map[string]struct{}
)

// IsModelAllowedByChannel checks whether the given model is allowed by the channel's filter rules.
func IsModelAllowedByChannel(channelID int, modelName string) bool {
	ch, ok := channelCache.Get(channelID)
	if !ok {
		return false
	}

	modelNameLower := strings.ToLower(modelName)

	switch ch.ModelFilterMode {
	case model.ModelFilterModeDenyList:
		disabled := getChannelDisabledModels(channelID)
		_, blocked := disabled[modelNameLower]
		return !blocked
	case model.ModelFilterModeAllowList:
		allowed := getChannelAllowedModels(channelID)
		_, ok := allowed[modelNameLower]
		return ok
	default: // "none"
		return true
	}
}

func getChannelDisabledModels(channelID int) map[string]struct{} {
	if v, ok := channelDisabledModels.Load(channelID); ok {
		return v.(map[string]struct{})
	}
	// cache miss → lazy-load from DB
	RefreshChannelFilterCache(channelID, context.Background())
	if v, ok := channelDisabledModels.Load(channelID); ok {
		return v.(map[string]struct{})
	}
	return map[string]struct{}{} // 空集，不阻止任何模型
}

func getChannelAllowedModels(channelID int) map[string]struct{} {
	if v, ok := channelAllowedModels.Load(channelID); ok {
		return v.(map[string]struct{})
	}
	// cache miss → lazy-load from DB
	RefreshChannelFilterCache(channelID, context.Background())
	if v, ok := channelAllowedModels.Load(channelID); ok {
		return v.(map[string]struct{})
	}
	return map[string]struct{}{} // 空集，allow-list 模式下阻止所有模型
}

// RefreshChannelFilterCache reloads disabled/allowed models for a channel from the database.
func RefreshChannelFilterCache(channelID int, ctx context.Context) {
	var disabled []model.ChannelDisabledModel
	if err := db.GetDB().WithContext(ctx).Where("channel_id = ?", channelID).Find(&disabled).Error; err != nil {
		log.Warnf("failed to load disabled models for channel %d: %v", channelID, err)
	}
	dm := make(map[string]struct{}, len(disabled))
	for _, d := range disabled {
		dm[strings.ToLower(d.ModelName)] = struct{}{}
	}
	channelDisabledModels.Store(channelID, dm)

	var allowed []model.ChannelAllowedModel
	if err := db.GetDB().WithContext(ctx).Where("channel_id = ?", channelID).Find(&allowed).Error; err != nil {
		log.Warnf("failed to load allowed models for channel %d: %v", channelID, err)
	}
	am := make(map[string]struct{}, len(allowed))
	for _, a := range allowed {
		am[strings.ToLower(a.ModelName)] = struct{}{}
	}
	channelAllowedModels.Store(channelID, am)
}

// RefreshAllChannelFilterCaches reloads all channel filter caches.
func RefreshAllChannelFilterCaches(ctx context.Context) {
	var disabled []model.ChannelDisabledModel
	if err := db.GetDB().WithContext(ctx).Find(&disabled).Error; err != nil {
		log.Warnf("failed to load all disabled models: %v", err)
		return
	}
	dm := make(map[int]map[string]struct{})
	for _, d := range disabled {
		if dm[d.ChannelID] == nil {
			dm[d.ChannelID] = make(map[string]struct{})
		}
		dm[d.ChannelID][strings.ToLower(d.ModelName)] = struct{}{}
	}
	for chID, models := range dm {
		channelDisabledModels.Store(chID, models)
	}

	var allowed []model.ChannelAllowedModel
	if err := db.GetDB().WithContext(ctx).Find(&allowed).Error; err != nil {
		log.Warnf("failed to load all allowed models: %v", err)
		return
	}
	am := make(map[int]map[string]struct{})
	for _, a := range allowed {
		if am[a.ChannelID] == nil {
			am[a.ChannelID] = make(map[string]struct{})
		}
		am[a.ChannelID][strings.ToLower(a.ModelName)] = struct{}{}
	}
	for chID, models := range am {
		channelAllowedModels.Store(chID, models)
	}
}

// InvalidateChannelFilterCache removes cached filter data for a channel.
func InvalidateChannelFilterCache(channelID int) {
	channelDisabledModels.Delete(channelID)
	channelAllowedModels.Delete(channelID)
}
