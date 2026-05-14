# transformer/ - 协议转换层

## 职责
在 Octopus 统一中间格式与各 LLM 提供商原生格式之间双向转换。

## 架构

```
外部请求 (OpenAI/Anthropic 格式)
    → inbound/ 解析 → transformer/model/ 统一格式
    → relay 转发
    → outbound/ 格式化 → 外部 LLM API (OpenAI/Anthropic/Gemini/Volcengine 格式)
```

## 关键目录

| 目录 | 职责 |
|------|------|
| `model/` | 统一中间数据模型：Message, Request, Response, StreamEvent, Schema, Extension 等 |
| `inbound/register.go` | 入站转换器注册表 |
| `inbound/openai/` | OpenAI 格式入站：`chat.go` (Chat Completions), 多模态/流式/截断/校验 |
| `inbound/anthropic/` | Anthropic 格式入站：`messages.go`, model 转换 |
| `outbound/register.go` | 出站转换器注册表 |
| `outbound/openai/` | OpenAI 格式出站：`chat.go`, `response.go`, `embedding.go` |
| `outbound/anthropic/` | Anthropic 格式出站：`messages.go`, stream 事件, 签名审计, stop sequence |
| `outbound/gemini/` | Gemini 格式出站：`messages.go`, `budget.go`, tools, routing, usage metadata |
| `outbound/volcengine/` | Volcengine 格式出站：`response.go` |
| `compat/` | 兼容层：`tool_calls.go` (工具调用兼容), `gemini_signature_cache.go` |

## 关键模式

- **注册模式**: `inbound/register.go` 和 `outbound/register.go` 维护格式→转换器映射
- **流式聚合**: `model/stream_aggregator.go` 聚合流式事件
- **消息规范化**: `model/message_normalize.go` 统一消息格式
- **Schema 转换**: `model/schema.go` 处理 JSON Schema 互转

## 测试覆盖
出站转换器测试覆盖率高，包含 roundtrip 测试验证双向转换一致性。
