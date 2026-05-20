# relay/balancer/

> 导航：[根目录](../../../CLAUDE.md) > [internal](../../) > [relay](../) > **balancer**

## 职责

通道（channel）级负载均衡 + 熔断器 + 会话亲和性 + 决策追踪。本包提供四种均衡策略与一个独立熔断器，配合统一迭代器 `Iterator` 编排：策略排序 → 粘性通道提前 → 熔断检查 → 计时追踪。

包内三个全局状态：

- `roundRobinCounter` (atomic uint64) — RoundRobin 共享游标
- `globalBreaker` (sync.Map) — `channelID:keyID:modelName` → `*circuitEntry`
- `globalSession` (sync.Map) — `apiKeyID:requestModel` → `*SessionEntry`

均通过 `init()` 注册到 `op.RegisterRelayBalancerStateReset`，使得通道删除/更新可触发 `ResetStateByChannel` 清理。

## 入口与公开接口

| 标识 | 类型 | 作用 |
|------|------|------|
| `Balancer` | interface | `Candidates([]GroupItem) []GroupItem`，按策略排序候选 |
| `GetBalancer(mode)` | func | 工厂；mode ∈ {RoundRobin, Random, Failover, Weighted}，未知返回 RoundRobin |
| `RoundRobin` / `Random` / `Failover` / `Weighted` | struct | 四种策略实现 |
| `Iterator` | struct | 统一迭代器：策略 + 粘性 + 熔断检查 + 决策追踪 |
| `NewIterator(group, apiKeyID, requestModel)` | func | 标准构造 |
| `NewIteratorWithPreference(group, apiKeyID, requestModel, preferred)` | func | 带优先通道偏好 |
| `Iterator.Next / Item / IsSticky / StickyKeyID / Len / Index` | methods | 迭代与状态查询 |
| `Iterator.Skip(channelID, keyID, name, msg)` | method | 记录跳过（禁用、无 key、类型不兼容等） |
| `Iterator.SkipCircuitBreak(channelID, keyID, name) bool` | method | 自动检查熔断 + 记录 |
| `Iterator.StartAttempt(channelID, keyID, name) *AttemptSpan` | method | 开始真实转发尝试（计时） |
| `Iterator.Attempts() []ChannelAttempt` | method | 返回所有决策记录 |
| `AttemptSpan.End(status, statusCode, msg)` | method | 结束尝试（自动计算 Duration ms） |
| `AttemptSpan.Duration() time.Duration` | method | 当前耗时 |
| `CircuitState` (enum) | type | `StateClosed` / `StateOpen` / `StateHalfOpen` |
| `FailureKind` (enum) | type | `FailureHard` / `FailureSoftRateLimit` |
| `IsTripped(channelID, keyID, modelName)` | func | `(tripped bool, remaining time.Duration)` |
| `RecordSuccess(channelID, keyID, modelName)` | func | 重置熔断器到 Closed |
| `RecordFailure(channelID, keyID, modelName, kind)` | func | 累计失败；可能触发熔断 |
| `GetCooldown(tripCount int) time.Duration` | func | 当前冷却（指数退避） |
| `SessionEntry` | struct | 粘性会话 `{ChannelID, ChannelKeyID, Timestamp}` |
| `GetSticky(apiKeyID, requestModel, ttl)` | func | 取粘性（TTL 内）；过期惰性删除 |
| `SetSticky(apiKeyID, requestModel, channelID, keyID)` | func | 写入/刷新 |
| `DeleteSticky(apiKeyID, requestModel)` | func | 主动删除 |
| `ResetStateByChannel(channelID int)` | func | 清理指定通道的熔断器与粘性记录（由 op 层在通道删除时调用） |
| `Reset()` | func | 测试用：清空 round-robin counter、熔断器、粘性会话 |

## 关键文件

| 文件 | 职责 |
|------|------|
| `balancer.go` | 4 种策略：RoundRobin（atomic 共享游标，等距轮转）/ Random（`rand.Shuffle`）/ Failover（按 `Priority` 升序）/ Weighted（按 `Weight` 概率加权随机分数降序），`Reset` 全局状态清理 |
| `iterator.go` | `Iterator` + `AttemptSpan`：策略排序、粘性提前、熔断检查、决策追踪、计时 |
| `session.go` | 粘性会话存储：`sessionKey=apiKeyID:requestModel`，TTL 惰性过期，通道级删除 |
| `circuit.go` | 熔断器：三态状态机、指数退避、软/硬失败区分、阈值/冷却配置从 `op.SettingGet*` 读取 |
| `state.go` | `init()` 注册 `ResetStateByChannel` 到 op；通道删除时联动清理 |
| `circuit_test.go` | 通道级清理、HalfOpen 不会永久 trip、reset sticky |
| `session_test.go` | `DeleteSticky` 移除会话 |

## 核心机制

### 1. 熔断器三态状态机 (`circuit.go`)

状态定义：

```
            failures ≥ threshold (Hard)
StateClosed ────────────────────────────► StateOpen
     ▲                                       │
     │                                       │ elapsed ≥ cooldown(tripCount)
     │ probe success                         ▼
     └──────────────────  StateHalfOpen ◄────┘
                              │
                              │ probe failure / SoftRateLimit
                              ▼
                          StateOpen (tripCount++ on hard, 不递增 on soft)
```

**关键时机与触发**：

| 当前状态 | 事件 | 动作 |
|---------|------|------|
| Closed | RecordFailure(Hard) | `ConsecutiveFailures++`；达 `getThreshold()`（默认 5，可由 `SettingKeyCircuitBreakerThreshold` 配置）→ Open，`TripCount++` |
| Closed | RecordFailure(SoftRateLimit) | 不累计（429/503 不应触发跳闸） |
| Open | `IsTripped` 调用且 `elapsed ≥ cooldown` | → HalfOpen，`HalfOpenSince=now`（懒迁移：在查询时迁移，无独立计时器线程） |
| Open | RecordFailure | 仅更新 `LastFailureTime`（请求理论上已被拒绝） |
| HalfOpen | RecordSuccess | → Closed，重置 `TripCount=0`、`ConsecutiveFailures=0` |
| HalfOpen | RecordFailure(Hard) | → Open，`TripCount++`，`ConsecutiveFailures=0` |
| HalfOpen | RecordFailure(SoftRateLimit) | → Open，不递增 TripCount（避免被上游限流放大冷却时间） |
| HalfOpen | `IsTripped` 调用且 `elapsed_since_HalfOpenSince ≥ cooldown` | → Open（探针超时），`LastFailureTime=now` |
| HalfOpen | 其他并发 `IsTripped` | 返回 `tripped=true, remaining=0`（仅允许一个探针） |

**指数退避** (`GetCooldown`)：

```
cooldown = base << (tripCount - 1)     // base 默认 60s（SettingKeyCircuitBreakerCooldown）
                                       // shift 最大 20 防溢出
cooldown = min(cooldown, maxCooldown)  // max 默认 600s（SettingKeyCircuitBreakerMaxCooldown）
```

**熔断 Key 粒度**：`channelID:keyID:modelName`（`circuitKey`）。同一通道不同 API key 或不同模型各自独立熔断，避免单个模型故障拖累整通道。

**懒迁移设计**：`IsTripped` 在查询时检查 `elapsed` 并就地迁移状态。没有后台计时器线程，状态全靠 `sync.Map` + `circuitEntry.mu` (sync.Mutex) 保护并发；`globalBreaker` 用 `LoadOrStore` 避免重复创建条目。

### 2. 四种均衡策略 (`balancer.go`)

| 策略 | 算法 | 适用场景 |
|------|------|---------|
| **RoundRobin** | 全局 `atomic.AddUint64(&roundRobinCounter, 1) % n`，从 idx 开始整圈轮转返回完整候选列表 | 同质通道均匀分流 |
| **Random** | `rand.Shuffle` 全列表随机排列 | 简单去相关 |
| **Failover** | 按 `GroupItem.Priority` 升序排序（数值越小优先级越高） | 主备切换 |
| **Weighted** | 给每个 item 评分 `rand.Float64() * weight / totalWeight`，按分数降序；零/负权重视为 1 | 按容量配比 |

所有策略返回完整候选列表（非单个选择），由 `Iterator` 在迭代时按需消费。这让上层（relay.go）能在某通道失败/熔断时直接走下一个，无需重新调用 Balancer。

### 3. 粘性会话与亲和性 (`session.go` + `Iterator`)

**Session Key**：`apiKeyID:requestModel` —— 同一 API Key 调用同一模型时尽量复用同一通道，提升缓存命中（Anthropic prompt cache、Gemini cachedContent）。

**TTL**：由 `Group.SessionKeepTime`（秒）决定；`GetSticky` 超时惰性删除。

**Iterator 编排顺序** (`NewIteratorWithPreference`)：

1. 调 `GetBalancer(group.Mode).Candidates(group.Items)` 得到策略排序列表
2. 若 `preferred *SessionEntry` 非空且匹配，把其 `ChannelID` 提到列表首位 (`stickyIdx=0`)
3. 否则若 `group.SessionKeepTime > 0`，调 `GetSticky` 查询会话；命中则提前
4. 设置 `stickyKeyID`（上次成功使用的 channel key，让上层可以复用具体 key）

**与 affinity 模块的协作**：`relay/affinity/` 管理更高层的会话状态（multi-turn 上下文），balancer 这里的 sticky 是单次"软偏好"——只是把候选排到首位，不强制；如果首选通道熔断/失败，迭代器立刻 fall through 到下一个。

### 4. 决策追踪 (`Iterator.attempts`)

每次 `Skip` / `SkipCircuitBreak` / `StartAttempt+End` 都追加一条 `model.ChannelAttempt`：

```
{ChannelID, ChannelKeyID, ChannelName, ModelName, AttemptNum,
 Status (Skipped|CircuitBreak|Success|Failure|...), Sticky, Msg, Duration_ms}
```

`Iterator.Attempts()` 暴露完整记录，relay 层在请求结束后持久化到日志，供前端 `log/` 模块展示通道选择历史与诊断。

### 5. 通道删除联动 (`state.go`)

`init()` 中通过 `op.RegisterRelayBalancerStateReset(ResetStateByChannel)` 注册回调。当通道在 op 层被删除/重置时，op 调用此回调清理：

- `resetCircuitBreakerByChannel(channelID)` — 删除所有以 `channelID:` 开头的熔断器条目
- `resetStickyByChannel(channelID)` — 遍历会话存储删除指向该通道的粘性记录

避免删除通道后旧熔断状态或粘性指针残留导致后续请求误判。

## 依赖关系

### 上游依赖

- `internal/model` — `Group`, `GroupItem`, `GroupMode`, `ChannelAttempt`, `AttemptStatus`, `SettingKey*`
- `internal/op` — `SettingGetInt` 读取熔断阈值/冷却配置；`RegisterRelayBalancerStateReset` 注册清理回调
- `internal/utils/log` — 状态迁移日志（Info/Warn）

### 下游消费者

- `relay/relay.go` — 主流程：`NewIterator` → 循环 `Next()` → `SkipCircuitBreak` 或 `StartAttempt` → `End`；失败时调 `RecordFailure`，成功时 `RecordSuccess`
- `relay/affinity/` — 会话级亲和性管理；与本包 sticky 是不同粒度
- `op/group.go` 等 — 通道删除时通过 op 回调触发 `ResetStateByChannel`
- `health/` — 通道健康状态与熔断状态独立但概念相邻：熔断是"短期连续失败保护"，health 是"长期质量评估"

## 测试覆盖

| 测试 | 验证点 |
|------|--------|
| `TestResetCircuitBreakerByChannelRemovesOnlyTargetChannel` | 通道级清理不影响其他通道 |
| `TestResetStickyByChannelRemovesOnlyTargetChannel` | 粘性记录通道级清理隔离 |
| `TestHalfOpenDoesNotRemainTrippedForeverWithoutResult` | HalfOpen 探针超时自动迁回 Open（避免永久 trip） |
| `TestDeleteStickyRemovesSession` | 主动删除会话 |

**未覆盖但需注意的边界**（建议补测）：

- 各 Balancer 策略的分布 / 权重正确性（仅有顺序断言可加 chi-square 或多次抽样统计）
- 指数退避 cooldown 在 `tripCount=20+` 时不溢出（已用 shift cap 但缺断言测试）
- 并发 `IsTripped` 仅允许一个 HalfOpen 探针的语义（需多 goroutine 测试）
- Soft vs Hard 失败在 Closed 状态下的累计差异

## 上游同步注意事项

本目录是 metapi 上游既有模块，**改动要克制**。修改前必读根 [CLAUDE.md](../../../CLAUDE.md#上游同步策略铁律)。

1. **不修改已有函数签名**：`Candidates`、`IsTripped`、`RecordSuccess`、`RecordFailure`、`GetSticky`、`SetSticky` 是 relay 层的稳定契约。新增能力请：
   - 新建函数（如 `RecordFailureWithContext`），保留旧函数转调；
   - 或新建 `*_ext.go` 文件存放扩展。
2. **新增字段安全**：`circuitEntry` / `SessionEntry` / `Iterator` / `AttemptSpan` struct 可追加字段，但**不要重命名**已有字段；新字段须有 zero-value 兼容语义，避免上游升级时 struct literal 初始化报错。
3. **新增 CircuitState / FailureKind 常量需放在末尾**：iota 顺序敏感，新增枚举值应追加而非插入，避免破坏二进制兼容。
4. **全局状态变量不要重命名**：`roundRobinCounter` / `globalBreaker` / `globalSession` 被 `Reset()` 使用并被测试引用，重命名会破坏测试。
5. **配置 key 通过 op 层读取**：熔断阈值/冷却 etc. 通过 `op.SettingGetInt(model.SettingKeyCircuit*)` 读取；新增可配置项应同步在 `model.SettingKey*` 与 `op` 层注册，不要硬编码。
6. **`init()` 注册回调勿移除**：`state.go` 的 `init()` 是通道删除联动的唯一钩子；移除会导致旧状态残留。
7. **指数退避溢出保护**：`GetCooldown` 已 cap shift 到 20；新增策略时同样需考虑溢出与上限。
