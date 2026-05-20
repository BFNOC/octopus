# grouphealth/ - 分组健康检查

> 导航：[根目录](../../CLAUDE.md) > internal > **grouphealth**

## 职责

对分组 (Group) 内的候选通道逐一探活，生成快照 (Snapshot) 和尝试记录 (Attempt)，判定分组整体健康状态 (Success / Partial / Failed)。

## 关键文件

| 文件 | 职责 |
|------|------|
| `service.go` | `Service` 核心：`RunGroupHealth` 按优先级/权重排序候选通道，逐一探活，Failover 模式首成功即停，Full 模式全量探测；`RunAllGroupHealth` 并发跑全部分组 |
| `probe.go` | `Prober`：构建探活 HTTP 请求（按 channel type 适配 OpenAI/Anthropic/Gemini/Volcengine 格式），发送请求并收集结果 |
| `service_test.go` | Service 集成测试 |
| `probe_test.go` | Prober 单元测试 |

## 核心类型

| 类型 | 说明 |
|------|------|
| `Service` | 编排健康检查流程，依赖 `Repository` + `Prober` |
| `Repository` | 接口：快照 CRUD、Attempt 追加、视图查询 |
| `Prober` | 向外部 LLM API 发 ping 请求，返回 `ProbeResult` |
| `ProbeResult` | 单次探活结果：Success/HTTPStatus/DurationMS/ErrorMessage |

## 探活模式

| 模式 | 行为 |
|------|------|
| `Standard` | Failover 分组首成功即停，其余 Skipped |
| `Full` | 探测所有候选通道，不提前停止 |

## 依赖关系

- `op/` - 获取 Group/Channel 数据、`GroupHealthRepository` 实现
- `model/` - `GroupHealthSnapshot`、`GroupHealthAttempt`、`GroupHealthProbeMode` 等模型
- `helper/` - HTTP 客户端、参数覆盖
- `transformer/outbound/` - 构建出站请求
- `transformer/model/` - 内部请求格式
