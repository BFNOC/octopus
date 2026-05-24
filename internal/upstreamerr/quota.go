package upstreamerr

import "strings"

type QuotaScope string

const (
	QuotaScopeNone    QuotaScope = ""
	QuotaScopeKey     QuotaScope = "key"
	QuotaScopeAccount QuotaScope = "account"
)

type QuotaDecision struct {
	Scope  QuotaScope
	Signal string
}

func ClassifyQuotaExhaustion(errorText string) QuotaDecision {
	normalized := strings.ToLower(strings.TrimSpace(errorText))
	if normalized == "" {
		return QuotaDecision{}
	}
	if isTemporaryQuotaRateLimit(normalized) {
		return QuotaDecision{}
	}

	for _, sig := range accountQuotaSignals {
		if strings.Contains(normalized, sig) {
			return QuotaDecision{Scope: QuotaScopeAccount, Signal: sig}
		}
	}
	if strings.Contains(normalized, "billing") {
		for _, sig := range billingQuotaSignals {
			if strings.Contains(normalized, sig) {
				return QuotaDecision{Scope: QuotaScopeAccount, Signal: "billing+" + sig}
			}
		}
	}

	for _, sig := range keyQuotaSignals {
		if strings.Contains(normalized, sig) {
			return QuotaDecision{Scope: QuotaScopeKey, Signal: sig}
		}
	}

	return QuotaDecision{}
}

func IsQuotaExhaustion(errorText string) bool {
	return ClassifyQuotaExhaustion(errorText).Scope != QuotaScopeNone
}

func isTemporaryQuotaRateLimit(normalized string) bool {
	for _, sig := range temporaryQuotaRateLimitSignals {
		if strings.Contains(normalized, sig) {
			return true
		}
	}
	return false
}

var accountQuotaSignals = []string{
	"insufficient_user_quota",
	"user_quota",
	"user quota",
	"account quota",
	"exceeded your current quota",
	"预扣费额度失败",
	"用户剩余额度",
	"剩余额度",
	"需要预扣费额度",
	"账户余额",
	"账号余额",
	"余额不足",
	"余额不够",
	"可用余额不足",
}

var billingQuotaSignals = []string{
	"hard limit",
	"quota",
}

var keyQuotaSignals = []string{
	"insufficient_quota",
	"quota_exceeded",
	"quota exceeded",
	"not enough quota",
	"额度不足",
	"额度不够",
}

var temporaryQuotaRateLimitSignals = []string{
	"rate limit",
	"rate_limit",
	"too many requests",
	"per minute",
	"per day",
	"requests per",
	"queries per",
	"tokens per",
	"rpm",
	"tpm",
	"qpm",
}
