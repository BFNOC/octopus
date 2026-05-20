# utils/tokenizer/ - Token 计数器

> 导航：[根目录](../../../CLAUDE.md) > internal > utils > **tokenizer**

## 职责

文本 Token 计数，当前使用 O200k_base 编码（GPT-4o 系列）。

## 关键文件

| 文件 | 职责 |
|------|------|
| `tokenizer.go` | `CountTokens(content, model) int`：计算文本的 token 数量 |

## 依赖关系

- `github.com/tiktoken-go/tokenizer` - Tiktoken Go 实现
