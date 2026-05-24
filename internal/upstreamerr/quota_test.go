package upstreamerr

import "testing"

func TestClassifyQuotaExhaustion(t *testing.T) {
	tests := []struct {
		name  string
		text  string
		scope QuotaScope
	}{
		{
			name:  "new api user quota",
			text:  `{"error":{"message":"预扣费额度失败, 用户剩余额度: $0.000950, 需要预扣费额度: $0.657850","type":"new_api_error","code":"insufficient_user_quota"}}`,
			scope: QuotaScopeAccount,
		},
		{
			name:  "openai quota",
			text:  "You exceeded your current quota, please check your plan and billing details.",
			scope: QuotaScopeAccount,
		},
		{
			name:  "generic quota",
			text:  `{"code":"insufficient_quota"}`,
			scope: QuotaScopeKey,
		},
		{
			name:  "rate limit is not quota",
			text:  "rate_limit_exceeded: too many requests",
			scope: QuotaScopeNone,
		},
		{
			name:  "gemini quota rate limit is not balance exhaustion",
			text:  "Quota exceeded for AI Core API: requests per minute limit reached",
			scope: QuotaScopeNone,
		},
		{
			name:  "model missing is not quota",
			text:  "model_not_found",
			scope: QuotaScopeNone,
		},
		{
			name:  "plain quota word is not enough",
			text:  "quota",
			scope: QuotaScopeNone,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ClassifyQuotaExhaustion(tt.text)
			if got.Scope != tt.scope {
				t.Fatalf("scope = %q, want %q (signal=%q)", got.Scope, tt.scope, got.Signal)
			}
		})
	}
}
