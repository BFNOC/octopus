# relay/compat/ - 请求兼容性适配

> 导航：[根目录](../../../CLAUDE.md) > internal > [relay](../CLAUDE.md) > **compat**

## 职责

在 relay 层对请求进行兼容性预处理：参数预检、service_tier 标准化、web_search 工具检测。

## 关键文件

| 文件 | 职责 |
|------|------|
| `preflight.go` | `ValidateResponsesRequest`：校验 model/messages/max_tokens/temperature/top_p/reasoning_effort/truncation 参数合法性 |
| `service_tier.go` | `NormalizeServiceTier`/`ApplyServiceTierPolicy`：标准化 service_tier 值 (auto/default/flex)，支持 Pass/ForceDefault/Strip 三种策略 |
| `web_search.go` | `HasWebSearchOnlyTool`：检测请求是否仅含 web_search 工具；`ExtractSearchQuery`：从请求中提取搜索查询 |
| `compat_test.go` | 上述功能的单元测试 |

## 依赖关系

- `transformer/model` - `InternalLLMRequest`、`Tool` 等类型
