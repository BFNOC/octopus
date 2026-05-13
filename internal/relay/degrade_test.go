package relay

import "testing"

func TestShouldDegrade(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		errText    string
		want       DegradeDecision
	}{
		{
			name:       "429 rate limit",
			statusCode: 429,
			errText:    "rate limit exceeded",
			want:       DegradeDecision{ShouldDegrade: true, Signal: "rate_limit"},
		},
		{
			name:       "503 overloaded",
			statusCode: 503,
			errText:    "service unavailable",
			want:       DegradeDecision{ShouldDegrade: true, Signal: "overloaded"},
		},
		{
			name:       "502 upstream error",
			statusCode: 502,
			errText:    "bad gateway",
			want:       DegradeDecision{ShouldDegrade: true, Signal: "upstream_error"},
		},
		{
			name:       "403 forbidden",
			statusCode: 403,
			errText:    "access denied",
			want:       DegradeDecision{ShouldDegrade: true, Signal: "forbidden"},
		},
		{
			name:       "529 overloaded",
			statusCode: 529,
			errText:    "overloaded",
			want:       DegradeDecision{ShouldDegrade: true, Signal: "overloaded"},
		},
		{
			name:       "200 success",
			statusCode: 200,
			errText:    "",
			want:       DegradeDecision{ShouldDegrade: false},
		},
		{
			name:       "400 bad request",
			statusCode: 400,
			errText:    "bad request",
			want:       DegradeDecision{ShouldDegrade: false},
		},
		{
			name:       "forbidden signal in text - account_banned",
			statusCode: 200,
			errText:    "account_banned",
			want:       DegradeDecision{ShouldDegrade: true, Signal: "forbidden"},
		},
		{
			name:       "forbidden signal - insufficient_quota",
			statusCode: 400,
			errText:    "insufficient_quota",
			want:       DegradeDecision{ShouldDegrade: true, Signal: "forbidden"},
		},
		{
			name:       "exclusion - model_not_found suppresses status code degradation",
			statusCode: 403,
			errText:    "model_not_found",
			want:       DegradeDecision{ShouldDegrade: false},
		},
		{
			name:       "exclusion - context_length_exceeded",
			statusCode: 400,
			errText:    "context_length_exceeded",
			want:       DegradeDecision{ShouldDegrade: false},
		},
		{
			name:       "empty error text",
			statusCode: 500,
			errText:    "",
			want:       DegradeDecision{ShouldDegrade: false},
		},
		{
			name:       "forbidden signal case insensitive",
			statusCode: 200,
			errText:    "Invalid_API_Key",
			want:       DegradeDecision{ShouldDegrade: true, Signal: "forbidden"},
		},
		{
			name:       "model_not_found in text but not status exclusion",
			statusCode: 404,
			errText:    "the model_not_found is not available",
			want:       DegradeDecision{ShouldDegrade: false},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ShouldDegrade(tt.statusCode, tt.errText)
			if got.ShouldDegrade != tt.want.ShouldDegrade {
				t.Errorf("ShouldDegrade(%d, %q) = %v, want %v", tt.statusCode, tt.errText, got.ShouldDegrade, tt.want.ShouldDegrade)
			}
			if tt.want.ShouldDegrade && got.Signal != tt.want.Signal {
				t.Errorf("ShouldDegrade(%d, %q) signal = %q, want %q", tt.statusCode, tt.errText, got.Signal, tt.want.Signal)
			}
		})
	}
}
