package relay

import (
	"context"
	"fmt"

	dbmodel "github.com/bestruirui/octopus/internal/model"
	"github.com/bestruirui/octopus/internal/op"
	"github.com/bestruirui/octopus/internal/sitesync"
	"github.com/bestruirui/octopus/internal/upstreamerr"
	"github.com/bestruirui/octopus/internal/utils/log"
)

const quotaExhaustedPublicMessage = "上游额度不足或余额不足，已自动禁用相关站点账号或密钥"

type quotaAutoDisableResult struct {
	Triggered           bool
	Scope               upstreamerr.QuotaScope
	Signal              string
	KeyDisabled         bool
	SourceTokenDisabled bool
	AccountDisabled     bool
}

func maybeAutoDisableQuotaExhausted(ctx context.Context, channel *dbmodel.Channel, usedKey dbmodel.ChannelKey, statusCode int, err error) quotaAutoDisableResult {
	decision := upstreamerr.ClassifyQuotaExhaustion(fmt.Sprintf("%v", err))
	if decision.Scope == upstreamerr.QuotaScopeNone {
		return quotaAutoDisableResult{}
	}

	result := quotaAutoDisableResult{Triggered: true, Scope: decision.Scope, Signal: decision.Signal}
	if channel == nil || channel.ID <= 0 || usedKey.ID <= 0 {
		log.Warnf("quota exhaustion detected but channel/key is invalid (status=%d, signal=%s)", statusCode, decision.Signal)
		return result
	}

	if disableErr := op.ChannelKeyEnabled(channel.ID, usedKey.ID, false, ctx); disableErr != nil {
		log.Warnf("failed to disable quota exhausted channel key (channel=%d, key=%d, status=%d, signal=%s): %v",
			channel.ID, usedKey.ID, statusCode, decision.Signal, disableErr)
	} else {
		result.KeyDisabled = true
	}

	switch decision.Scope {
	case upstreamerr.QuotaScopeAccount:
		if disableManagedQuotaAccount(ctx, channel.ID, statusCode, decision.Signal, &result) {
			return result
		}
	case upstreamerr.QuotaScopeKey:
		if disableManagedQuotaToken(ctx, channel.ID, usedKey.ID, statusCode, decision.Signal, &result) {
			return result
		}
	}

	log.Warnf("quota exhaustion handled at channel key scope (channel=%d, key=%d, status=%d, signal=%s)",
		channel.ID, usedKey.ID, statusCode, decision.Signal)
	return result
}

func disableManagedQuotaAccount(ctx context.Context, channelID int, statusCode int, signal string, result *quotaAutoDisableResult) bool {
	binding, managed, err := op.ChannelManagedBinding(channelID, ctx)
	if err != nil {
		log.Warnf("failed to inspect managed binding for quota exhausted channel %d: %v", channelID, err)
		return false
	}
	if !managed || binding == nil {
		return false
	}

	if err := op.SiteAccountEnabled(binding.SiteAccountID, false, ctx); err != nil {
		log.Warnf("failed to disable quota exhausted site account (account=%d, channel=%d, status=%d, signal=%s): %v",
			binding.SiteAccountID, channelID, statusCode, signal, err)
		return false
	}
	result.AccountDisabled = true
	projectManagedQuotaAccount(ctx, binding.SiteAccountID, signal)
	log.Warnf("quota exhaustion disabled site account (site=%d, account=%d, channel=%d, status=%d, signal=%s)",
		binding.SiteID, binding.SiteAccountID, channelID, statusCode, signal)
	return true
}

func disableManagedQuotaToken(ctx context.Context, channelID int, keyID int, statusCode int, signal string, result *quotaAutoDisableResult) bool {
	disabled, binding, err := op.SiteTokenEnabledForProjectedChannelKey(channelID, keyID, false, ctx)
	if err != nil {
		log.Warnf("failed to disable quota exhausted source token (channel=%d, key=%d, status=%d, signal=%s): %v",
			channelID, keyID, statusCode, signal, err)
		return false
	}
	if !disabled || binding == nil {
		return false
	}

	result.SourceTokenDisabled = true
	projectManagedQuotaAccount(ctx, binding.SiteAccountID, signal)
	log.Warnf("quota exhaustion disabled source token (site=%d, account=%d, channel=%d, key=%d, status=%d, signal=%s)",
		binding.SiteID, binding.SiteAccountID, channelID, keyID, statusCode, signal)
	return true
}

func projectManagedQuotaAccount(ctx context.Context, accountID int, signal string) {
	channelIDs, err := sitesync.ProjectAccount(ctx, accountID)
	if err != nil {
		log.Warnf("failed to project quota disabled site account %d (signal=%s): %v", accountID, signal, err)
		return
	}
	log.Infof("projected quota disabled site account %d, affected channels=%v", accountID, channelIDs)
}

func quotaFailurePublicMessage(err error) string {
	if upstreamerr.IsQuotaExhaustion(fmt.Sprintf("%v", err)) {
		return quotaExhaustedPublicMessage
	}
	return "channel failed"
}
