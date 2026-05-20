# transformer/outbound/anthropic/

> 导航：[根目录](../../../../CLAUDE.md) > [internal](../../../) > [transformer](../../) > [outbound](../) > **anthropic**

## 职责

Anthropic Messages API 出站适配器：把 Octopus 内部统一中间模型 (`model.InternalLLMRequest` / `InternalLLMResponse`) 转换为 Anthropic 原生 `/messages` 请求与响应；处理流式 SSE 事件、扩展思考 (extended thinking)、缓存断点、服务器工具 (web_search / code_execution / computer)、beta header 自动协商、签名审计与 stop_sequences 上限。

提供两条转换路径：

1. **结构化转换** (`TransformRequest` / `TransformResponse` / `TransformStream*`) — 基于内部模型；用于跨协议互转（如 OpenAI → Anthropic）。
2. **字节级直通** (`TransformRequestRaw`) — Anthropic → Anthropic 同协议，仅重写顶层 `model` 字段，保留客户端原始字节序、空白与字段顺序，以维持 prompt cache 哈希稳定性。

## 入口与公开接口

| 标识 | 类型 | 作用 |
|------|------|------|
| `MessageOutbound` | struct | 出站转换器；持有流式状态 (`streamID` / `streamModel` / `streamUsage` / `toolIndex` / `toolCalls` / `initialized`) |
| `MessageOutbound.TransformRequest` | method | 内部请求 → `*http.Request`，自动设置 `Anthropic-Version: 2023-06-01` 与 `anthropic-beta` |
| `MessageOutbound.TransformRequestRaw` | method | 客户端原始字节直通；仅替换顶层 `model`，保留 prompt-cache 字节稳定性 |
| `MessageOutbound.TransformResponse` | method | Anthropic 非流式响应 → `*InternalLLMResponse`；HTTP ≥400 时映射为 `model.ResponseError` |
| `MessageOutbound.TransformStreamEvent` | method | SSE 事件 → `[]model.StreamEvent`（新版聚合接口） |
| `MessageOutbound.TransformStream` | method | SSE 事件 → `*InternalLLMResponse`（旧版兼容接口） |
| `DefaultAnthropicPassthroughBeta` | const | 直通路径默认 beta：`prompt-caching-2024-07-31,extended-cache-ttl-2025-04-11` |
| `anthropicMaxStopSequences` | var (4) | `stop_sequences` 数组上限；超出截断并 warning |

## 关键文件

| 文件 | 职责 |
|------|------|
| `messages.go` | 主体逻辑（~2000 行）：请求/响应/流转换、消息归一、签名审计、beta 协商、cache_control 修剪、thinking 约束、字节级 model 重写 |
| `messages_test.go` | 核心覆盖：raw model 重写、beta header 自动收集、cache breakpoint 修剪、MCP/Container 透传、服务器工具规格、stop_sequence 截断、孤立 tool_call 补丁 |
| `signature_audit_test.go` | `logAnthropicSignatureAudit` 计数器：thinking/redacted/signature 计数；空集合不打日志 |
| `stop_sequence_test.go` | `convertStopReason` + `StopSequence` 字段从响应映射到 Choice |
| `stream_event_test.go` | Anthropic 原生 SSE → `StreamEvent` 映射（message_start / content_block_* / message_delta / message_stop / error） |
| `stream_usage_test.go` | 流式 usage 跨 `message_start` 与 `message_delta` 聚合，正确合并四桶缓存 token (input / output / cache_read / cache_creation_5m / 1h) |
| `topk_service_tier_test.go` | `top_k` 与 `service_tier` 字段透传；extended thinking 激活时强制 `temperature=1` 且清空 `top_p` / `top_k`（Anthropic 400 规避） |

## 核心机制

### 1. 双路径请求转换

- **`TransformRequest`** 走完整 pipeline：`NormalizeMessages` → `EnforceMessageAlternation(AlternationProviderAnthropic)` → `compat.PatchAnthropicRequest` → `convertToAnthropicRequest`（系统提示拆分、消息合并、tool_calls/tool_result 处理、thinking 配置、cache_control 修剪）→ `applyThinkingParamConstraints` → `convertToolChoice` → `pruneCacheBreakpoints` → JSON 序列化 → URL 拼接 `/messages` → beta header 协商。
- **`TransformRequestRaw`** 仅做最小改动：`rewriteRawRequestModel` 通过 `findTopLevelStringField` 字节级定位顶层 `model` 字段并替换其值，保持原 JSON 字节序不变；这是 Anthropic prompt cache 命中率的关键（cache key 对字段顺序、空白、数字编码敏感）。`x-api-key` 与 `authorization` 由 hop-by-hop 过滤保护，不会被客户端覆盖。

### 2. SSE 流事件转换

`TransformStreamEvent` 是状态机：

- `message_start` — 捕获 `streamID` / `streamModel` / 初始 usage（含 `cache_read` / `cache_creation`）
- `content_block_start` — 区分 `tool_use` / `text` / `thinking` / `redacted_thinking`（`redacted_thinking` 立刻发 start+stop）
- `content_block_delta` — `text_delta` / `input_json_delta` / `thinking_delta` / `signature_delta` 四类
- `message_delta` — 聚合最终 usage（前向继承 `message_start` 的缓存桶，避免被 `output_tokens`-only 覆盖）并发出 `MessageStop` 携带 `StopReason` + `StopSequence`
- `message_stop` / `content_block_stop` / `ping` / `error` — 终态、关块、保活、错误转 `model.ResponseError`

### 3. extended thinking 参数约束 (A-H4)

`applyThinkingParamConstraints` 在 thinking 激活时（`ThinkingTypeEnabled` 或 `ThinkingTypeAdaptive`）强制：

- `temperature = 1.0`
- `top_p = nil`
- `top_k = nil`

否则 Anthropic 返回 400。`AdaptiveThinking=true` 时使用 `ThinkingTypeAdaptive` + `OutputConfig.Effort`，否则使用 `ThinkingTypeEnabled` + 计算的 `BudgetTokens`（`getThinkingBudget`：low=1024 / medium=8192 / high=32768）。

### 4. anthropic-beta header 自动协商 (`collectAnthropicBetaHeaders`)

按下列触发条件自动追加 beta 标签（去重、保序）：

| 触发 | beta |
|------|------|
| `cache_control.ttl == "1h"` | `extended-cache-ttl-2025-04-11` |
| 服务器工具 `web_search_*` | `web-search-2025-03-05` |
| 服务器工具 `code_execution_*` | `code-execution-2025-05-22` |
| 服务器工具 `computer_*` | `computer-use-2025-01-24` |
| `mcp_servers` 非空 | `mcp-client-2025-11-20` |
| `response_format=json_schema` | `structured-outputs-2025-11-13` |
| extended_thinking + tool_use 同一 assistant 回合 | `interleaved-thinking-2025-05-14` |
| `TransformerMetadata[anthropic_context_1m]=true` 且 Sonnet 4/4.5 | `context-1m-2025-08-07`（4.6 原生支持，不加） |
| 任意 `source.type=="file"` 块 | `files-api-2025-04-14` |
| `stream + tools` | `fine-grained-tool-streaming-2025-05-14` |
| `defer_loading=true` 工具 | `tool-search-tool-2025-10-19` |

### 5. cache_control 修剪 (A-L7)

`pruneCacheBreakpoints` 全局保留前 `model.AnthropicMaxCacheBreakpoints` 个断点（系统提示 → tools → messages 顺序遍历），超出的静默清空，避免 Anthropic 400。`convertCacheControl` 丢弃非 `ephemeral` 类型与非 `5m`/`1h` 的 TTL。

### 6. 签名审计 (`logAnthropicSignatureAudit`)

固定事件名 `transformer.reasoning.signature.passthrough`，Debug 级别，记录 `provider=anthropic` + `direction=inject|extract|error` + `thinking_count` / `redacted_count` / `signature_count`。错误响应中包含 "signature" 字样时额外 Warn 级别记录（`truncateForAudit` 截断 256 字节）。`emitThinkingBlocks` 优先使用 `ReasoningBlocksByProvider("anthropic")` 保序回放，确保 multi-turn 签名校验通过。

### 7. stop_sequences 上限 (A-L5)

`convertStopSequences` 截断超过 `anthropicMaxStopSequences=4` 的数组并 Warn 日志；声明为 `var` 便于测试调小阈值。

## 依赖关系

### 上游依赖

- `transformer/model/` — `InternalLLMRequest` / `InternalLLMResponse` / `Message` / `ToolCall` / `Usage` / `ReasoningBlock` / `StreamEvent`
- `transformer/inbound/anthropic` — 复用 `MessageRequest` / `Message` / `StreamEvent` / `Usage` / `AnthropicError` / `ImageSource` / `Tool` 等 wire types
- `transformer/compat` — `PatchAnthropicRequest` 做请求兼容处理
- `utils/log` — 结构化日志
- `utils/xurl` — `ParseDataURL` 处理图像 base64

### 下游消费者

- `relay/` — 通过 `outbound` 注册表调用本包；流式响应由 `relay.go` 与 `transformer.compat.gemini_signature_cache.go` 旁路无关
- `transformer/outbound/register.go` — 通过统一注册表导出

## 测试覆盖

| 测试 | 验证点 |
|------|--------|
| `TestTransformRequestRawRewritesModel` | 字节级 model 重写不破坏其他字段 |
| `TestCollectBetaHeadersAutomation` | 11 类 beta 触发条件 |
| `TestPruneCacheBreakpoints*` | 4 断点上限、系统/tools/messages 顺序保留 |
| `TestConvertStopSequencesCapsArrayLength` | stop_sequences ≤4 截断 |
| `TestTransformRequestForwardsMCPServersAndContainer` | MCP / Container 原始字节透传 |
| `TestConvertToAnthropicRequestDropsUnsupportedCacheControlValues` | 非 ephemeral / 非 5m·1h 丢弃 |
| `TestTransformStreamErrorEventSurfacesResponseError` | SSE error → ResponseError + HTTP status 映射 |
| `TestConvertSingleMessageServerToolResultWireType` | server_tool_result 保留 `BlockType` |
| `TestTransformRequestPreservesServerToolSpecAndBeta` | 服务器工具 RawBody 透传 + 对应 beta |
| `TestConvertToolsDropsServerToolWithoutSpec` | 缺规格的服务器工具丢弃 + Warn |
| `TestTransformRequestPatchesOrphanedToolCalls` | 孤立 tool_call 补 tool_result |
| `TestStreamUsageAggregatesCacheTokens` | 流式 usage 四桶缓存聚合 |
| `TestApplyThinkingParamConstraints*` | thinking 激活时 temperature/top_p/top_k 约束 |
| `TestConvertToAnthropicRequestForwardsTopKAndServiceTier` | top_k + service_tier 透传 |
| `TestConvertToLLMResponsePropagatesStopSequence` | stop_sequence 透传到 Choice |
| `TestTransformStreamEventAnthropicNativeMapping` | SSE 全事件类型映射 |
| `TestLogAnthropicSignatureAuditInject/Empty` | 签名审计计数与空集合短路 |

## 上游同步注意事项

本目录是 fork 后大幅扩展过的核心适配器，与 metapi 上游存在持续演进差异。修改前必读根 [CLAUDE.md](../../../../CLAUDE.md#上游同步策略铁律)。

1. **扩展优先**：新 beta header、新 thinking 模式、新 server tool 等优先通过 `collectAnthropicBetaHeaders` 内 `case` 分支或新建 `*_ext.go` 文件追加；不要修改 `messages.go` 已有函数签名。
2. **新增字段安全**：`MessageOutbound` struct 可直接加字段（如新增流状态计数器），但**不要重命名**已有字段。
3. **函数签名稳定**：`TransformRequest` / `TransformResponse` / `TransformStream*` 是 outbound 接口约定，必须保持签名。需扩展行为时新建函数（参考 `TransformRequestRaw` 与 `TransformStreamEvent`）。
4. **签名审计事件名固定**：`transformer.reasoning.signature.passthrough` 用于跨提供商日志聚合，**不要重命名或拆分**。
5. **直通字节序敏感**：`TransformRequestRaw` 与 `rewriteRawRequestModel` 的字节级行为是 prompt cache 命中率前提，任何改动需附 prompt-cache 回归测试。
6. **常量声明为 var**：`anthropicMaxStopSequences` / `geminiInlineDataMaxBytes` 等使用 `var` 以便测试调小；新增此类阈值沿用此约定。
