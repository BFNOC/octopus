# relay/affinity/ - 通道亲和性

> 导航：[根目录](../../../CLAUDE.md) > internal > [relay](../CLAUDE.md) > **affinity**

## 职责

管理会话到通道的亲和性映射：记录成功通道作为 Preferred，累计失败达阈值后 Block 该通道，对候选列表重排序（Preferred 置顶、Blocked 排除）。

## 关键文件

| 文件 | 职责 |
|------|------|
| `state.go` | `AffinityStore`：基于 `sync.Map` 的亲和状态存储，提供 `ApplyPreference`/`RecordSuccess`/`RecordDowngrade`/`Clear` |
| `affinity_test.go` | 单元测试，含自定义 Clock 注入 |

## 核心常量

| 常量 | 值 | 说明 |
|------|-----|------|
| `maxEntries` | 512 | 最大存储条目数 |
| `preferredTTL` | 24h | Preferred 记录有效期 |
| `blockTTL` | 6h | Block 记录有效期 |
| `blockThreshold` | 2 | 连续失败次数达此值后真正 Block |

## 公开接口

| 方法 | 说明 |
|------|------|
| `ApplyPreference(key, candidates)` | 根据亲和性重排序候选列表 |
| `RecordSuccess(key, endpoint)` | 记录成功，设置 Preferred |
| `RecordDowngrade(key, failed, recovered)` | 记录降级，累计 Block 计数 |
| `Clear(key)` | 清除指定 key 的亲和状态 |

## 依赖关系

- `transformer/outbound` - `OutboundType` 类型
