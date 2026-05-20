# price/ - LLM 模型价格管理

> 导航：[根目录](../../CLAUDE.md) > internal > **price**

## 职责

维护 LLM 模型的定价信息，包括从 [models.dev](https://models.dev) 抓取最新价格表、内置 Preset 预设、按 token 计算费用。

## 关键文件

| 文件 | 职责 |
|------|------|
| `price.go` | 价格表加载、查询接口、外部 API 同步 |
| `presets.go` | 内置预设价格（无网络时回退使用） |

## 数据流

```
task/sync.go (定时) → price.FetchAll → models.dev API
                                     ↓
                                  op/llm.go 持久化 + 缓存
                                     ↓
                                relay/、helper/price.go 查询计费
```

## 依赖关系

- `internal/client` - HTTP 抓取
- `internal/op` - 价格落库
- 被 `relay/`、`helper/`、`task/` 使用

## 上游同步注意事项

- 新增预设价格属于 **纯新增** 范畴，直接追加到 `presets.go`
- 不修改 `price.go` 的核心 fetch 函数签名
