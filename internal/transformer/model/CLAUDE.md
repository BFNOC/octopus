# transformer/model/ - 统一中间数据模型

> 导航：[根目录](../../../CLAUDE.md) > internal > [transformer](../CLAUDE.md) > **model**

## 职责

定义 Octopus 内部的统一 LLM 请求/响应数据模型，是 inbound 和 outbound 转换器之间的桥梁。所有提供商特定格式都转换为此模型再进行处理。

## 关键文件

| 文件 | 职责 |
|------|------|
| `model.go` | 核心数据结构：`InternalLLMRequest`、`InternalLLMResponse`、`Message`、`MessageContent`、`ToolCall`、`Tool`、`Usage` 等 |
| `interface.go` | `Inbound` / `Outbound` / `OutboundStreamEventTransformer` / `InboundStreamEventTransformer` 接口定义 |
| `stream_event.go` | `StreamEvent` 流式事件类型定义 |
| `stream_aggregator.go` | `StreamAggregator`：将流式事件聚合为完整响应 |
| `schema.go` | JSON Schema 互转工具 |
| `extension.go` | 扩展字段处理 |
| `alternation.go` | 消息交替排列处理（某些提供商要求 user/assistant 交替） |
| `finishreason.go` | 统一 FinishReason 映射 |
| `gemini.go` | Gemini 特有的数据结构 |
| `message_normalize_test.go` | 消息规范化测试 |
| `*_test.go` | 各功能测试 |

## 核心接口

```
Inbound: TransformRequest / TransformResponse / TransformStream / GetInternalResponse
Outbound: TransformRequest / TransformResponse / TransformStream
```

## 依赖关系

- 无内部依赖，被 `inbound/`、`outbound/`、`relay/`、`compat/` 等广泛引用
