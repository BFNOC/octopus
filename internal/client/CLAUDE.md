# client/ - LLM 提供商 HTTP 客户端

> 导航：[根目录](../../CLAUDE.md) > internal > **client**

## 职责

封装对外部 LLM API（OpenAI / Anthropic / Gemini / Volcengine 等）的 HTTP 调用基础设施：连接池、超时、重试钩子、TLS 配置。

## 关键文件

| 文件 | 职责 |
|------|------|
| `http.go` | HTTP Client 工厂、Transport 配置、连接池参数、默认超时 |

## 依赖关系

- `net/http`、`crypto/tls` - 标准库
- 被 `relay/`、`sitesync/`、`probe/`、`price/` 共享使用

## 上游同步注意事项

- 修改默认超时/连接池参数前先评估对上游兼容性的影响
- 自定义 Transport 行为优先通过新增构造函数而不是修改已有函数
