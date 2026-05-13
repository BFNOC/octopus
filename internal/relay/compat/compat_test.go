package compat

import (
	"testing"

	"github.com/bestruirui/octopus/internal/transformer/model"
)

func TestNormalizeServiceTier(t *testing.T) {
	tests := []struct {
		name  string
		input *string
		want  *string
	}{
		{"nil", nil, nil},
		{"auto", strPtr("auto"), strPtr("auto")},
		{"default", strPtr("default"), strPtr("default")},
		{"flex", strPtr("flex"), strPtr("flex")},
		{"uppercase AUTO", strPtr("AUTO"), strPtr("auto")},
		{"whitespace", strPtr("  default  "), strPtr("default")},
		{"unknown value", strPtr("priority"), strPtr("default")},
		{"empty string", strPtr(""), strPtr("default")},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeServiceTier(tt.input)
			if tt.want == nil {
				if got != nil {
					t.Errorf("NormalizeServiceTier(%v) = %v, want nil", tt.input, got)
				}
				return
			}
			if got == nil {
				t.Errorf("NormalizeServiceTier(%v) = nil, want %v", tt.input, *tt.want)
				return
			}
			if *got != *tt.want {
				t.Errorf("NormalizeServiceTier(%v) = %v, want %v", tt.input, *got, *tt.want)
			}
		})
	}
}

func TestApplyServiceTierPolicy(t *testing.T) {
	tests := []struct {
		name   string
		tier   *string
		policy ServiceTierPolicy
		want   *string
	}{
		{"pass auto", strPtr("auto"), ServiceTierPolicyPass, strPtr("auto")},
		{"force default", strPtr("auto"), ServiceTierPolicyForceDefault, strPtr("default")},
		{"strip", strPtr("auto"), ServiceTierPolicyStrip, nil},
		{"pass nil", nil, ServiceTierPolicyPass, nil},
		{"force default from nil", nil, ServiceTierPolicyForceDefault, strPtr("default")},
		{"strip nil", nil, ServiceTierPolicyStrip, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ApplyServiceTierPolicy(tt.tier, tt.policy)
			if tt.want == nil {
				if got != nil {
					t.Errorf("ApplyServiceTierPolicy(%v, %d) = %v, want nil", tt.tier, tt.policy, got)
				}
				return
			}
			if got == nil {
				t.Errorf("ApplyServiceTierPolicy(%v, %d) = nil, want %v", tt.tier, tt.policy, *tt.want)
				return
			}
			if *got != *tt.want {
				t.Errorf("ApplyServiceTierPolicy(%v, %d) = %v, want %v", tt.tier, tt.policy, *got, *tt.want)
			}
		})
	}
}

func TestHasWebSearchOnlyTool(t *testing.T) {
	tests := []struct {
		name  string
		tools []model.Tool
		want  bool
	}{
		{"nil tools", nil, false},
		{"empty tools", []model.Tool{}, false},
		{"web search only", []model.Tool{
			{Type: "web_search"},
		}, true},
		{"web search with function", []model.Tool{
			{Type: "web_search"},
			{Type: "function", Function: model.Function{Name: "get_weather"}},
		}, false},
		{"function only", []model.Tool{
			{Type: "function", Function: model.Function{Name: "get_weather"}},
		}, false},
		{"web search preview", []model.Tool{
			{Type: "web_search_preview"},
		}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := HasWebSearchOnlyTool(tt.tools)
			if got != tt.want {
				t.Errorf("HasWebSearchOnlyTool(%v) = %v, want %v", tt.tools, got, tt.want)
			}
		})
	}
}

func TestExtractSearchQuery(t *testing.T) {
	tests := []struct {
		name    string
		request *model.InternalLLMRequest
		want    string
	}{
		{
			"simple message",
			&model.InternalLLMRequest{
				Messages: []model.Message{
					{Role: "user", Content: model.MessageContent{Content: strPtr("What is the weather today?")}},
				},
			},
			"What is the weather today?",
		},
		{
			"last user message",
			&model.InternalLLMRequest{
				Messages: []model.Message{
					{Role: "user", Content: model.MessageContent{Content: strPtr("Hello")}},
					{Role: "assistant", Content: model.MessageContent{Content: strPtr("Hi")}},
					{Role: "user", Content: model.MessageContent{Content: strPtr("Search for latest news")}},
				},
			},
			"Search for latest news",
		},
		{
			"no user messages",
			&model.InternalLLMRequest{
				Messages: []model.Message{
					{Role: "system", Content: model.MessageContent{Content: strPtr("You are helpful")}},
				},
			},
			"",
		},
		{
			"empty messages",
			&model.InternalLLMRequest{},
			"",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ExtractSearchQuery(tt.request)
			if got != tt.want {
				t.Errorf("ExtractSearchQuery() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestValidateResponsesRequest(t *testing.T) {
	tests := []struct {
		name    string
		request *model.InternalLLMRequest
		valid   bool
	}{
		{
			"nil request",
			nil,
			false,
		},
		{
			"empty model",
			&model.InternalLLMRequest{Model: ""},
			false,
		},
		{
			"no messages",
			&model.InternalLLMRequest{Model: "gpt-4"},
			false,
		},
		{
			"valid minimal",
			&model.InternalLLMRequest{
				Model:    "gpt-4",
				Messages: []model.Message{{Role: "user", Content: model.MessageContent{Content: strPtr("hi")}}},
			},
			true,
		},
		{
			"negative max_completion_tokens",
			&model.InternalLLMRequest{
				Model:               "gpt-4",
				Messages:            []model.Message{{Role: "user", Content: model.MessageContent{Content: strPtr("hi")}}},
				MaxCompletionTokens: int64Ptr(-1),
			},
			false,
		},
		{
			"invalid temperature",
			&model.InternalLLMRequest{
				Model:       "gpt-4",
				Messages:    []model.Message{{Role: "user", Content: model.MessageContent{Content: strPtr("hi")}}},
				Temperature: float64Ptr(3.0),
			},
			false,
		},
		{
			"invalid reasoning_effort",
			&model.InternalLLMRequest{
				Model:          "gpt-4",
				Messages:       []model.Message{{Role: "user", Content: model.MessageContent{Content: strPtr("hi")}}},
				ReasoningEffort: "extreme",
			},
			false,
		},
		{
			"valid with reasoning_effort",
			&model.InternalLLMRequest{
				Model:          "gpt-4",
				Messages:       []model.Message{{Role: "user", Content: model.MessageContent{Content: strPtr("hi")}}},
				ReasoningEffort: "high",
			},
			true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ValidateResponsesRequest(tt.request)
			if result.Valid != tt.valid {
				t.Errorf("ValidateResponsesRequest() valid = %v, want %v, reason: %s", result.Valid, tt.valid, result.Reason)
			}
		})
	}
}

func strPtr(s string) *string  { return &s }
func int64Ptr(v int64) *int64  { return &v }
func float64Ptr(v float64) *float64 { return &v }
