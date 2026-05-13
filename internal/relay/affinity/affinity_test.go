package affinity

import (
	"testing"
	"time"

	"github.com/bestruirui/octopus/internal/transformer/outbound"
)

// mockClock 可控时钟
type mockClock struct {
	now time.Time
}

func (m *mockClock) Now() time.Time { return m.now }
func (m *mockClock) Advance(d time.Duration) { m.now = m.now.Add(d) }

func newTestStore() (*AffinityStore, *mockClock) {
	clock := &mockClock{now: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)}
	store := NewAffinityStoreWithClock(clock)
	return store, clock
}

func TestApplyPreference_NoState(t *testing.T) {
	store, _ := newTestStore()
	candidates := []outbound.OutboundType{
		outbound.OutboundTypeOpenAIChat,
		outbound.OutboundTypeAnthropic,
		outbound.OutboundTypeGemini,
	}

	result := store.ApplyPreference("key1", candidates)
	if len(result) != 3 {
		t.Fatalf("expected 3 candidates, got %d", len(result))
	}
	// 无状态时顺序不变
	for i, c := range candidates {
		if result[i] != c {
			t.Fatalf("expected candidate[%d] = %d, got %d", i, c, result[i])
		}
	}
}

func TestApplyPreference_PreferredFirst(t *testing.T) {
	store, _ := newTestStore()
	candidates := []outbound.OutboundType{
		outbound.OutboundTypeOpenAIChat,
		outbound.OutboundTypeAnthropic,
		outbound.OutboundTypeGemini,
	}

	store.RecordSuccess("key1", outbound.OutboundTypeAnthropic)

	result := store.ApplyPreference("key1", candidates)
	if len(result) == 0 {
		t.Fatal("expected non-empty result")
	}
	if result[0] != outbound.OutboundTypeAnthropic {
		t.Fatalf("expected preferred Anthropic first, got %d", result[0])
	}
}

func TestApplyPreference_BlockedExcluded(t *testing.T) {
	store, clock := newTestStore()
	candidates := []outbound.OutboundType{
		outbound.OutboundTypeOpenAIChat,
		outbound.OutboundTypeAnthropic,
		outbound.OutboundTypeGemini,
	}

	// 触发 block
	store.RecordDowngrade("key1", outbound.OutboundTypeOpenAIChat, outbound.OutboundTypeAnthropic)
	store.RecordDowngrade("key1", outbound.OutboundTypeOpenAIChat, outbound.OutboundTypeAnthropic)

	result := store.ApplyPreference("key1", candidates)
	for _, r := range result {
		if r == outbound.OutboundTypeOpenAIChat {
			t.Fatal("blocked OpenAI should be excluded")
		}
	}
	if result[0] != outbound.OutboundTypeAnthropic {
		t.Fatalf("expected preferred Anthropic first, got %d", result[0])
	}

	_ = clock
}

func TestApplyPreference_BlockedExpired(t *testing.T) {
	store, clock := newTestStore()
	candidates := []outbound.OutboundType{
		outbound.OutboundTypeOpenAIChat,
		outbound.OutboundTypeAnthropic,
		outbound.OutboundTypeGemini,
	}

	// 触发 block
	store.RecordDowngrade("key1", outbound.OutboundTypeOpenAIChat, outbound.OutboundTypeAnthropic)
	store.RecordDowngrade("key1", outbound.OutboundTypeOpenAIChat, outbound.OutboundTypeAnthropic)

	// 推进时间超过 blockTTL
	clock.Advance(blockTTL + time.Hour)

	result := store.ApplyPreference("key1", candidates)
	// block 过期后不应排除
	found := false
	for _, r := range result {
		if r == outbound.OutboundTypeOpenAIChat {
			found = true
		}
	}
	if !found {
		t.Fatal("expired block should not exclude candidate")
	}
}

func TestApplyPreference_PreferredExpired(t *testing.T) {
	store, clock := newTestStore()
	candidates := []outbound.OutboundType{
		outbound.OutboundTypeOpenAIChat,
		outbound.OutboundTypeAnthropic,
		outbound.OutboundTypeGemini,
	}

	store.RecordSuccess("key1", outbound.OutboundTypeAnthropic)

	// 推进时间超过 preferredTTL
	clock.Advance(preferredTTL + time.Hour)

	result := store.ApplyPreference("key1", candidates)
	// preferred 过期后顺序应恢复原始
	if result[0] != outbound.OutboundTypeOpenAIChat {
		t.Fatalf("expected original order after preferred expired, got %d", result[0])
	}
}

func TestRecordSuccess_ResetsBlock(t *testing.T) {
	store, _ := newTestStore()

	store.RecordDowngrade("key1", outbound.OutboundTypeOpenAIChat, outbound.OutboundTypeAnthropic)
	store.RecordDowngrade("key1", outbound.OutboundTypeOpenAIChat, outbound.OutboundTypeAnthropic)

	// 成功后应重置 block
	store.RecordSuccess("key1", outbound.OutboundTypeOpenAIChat)

	st := store.getState("key1")
	if st.HasBlocked {
		t.Fatalf("expected block reset, but HasBlocked=true")
	}
	if st.Preferred != outbound.OutboundTypeOpenAIChat {
		t.Fatalf("expected preferred=OpenAI, got %d", st.Preferred)
	}
}

func TestApplyPreference_SingleCandidate(t *testing.T) {
	store, _ := newTestStore()
	candidates := []outbound.OutboundType{outbound.OutboundTypeOpenAIChat}

	store.RecordSuccess("key1", outbound.OutboundTypeAnthropic)

	result := store.ApplyPreference("key1", candidates)
	if len(result) != 1 {
		t.Fatalf("expected 1 candidate, got %d", len(result))
	}
}

func TestApplyPreference_EmptyCandidates(t *testing.T) {
	store, _ := newTestStore()

	result := store.ApplyPreference("key1", nil)
	if len(result) != 0 {
		t.Fatalf("expected 0 candidates, got %d", len(result))
	}
}

func TestRecordDowngrade_ThresholdNotReached(t *testing.T) {
	store, _ := newTestStore()

	store.RecordDowngrade("key1", outbound.OutboundTypeOpenAIChat, outbound.OutboundTypeAnthropic)

	candidates := []outbound.OutboundType{
		outbound.OutboundTypeOpenAIChat,
		outbound.OutboundTypeAnthropic,
	}

	result := store.ApplyPreference("key1", candidates)
	// 未达阈值不应排除
	found := false
	for _, r := range result {
		if r == outbound.OutboundTypeOpenAIChat {
			found = true
		}
	}
	if !found {
		t.Fatal("below threshold should not exclude candidate")
	}
}

func TestClear(t *testing.T) {
	store, _ := newTestStore()

	store.RecordSuccess("key1", outbound.OutboundTypeAnthropic)
	store.Clear("key1")

	if store.Len() != 0 {
		t.Fatalf("expected 0 entries after clear, got %d", store.Len())
	}
}

func TestLen(t *testing.T) {
	store, _ := newTestStore()

	store.RecordSuccess("key1", outbound.OutboundTypeAnthropic)
	store.RecordSuccess("key2", outbound.OutboundTypeOpenAIChat)

	if store.Len() != 2 {
		t.Fatalf("expected 2 entries, got %d", store.Len())
	}
}
