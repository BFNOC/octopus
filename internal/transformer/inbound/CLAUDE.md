# transformer/inbound/ - 入站转换

> 导航：[根目录](../../../CLAUDE.md) > internal > [transformer](../CLAUDE.md) > **inbound**

## 职责

将外部客户端请求（OpenAI / Anthropic 格式）解析为 Octopus 统一内部格式 `InternalLLMRequest`，并将内部响应转回客户端格式。

## 关键文件

| 文件 | 职责 |
|------|------|
| `register.go` | 入站转换器注册表，`InboundType` 枚举 → 工厂函数映射，`Get(type)` 获取转换器实例 |

## 子目录

| 目录 | 职责 |
|------|------|
| `openai/` | OpenAI 格式入站：`chat.go` (Chat Completions)、`response.go` (Responses API，含多模态/流式/截断/校验)、`embedding.go` (Embeddings) |
| `anthropic/` | Anthropic 格式入站：`messages.go` (Messages API)、`model.go` (Anthropic 模型映射)、`cache_control.go`、`thinking.go` |

## 支持的入站类型

| InboundType | 说明 |
|-------------|------|
| `InboundTypeOpenAIChat` | OpenAI Chat Completions |
| `InboundTypeOpenAIResponse` | OpenAI Responses API |
| `InboundTypeOpenAIEmbedding` | OpenAI Embeddings |
| `InboundTypeAnthropic` | Anthropic Messages API |

## 依赖关系

- `transformer/model` - `Inbound` 接口、`InternalLLMRequest`/`InternalLLMResponse`
