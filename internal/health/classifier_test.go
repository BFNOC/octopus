package health

import "testing"

func TestClassifyFailureQuotaExhaustion(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		text       string
		want       FailureKind
	}{
		{
			name:       "new api user quota with 400",
			statusCode: 400,
			text:       `{"error":{"message":"预扣费额度失败, 用户剩余额度: $0.000950, 需要预扣费额度: $0.657850","code":"insufficient_user_quota"}}`,
			want:       FailureHard,
		},
		{
			name:       "quota text wins over 429",
			statusCode: 429,
			text:       `{"code":"insufficient_quota"}`,
			want:       FailureHard,
		},
		{
			name:       "plain rate limit remains soft",
			statusCode: 429,
			text:       "rate_limit_exceeded",
			want:       FailureSoftRateLimit,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ClassifyFailure(tt.statusCode, tt.text); got != tt.want {
				t.Fatalf("ClassifyFailure() = %v, want %v", got, tt.want)
			}
		})
	}
}
