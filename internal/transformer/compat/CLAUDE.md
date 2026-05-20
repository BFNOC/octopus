# transformer/compat/ - 协议兼容层

> 导航：[根目录](../../../CLAUDE.md) > internal > [transformer](../CLAUDE.md) > **compat**

## 职责

跨提供商协议兼容处理：修复孤立的 tool_call（Anthropic 严格 schema 要求），缓存 Gemini thoughtSignature 以保持 Anthropic 客户端的 tool_use ID 不变。

## 关键文件

| 文件 | 职责 |
|------|------|
| `tool_calls.go` | `PatchAnthropicRequest`：Anthropic 协议修复入口；`FixOrphanedToolCalls`：为未回复的 assistant tool_use 块插入空 tool_result |
| `gemini_signature_cache.go` | `SaveGeminiThoughtSignature`/`RestoreGeminiThoughtSignature`：缓存 Gemini opaque thoughtSignature（TTL 24h），避免修改公开的 tool_use ID |
| `tool_calls_test.go` | 工具调用兼容测试 |

## 依赖关系

- `transformer/model` - `InternalLLMRequest`、`Message`、`ToolCall` 等类型
- `utils/cache` - 分片缓存（用于 thoughtSignature 存储）
