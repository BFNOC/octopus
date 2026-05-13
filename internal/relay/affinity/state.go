package affinity

import (
	"sync"
	"time"

	"github.com/bestruirui/octopus/internal/transformer/outbound"
)

// Clock 抽象时钟，方便测试
type Clock interface {
	Now() time.Time
}

// realClock 系统时钟
type realClock struct{}

func (realClock) Now() time.Time { return time.Now() }

const (
	maxEntries     = 512
	preferredTTL   = 24 * time.Hour
	blockTTL       = 6 * time.Hour
	blockThreshold = 2
)

// affinityState 单个 key 的亲和状态
type affinityState struct {
	mu           sync.Mutex
	Preferred    outbound.OutboundType
	HasPreferred bool
	PreferredAt  time.Time
	Blocked      outbound.OutboundType
	HasBlocked   bool
	BlockedAt    time.Time
	BlockCount   int
}

// AffinityStore 亲和性状态存储
type AffinityStore struct {
	states     sync.Map // key: string -> *affinityState
	clock      Clock
	maxEntries int
}

// NewAffinityStore 创建默认亲和性存储
func NewAffinityStore() *AffinityStore {
	return &AffinityStore{
		clock:      realClock{},
		maxEntries: maxEntries,
	}
}

// NewAffinityStoreWithClock 创建带自定义时钟的亲和性存储（用于测试）
func NewAffinityStoreWithClock(clock Clock) *AffinityStore {
	return &AffinityStore{
		clock:      clock,
		maxEntries: maxEntries,
	}
}

// getState 获取或创建亲和状态
func (s *AffinityStore) getState(key string) *affinityState {
	if v, ok := s.states.Load(key); ok {
		return v.(*affinityState)
	}
	st := &affinityState{}
	actual, _ := s.states.LoadOrStore(key, st)
	return actual.(*affinityState)
}

// ApplyPreference 根据亲和性对候选列表重排序：preferred 放首位，blocked 排除
func (s *AffinityStore) ApplyPreference(key string, candidates []outbound.OutboundType) []outbound.OutboundType {
	if len(candidates) <= 1 {
		return candidates
	}

	v, ok := s.states.Load(key)
	if !ok {
		return candidates
	}
	st := v.(*affinityState)

	st.mu.Lock()
	now := s.clock.Now()

	// 清理过期状态
	preferredValid := st.HasPreferred && now.Sub(st.PreferredAt) < preferredTTL
	blockedValid := st.HasBlocked && now.Sub(st.BlockedAt) < blockTTL

	// 复制需要的值后立即释放锁
	preferred := st.Preferred
	blocked := st.Blocked
	st.mu.Unlock()

	if !preferredValid && !blockedValid {
		return candidates
	}

	// 构建结果：preferred 放首位，跳过 blocked
	result := make([]outbound.OutboundType, 0, len(candidates))

	if preferredValid {
		result = append(result, preferred)
	}

	for _, c := range candidates {
		if preferredValid && c == preferred {
			continue
		}
		if blockedValid && c == blocked {
			continue
		}
		result = append(result, c)
	}

	// 如果 blocked 被过滤后只剩 preferred，保留原列表避免空结果
	if len(result) == 0 {
		return candidates
	}

	return result
}

// RecordSuccess 记录成功，设置 preferred
func (s *AffinityStore) RecordSuccess(key string, endpoint outbound.OutboundType) {
	st := s.getState(key)
	now := s.clock.Now()

	st.mu.Lock()
	defer st.mu.Unlock()

	st.Preferred = endpoint
	st.HasPreferred = true
	st.PreferredAt = now

	// 成功后重置 blocked 计数
	if st.Blocked == endpoint {
		st.BlockCount = 0
		st.HasBlocked = false
		st.BlockedAt = time.Time{}
	}
}

// RecordDowngrade 记录降级：failed 端点失败，recovered 端点恢复
func (s *AffinityStore) RecordDowngrade(key string, failed, recovered outbound.OutboundType) {
	st := s.getState(key)
	now := s.clock.Now()

	st.mu.Lock()
	defer st.mu.Unlock()

	// 如果当前 blocked 端点不同，重置计数
	if st.HasBlocked && st.Blocked != failed {
		st.BlockCount = 0
	}

	st.Blocked = failed
	st.BlockedAt = now
	st.BlockCount++

	// 达到阈值才真正 block
	if st.BlockCount >= blockThreshold {
		st.HasBlocked = true
	}

	// recovered 成为新的 preferred
	if recovered != 0 {
		st.Preferred = recovered
		st.HasPreferred = true
		st.PreferredAt = now
	}
}

// Clear 清除指定 key 的亲和状态
func (s *AffinityStore) Clear(key string) {
	s.states.Delete(key)
}

// Len 返回当前存储条目数
func (s *AffinityStore) Len() int {
	count := 0
	s.states.Range(func(_, _ any) bool {
		count++
		return true
	})
	return count
}
