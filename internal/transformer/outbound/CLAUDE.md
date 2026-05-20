# transformer/outbound/ - 出站转换

> 导航：[根目录](../../../CLAUDE.md) > internal > [transformer](../CLAUDE.md) > **outbound**

## 职责

将 Octopus 统一内部格式 `InternalLLMRequest` 转换为各 LLM 提供商的原生请求格式，并将提供商响应转回内部格式。

## 关键文件

| 文件 | 职责 |
|------|------|
| `register.go` | 出站转换器注册表，`OutboundType` 枚举 → 工厂函数映射，`Get(type)` 获取实例；`EmbeddingChannelTypes`/`ChatChannelTypes` 通道类型集合 |

## 子目录

| 目录 | 职责 |
|------|------|
| `openai/` | OpenAI 格式出站：`chat.go` (Chat Completions)、`response.go` (Responses API)、`embedding.go` |
| `anthropic/` | Anthropic 格式出站：`messages.go`、stream 事件、签名审计、stop sequence |
| `gemini/` | Gemini 格式出站：`messages.go`、`budget.go`、tools、routing、usage metadata |
| `volcengine/` | 火山引擎格式出站：`response.go` |

## 支持的出站类型

| OutboundType | 说明 |
|-------------|------|
| `OutboundTypeOpenAIChat` | OpenAI Chat Completions |
| `OutboundTypeOpenAIResponse` | OpenAI Responses API |
| `OutboundTypeOpenAIEmbedding` | OpenAI Embeddings |
| `OutboundTypeAnthropic` | Anthropic Messages |
| `OutboundTypeGemini` | Google Gemini |
| `OutboundTypeVolcengine` | 火山引擎 |

## 依赖关系

- `transformer/model` - `Outbound` 接口、`InternalLLMRequest`/`InternalLLMResponse`
