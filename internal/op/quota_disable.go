package op

import (
	"context"
	"fmt"

	"github.com/bestruirui/octopus/internal/db"
	"github.com/bestruirui/octopus/internal/model"
)

func ChannelKeyEnabled(channelID int, keyID int, enabled bool, ctx context.Context) error {
	if channelID <= 0 || keyID <= 0 {
		return fmt.Errorf("invalid channel key")
	}

	result := db.GetDB().WithContext(ctx).
		Model(&model.ChannelKey{}).
		Where("id = ? AND channel_id = ?", keyID, channelID).
		Update("enabled", enabled)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		var existing model.ChannelKey
		if err := db.GetDB().WithContext(ctx).
			Select("id").
			Where("id = ? AND channel_id = ?", keyID, channelID).
			First(&existing).Error; err != nil {
			return err
		}
	}

	cacheUpdated := false
	if ch, ok := channelCache.Get(channelID); ok {
		keys := make([]model.ChannelKey, len(ch.Keys))
		copy(keys, ch.Keys)
		for i := range keys {
			if keys[i].ID != keyID {
				continue
			}
			keys[i].Enabled = enabled
			channelKeyCache.Set(keyID, keys[i])
			cacheUpdated = true
			break
		}
		if cacheUpdated {
			ch.Keys = keys
			normalizeChannelProxyFields(&ch)
			channelCache.Set(channelID, ch)
		}
	}
	if !cacheUpdated {
		if err := channelRefreshCacheByID(channelID, ctx); err != nil {
			return err
		}
	}

	resetBalancerStateForChannel(channelID)
	return nil
}

func SiteTokenEnabledForProjectedChannelKey(channelID int, keyID int, enabled bool, ctx context.Context) (bool, *model.SiteChannelBinding, error) {
	binding, managed, err := ChannelManagedBinding(channelID, ctx)
	if err != nil || !managed {
		return false, binding, err
	}

	key, err := channelKeyByID(channelID, keyID, ctx)
	if err != nil {
		return false, binding, err
	}
	comparableKey := model.NormalizeComparableSiteTokenValue(key.ChannelKey)
	if comparableKey == "" {
		return false, binding, nil
	}
	baseGroupKey, _ := model.ParseSiteChannelBindingKey(binding.GroupKey)
	baseGroupKey = model.NormalizeSiteGroupKey(baseGroupKey)

	var tokens []model.SiteToken
	if err := db.GetDB().WithContext(ctx).
		Where("site_account_id = ?", binding.SiteAccountID).
		Find(&tokens).Error; err != nil {
		return false, binding, err
	}

	tokenIDs := make([]int, 0, 1)
	for _, token := range tokens {
		if model.NormalizeSiteGroupKey(token.GroupKey) != baseGroupKey {
			continue
		}
		if model.NormalizeComparableSiteTokenValue(token.Token) != comparableKey {
			continue
		}
		tokenIDs = append(tokenIDs, token.ID)
	}
	if len(tokenIDs) == 0 {
		return false, binding, nil
	}

	if err := db.GetDB().WithContext(ctx).
		Model(&model.SiteToken{}).
		Where("id IN ?", tokenIDs).
		Update("enabled", enabled).Error; err != nil {
		return false, binding, err
	}
	if err := channelRefreshCacheByID(channelID, ctx); err != nil {
		return false, binding, err
	}
	resetBalancerStateForChannel(channelID)
	return true, binding, nil
}

func channelKeyByID(channelID int, keyID int, ctx context.Context) (model.ChannelKey, error) {
	if ch, ok := channelCache.Get(channelID); ok {
		for _, key := range ch.Keys {
			if key.ID == keyID {
				return key, nil
			}
		}
	}

	var key model.ChannelKey
	if err := db.GetDB().WithContext(ctx).
		Where("id = ? AND channel_id = ?", keyID, channelID).
		First(&key).Error; err != nil {
		return model.ChannelKey{}, err
	}
	return key, nil
}
