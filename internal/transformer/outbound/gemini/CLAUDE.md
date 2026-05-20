# transformer/outbound/gemini/

> 导航：[根目录](../../../../CLAUDE.md) > [internal](../../../) > [transformer](../../) > [outbound](../) > **gemini**

## 职责

Google Gemini API 出站适配器：把 Octopus 内部统一中间模型转换为 Gemini `generateContent` / `streamGenerateContent` 请求与响应。覆盖 Gemini 2.5 与 Gemini 3.x 两代家族的差异化能力——thinking budget vs thinking level、thoughtSignature 多回合回放、grounding / citations / URL context、code_execution 沙箱、cachedContent 引用、speechConfig 音频、多模态 modality、Files API 大文档降级、自定义 toolConfig 等。

## 入口与公开接口

| 标识 | 类型 | 作用 |
|------|------|------|
| `MessagesOutbound` | struct | 出站转换器；持有 `streamReasoningIndex` (per-candidate) 与 `streamToolCallIndex` 用于跨 SSE 块单调编号 |
| `MessagesOutbound.TransformRequest` | method | 内部请求 → `*http.Request`；自动拼接 `/v1beta/models/<m>:generateContent` 或 `:streamGenerateContent?alt=sse`，密钥走 `x-goog-api-key` header |
| `MessagesOutbound.TransformResponse` | method | Gemini 非流式响应 → `*InternalLLMResponse` |
| `MessagesOutbound.TransformStreamEvent` | method | SSE 事件 → `[]model.StreamEvent`（新接口） |
| `MessagesOutbound.TransformStream` | method | SSE 事件 → `*InternalLLMResponse`（旧接口，使用全局 reasoning indexer 维持跨块 Index 单调） |
| `geminiInlineDataMaxBytes` | var (~20MB) | inline_data 解码后大小上限；超出转 Files API 引用或丢弃 |

## 关键文件

| 文件 | 职责 |
|------|------|
| `messages.go` | 主体（~2100 行）：请求/响应/流转换、消息构建、tool/toolConfig、generation_config、modality、grounding/citation/url_context、code_execution、speechConfig、cachedContent、Labels、JSON Schema 转换 (`cleanGeminiSchema`)、thoughtSignature 三层定位（by ID → by name → loose ordinal） |
| `budget.go` | thinking 配置决策器：family 分类 (`classifyGeminiFamily`)、`resolveThinkingConfig`、budget ↔ level 互转、family 范围 clamp |
| `budget_test.go` | thinking 决策器 11+ 用例：adaptive、零/动态预算、effort 回退、family clamp、Gemini 3 effort 强制、modality 规范化 |
| `messages_test.go` | 核心场景：Schema 清理（`propertyNames` 递归）、thoughtSignature 三层定位、单调 tool index、安全 tool_call ID 生成、function_response.name 解析、code_execution 双向、grounding/citations/url_context/safety_ratings、inline 文档大小降级、candidate_count、speechConfig 三态、cachedContent + Labels、systemInstruction wire shape |
| `tools_test.go` | 工具映射：google_search / url_context / code_execution / 混合 functionDeclarations 与 server tool / 未知类型丢弃 + wire shape |
| `routing_test.go` | URL 构造：缺版本时补 `/v1beta`、保留显式 `/v1` / `/v1beta`、`x-goog-api-key` header、stream `alt=sse` 保留、`pathHasGeminiVersion` 边界（`/viewer` 不误判） |
| `generation_config_test.go` | generationConfig 字段：seed / logprobs / topLogprobs（≤5 clamp）、`top_k` 原生与 metadata fallback、media_resolution、frequency/presence penalty |
| `reasoning_index_test.go` | 流式 reasoning Index 单调（跨块 / 跨 candidate）、function_call 签名按名锚定、stream done 处理、`collectGeminiSignaturesByName` 首匹配语义 |
| `response_metadata_test.go` | response metadata：ID/model/created 透传、prompt 被 block 时合成 Choice + safety ratings |
| `roundtrip_test.go` | 双向 roundtrip：Gemini 单回合 thoughtSignature 经内部模型再回写不丢；Gemini → Anthropic 协议互转保留签名 |
| `signature_audit_test.go` | `logGeminiSignatureAudit` extract 统计、空集合不打日志 |
| `usage_metadata_test.go` | usage metadata 字段透传：thoughts_token_count → reasoning_tokens、cached_content_token_count、tool_use_prompt_tokens、per-modality 详情 (TEXT/IMAGE/VIDEO/AUDIO/DOCUMENT) |

## 核心机制

### 1. Family 分类与 thinking 决策 (`budget.go`)

`classifyGeminiFamily` 按 model ID 字符串匹配返回 6 种 family：

| Family | thinking 杠杆 | 范围 |
|--------|--------------|------|
| `geminiFamilyNoThinking` | 不支持 (Flash-Lite) | — |
| `geminiFamily25Flash` | `thinkingBudget` 整数 | 0..24576 |
| `geminiFamily25Pro` | `thinkingBudget` 整数 | 128..32768（0 被拒，自动 clamp 到 128） |
| `geminiFamily3Flash` | `thinkingLevel` 字符串 | {minimal, low, medium, high} |
| `geminiFamily3Pro` | `thinkingLevel` | {low, high}（无 minimal / medium） |
| `geminiFamily31Pro` | `thinkingLevel` | {low, medium, high}（不能关闭，禁用请求被提升到 low） |

`resolveThinkingConfig` 三优先级决策：

1. `reasoningBudget` 指针（区分 unset 与显式 0/-1）
2. `reasoningEffort` 关键字（none/off/minimal/low/medium/high）
3. family 默认（dynamic：2.5 返回 -1，3.x 返回空 level，让服务器决定）

`AdaptiveThinking=true` 短路所有路径，直接走 `dynamicDecision`。

`budgetToLevel`（2.5 → 3 边界迁移）：0→minimal、≤2048→low、≤8192→medium、其余→high；随后 `clampLevelToFamily` 按子家族裁剪。

### 2. thoughtSignature 三层定位 (G-H7 / G-C4)

Gemini 3 多回合 function_call **强制要求**回放上一回合的 `thoughtSignature`，否则 400 INVALID_ARGUMENT。outbound 在 `convertLLMToGeminiRequest` 中按强度递减查找：

1. `toolCall.GetGeminiExtensions().ThoughtSignature` — 调用方显式携带
2. `collectGeminiSignaturesByToolCallID` — 按 tool_call ID 精确匹配（最强锚点）
3. `collectGeminiSignaturesByName` — 按 function_name 匹配（同名工具仅取首签名）
4. `collectGeminiLooseSignatures` + `nextGeminiSignature` 游标 — 按出现顺序填充（兜底）

对应的 inbound 提取在 `convertGeminiToLLMResponse` 中将 functionCall 携带的签名转为 `ReasoningBlock{Kind: Signature, ToolCallID, ToolCallName}`，确保下回合可以 by-ID / by-name 重新绑定，避免按位置回放导致多工具签名错配。

### 3. 流式 reasoning Index 单调 (G-C4)

`MessagesOutbound.streamReasoningIndex` 是 `map[candidateIndex]int` 计数器；`nextReasoningIndex(candidateIndex)` 在每个 candidate 内单调自增。`TransformStream` 把该 closure 传给 `convertGeminiToLLMResponse(streamIndexer:)`，使 `ReasoningBlock.Index` 跨 SSE 块仍保持全局有序，inbound 聚合器才能正确绑定 signature delta 到正确的 thinking block。

### 4. URL 路由与版本回退 (G-H5 / G-H6)

`TransformRequest` 用 `pathHasGeminiVersion` 检测 base URL 是否已含版本段：

- 含 `/v1` / `/v1beta` / `/v1alpha` → 保留
- 仅有 hostname → 自动追加 `/v1beta`（避免 `/models/...` 404）
- `/viewer` 等以 `v` 开头但非版本的路径不会误判（必须 `v<digit>`）

API key 一律走 `x-goog-api-key` header（不走 query string，避免泄漏到代理日志）；stream 请求保留 `alt=sse` query。

### 5. inline_data 大小降级 (G-M10)

`convertDocumentToGeminiPart` 估算 base64 解码后大小，超 `geminiInlineDataMaxBytes` (20 MB) 时按优先级降级：

1. `TransformerMetadata[gemini_files_api_uri:<media_type>]` — 按 MIME 精确替换
2. `TransformerMetadata[gemini_files_api_uri]` — 通用替换
3. 否则丢弃块并 Warn

URL 类型文档因 Gemini FileData 仅支持 `gs://` 不支持 HTTPS，降级为文本提示。

### 6. JSON Schema 清理 (`cleanGeminiSchema`)

Gemini 不接受完整 Draft-07 Schema。`geminiSchemaTransformer` 递归处理：

- 解析 `$ref` 本地引用，深拷贝合并并保留 overlay
- 合并 `allOf` 到当前节点（已有 properties 优先）
- 类型大写转换 (`string` → `STRING` 等)，并处理 nullable union
- ARRAY 元组：同构折叠为单 item schema，异构降级为空 schema + 描述提示
- `anyOf` const → enum，否则取首个含 type/enum 的分支
- `default` 提升到 description "(Default: ...)"
- 删除不支持字段：`title`, `$schema`, `$ref`, `strict`, `exclusiveMaximum/Minimum`, `additionalProperties`, `oneOf`, `default`, `$defs`, `propertyNames`, `pattern`, `min/maxLength`, `minimum/maximum`, `min/maxItems`, `uniqueItems`, `multipleOf`
- 通过 `visited[uintptr]` 防环

### 7. Tool Wire Shape

Gemini 的 `tools` 是 discriminated union：

- `functionDeclarations` 与 `googleSearch` / `codeExecution` / `urlContext` **不能在同一 GeminiTool 中并存**
- outbound 把 server tools 拆为独立 GeminiTool entry；混用时 Warn 但仍发请求
- toolChoice → `toolConfig.functionCallingConfig{mode: AUTO|ANY|NONE, allowedFunctionNames}`；命名工具走 ANY + allowedFunctionNames，Anthropic 的 `disable_parallel_tool_use` 无对应字段，被丢弃

### 8. code_execution 双向 (G-H9)

inbound 把 Gemini 的 `executableCode` / `codeExecutionResult` parts 折叠为跨提供商的 `ServerToolUseBlock` / `ServerToolResultBlock`（`BlockType="code_execution_tool_result"`），通过 `hasStructuredPart` 标志位强制走 `MultipleContent` 路径避免被字符串路径吞掉。

### 9. 签名审计 (`logGeminiSignatureAudit`)

事件名 `transformer.reasoning.signature.passthrough` 与 Anthropic 共用，`provider=gemini`，direction 为 `extract`（响应解析）或 `inject`（请求构建，在 `convertLLMToGeminiRequest` 内联打）。空集合短路不打日志。

### 10. 其他 G-Hx 兼容点速查

| 标识 | 字段 / 行为 |
|------|------------|
| G-H1 | `top_k` 原生支持 + `TransformerMetadataGeminiTopK` legacy fallback |
| G-H8 | `cachedContent` 引用 + Labels (复用 OpenAI Metadata) |
| G-H10 | grounding / citation / url_context 三类响应 metadata 转换为 `Choice.Grounding` / `.Citations` / `.URLContext` |
| G-H11 | `speechConfig` 三态：raw passthrough → audio.voice 合成 → omit |
| G-M8 | candidateCount via `TransformerMetadataGeminiCandidateCount` (绕过 `n=1` 不变量) |
| G-M9 | safetyRatings：candidate 上 + prompt 被 block 时的合成 Choice 上 |

## 依赖关系

### 上游依赖

- `transformer/model/` — 内部模型 + Gemini wire types (`GeminiGenerateContentRequest`, `GeminiContent`, `GeminiPart`, `GeminiFunctionCall`, `GeminiThinkingConfig`, `GeminiUsageMetadata`, `GeminiSchema`, `GeminiGroundingMetadata`, `GeminiSafetyRating` 等)
- `transformer/compat/gemini_signature_cache.go` — 跨请求签名缓存（由 relay 层调用，本包仅生产签名块）
- `utils/log` — 结构化日志（Warn / Debug）
- `utils/xurl` — `ParseDataURL` 处理图像 / 音频 / 文件 base64
- `samber/lo` — `FromPtr` / `FromPtrOr` 指针解包

### 下游消费者

- `relay/` — 通过 `outbound` 注册表调度
- `transformer/outbound/register.go` — 注册入口
- 跨协议互转（如 OpenAI → Gemini、Anthropic → Gemini）由 inbound 解析后调用本包

## 测试覆盖

| 主题 | 测试 |
|------|------|
| thinking 决策 | `TestResolveThinkingConfig*` 11+ 用例覆盖 adaptive / 零预算 / dynamic / effort / family clamp / Gemini 3 effort 强制 |
| family 分类 | `TestClassifyGeminiFamilyVariants`、`TestClampLevelToFamily` |
| URL routing | `TestTransformRequestFillsDefaultGeminiApiVersion`、`TestTransformRequestPreservesExplicitGeminiApiVersion`、`TestTransformRequestSendsApiKeyAsHeader`、`TestTransformRequestStreamKeepsAltSse`、`TestPathHasGeminiVersion` |
| Schema 清理 | `TestCleanGeminiSchemaRemovesPropertyNamesRecursively` |
| thoughtSignature 定位 | `TestConvertGeminiRequestBindsToolCallThoughtSignature`、`TestConvertGeminiRequestPrefersToolCallIDForThoughtSignature`、`TestConvertGeminiRequestFallsBackToOrdinalThoughtSignature`、`TestConvertLLMToGeminiRequestBindsSignaturesByName`、`TestConvertGeminiRequestDowngradesUnsignedHistoricalToolUse` |
| 流式单调 Index | `TestTransformStreamReasoningIndexIsGlobalAcrossChunks`、`TestTransformStreamReasoningIndexIsPerCandidate`、`TestTransformStreamEventAssignsMonotonicToolIndexesAcrossChunks` |
| function_response.name | `TestConvertGeminiRequestFunctionResponseNameFromAssistantLookup`、`TestConvertGeminiRequestFunctionResponseNamePrefersToolCallName` |
| code_execution | `TestConvertGeminiResponseCodeExecutionParts`、`TestConvertGeminiResponseCodeExecutionResultFailedOutcome` |
| grounding / metadata | `TestConvertGeminiResponseGroundingMetadata`、`TestConvertGeminiResponseCitationMetadata`、`TestConvertGeminiResponseURLContextMetadata`、`TestConvertGeminiResponseSafetyRatings` |
| inline_data 降级 | `TestConvertDocumentToGeminiPartInlineLimitFallback` |
| Tools wire | `TestConvertToolsGoogleSearch*`、`TestConvertToolsMixedFunctionAndServerTool`、`TestConvertToolsUnknownDropped` |
| Generation config | `TestConvertLLMToGeminiRequestPopulatesNewConfigFields`、`TestConvertLLMToGeminiRequestClampsLogprobs`、`TestConvertLLMToGeminiRequestFallsBackToLegacyTopKMetadata` |
| Roundtrip | `TestGeminiThoughtSignatureRoundTrip`、`TestGeminiStreamToAnthropicPreservesThoughtSignature` |
| Usage metadata | `TestConvertGeminiToLLMResponseCarriesUsageMetadataDetails` |
| Signature audit | `TestLogGeminiSignatureAuditExtract`、`TestLogGeminiSignatureAuditNoopOnEmpty` |
| Speech / cache | `TestConvertGeminiRequestSpeechConfig*`、`TestConvertGeminiRequestCachedContentAndLabels` |

## 上游同步注意事项

本目录在 fork 后大量增加 Gemini 3 family 支持与 thoughtSignature 处理逻辑，与 metapi 上游差异较大。修改前必读根 [CLAUDE.md](../../../../CLAUDE.md#上游同步策略铁律)。

1. **扩展优先**：新 Gemini family / 新 thinking level 等优先在 `budget.go` 中追加 `geminiFamily*` 常量与 `case` 分支；不要修改 `resolveThinkingConfig` 函数签名。
2. **新增字段安全**：`MessagesOutbound` struct 可加字段（如新增 candidate-level 计数器），但不要重命名已有字段。
3. **签名定位三层次不可降级**：by ID → by name → by ordinal 的顺序与各自的 `delete()` 一次性消费语义必须保持，否则多工具签名错配会立刻反映到 Gemini 400。如新增更强锚点，应放在 by ID 之前，而非替换。
4. **签名审计事件名固定**：`transformer.reasoning.signature.passthrough` 跨提供商共用，**不要重命名或拆分**。
5. **Schema 清理白名单**：`cleanGeminiSchema` 删除字段列表中的每个条目都对应 Gemini 已知拒绝的 Draft-07 关键字；新增字段前先验证 Gemini 是否真的拒绝。
6. **常量声明为 var**：`geminiInlineDataMaxBytes` 等阈值使用 `var` 以便测试调小，新增此类阈值沿用此约定。
7. **wire shape 测试是回归底线**：tool wire / generation config wire / systemInstruction wire 测试一旦失败往往意味着上游 API 变更，应同时联动 inbound 与签名缓存。
