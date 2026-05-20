# utils/cache/ - 分片内存缓存

> 导航：[根目录](../../../CLAUDE.md) > internal > utils > **cache**

## 职责

提供高并发场景下的分片内存缓存：16 个 shard，使用 xxhash 选 shard，降低锁竞争。被 `op/` 用作主数据缓存。

## 公开接口（典型）

| 符号 | 说明 |
|------|------|
| `New[K, V any]() *Cache[K, V]` | 构造分片缓存（泛型） |
| `(*Cache).Get(k) (V, bool)` | 查询 |
| `(*Cache).Set(k, v)` | 写入 |
| `(*Cache).Delete(k)` | 删除 |
| `(*Cache).Range(fn)` | 迭代 |

## 关键文件

| 文件 | 职责 |
|------|------|
| `cache.go` | `Cache` 入口、分片路由、对外 API |
| `shard.go` | 单个 shard：`sync.RWMutex` + map 实现 |

## 设计要点

- **16 shard**：减少写锁竞争
- **xxhash**：快速、低碰撞的 key → shard 映射
- **泛型**：编译期类型安全，无 interface{} 装拆箱开销
- 配合 `op.SaveCache()` 实现关机持久化（缓存层本身只管内存）

## 依赖关系

- `github.com/cespare/xxhash` - 哈希函数
- 被 `internal/op/*` 大量使用

## 上游同步注意事项

- 分片数（16）是性能调优参数，修改前需基准测试
- 不修改 `Get`/`Set` 签名，新增能力（TTL、回调）通过扩展方法
