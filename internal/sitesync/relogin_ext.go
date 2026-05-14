package sitesync

import (
	"context"
	"fmt"
	"strings"

	"github.com/bestruirui/octopus/internal/db"
	"github.com/bestruirui/octopus/internal/model"
	"github.com/bestruirui/octopus/internal/utils/log"
)

func isAuthError(err error) bool {
	if err == nil {
		return false
	}
	text := strings.ToLower(strings.TrimSpace(err.Error()))
	if text == "" {
		return false
	}
	return strings.Contains(text, "http 401") ||
		strings.Contains(text, "http 403") ||
		strings.Contains(text, "unauthorized") ||
		strings.Contains(text, "forbidden") ||
		strings.Contains(text, "expired") ||
		strings.Contains(text, "invalid token") ||
		strings.Contains(text, "access token") ||
		strings.Contains(text, "not login") ||
		strings.Contains(text, "not logged")
}

func tryAutoRelogin(ctx context.Context, siteRecord *model.Site, account *model.SiteAccount) (string, error) {
	if account == nil {
		return "", fmt.Errorf("site account is nil")
	}
	if account.CredentialType != model.SiteCredentialTypeUsernamePassword {
		return "", fmt.Errorf("auto-relogin not supported for credential type %s", account.CredentialType)
	}
	if strings.TrimSpace(account.Username) == "" || strings.TrimSpace(account.Password) == "" {
		return "", fmt.Errorf("username and password are required for auto-relogin")
	}

	newToken, err := resolveAnyRouterManagedAccessToken(ctx, siteRecord, account)
	if err != nil {
		return "", fmt.Errorf("auto-relogin failed: %w", err)
	}

	if account.ID > 0 {
		if err := db.GetDB().WithContext(ctx).
			Model(&model.SiteAccount{}).
			Where("id = ?", account.ID).
			Update("access_token", newToken).Error; err != nil {
			return "", fmt.Errorf("failed to persist relogin token: %w", err)
		}
	}

	account.AccessToken = newToken
	log.Infof("auto-relogin succeeded (account=%d)", account.ID)
	return newToken, nil
}
