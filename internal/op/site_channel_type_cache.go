package op

import (
	"context"
	"sync/atomic"

	"github.com/bestruirui/octopus/internal/db"
	"github.com/bestruirui/octopus/internal/model"
	"github.com/bestruirui/octopus/internal/utils/log"
)

type channelSiteTypeSnapshot struct {
	data map[int]model.SiteType
}

var channelSiteTypeCache atomic.Pointer[channelSiteTypeSnapshot]

func init() {
	channelSiteTypeCache.Store(&channelSiteTypeSnapshot{data: make(map[int]model.SiteType)})
}

func initChannelSiteTypeCache(ctx context.Context) error {
	var bindings []struct {
		ChannelID int
		SiteType  model.SiteType
	}
	if err := db.GetDB().WithContext(ctx).
		Table("site_channel_bindings scb").
		Select("scb.channel_id, s.site_type").
		Joins("JOIN sites s ON s.id = scb.site_id").
		Where("s.archived = ?", false).
		Scan(&bindings).Error; err != nil {
		return err
	}
	snap := &channelSiteTypeSnapshot{data: make(map[int]model.SiteType, len(bindings))}
	for _, b := range bindings {
		snap.data[b.ChannelID] = b.SiteType
	}
	channelSiteTypeCache.Store(snap)
	log.Debugf("channelSiteTypeCache initialized: %d entries", len(bindings))
	return nil
}

func RefreshChannelSiteTypeCache(ctx context.Context) error {
	return initChannelSiteTypeCache(ctx)
}

func isChannelFromPaidSite(channelID int) bool {
	st, ok := channelSiteTypeCache.Load().data[channelID]
	return ok && st == model.SiteTypePaid
}
