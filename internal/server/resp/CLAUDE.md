# server/resp/ - 统一响应格式

> 导航：[根目录](../../../CLAUDE.md) > internal > [server](../CLAUDE.md) > **resp**

## 职责

定义所有 HTTP 响应的统一信封 `{code, message, data}`，提供成功/失败助手函数与标准错误码。

## 公开接口（典型）

| 符号 | 说明 |
|------|------|
| `Success(c *gin.Context, data any)` | 200 + `{code:0, message:"", data}` |
| `Fail(c *gin.Context, code int, message string)` | 业务失败响应 |
| `Error(c *gin.Context, err error)` | 包装 error → 标准响应 |
| 各类 `Err*` 常量 | 标准错误码（参数错误、未授权、未找到、内部错误等） |

## 关键文件

| 文件 | 职责 |
|------|------|
| `resp.go` | 响应封装与助手函数 |
| `error.go` | 错误码常量与错误类型 |
| `resp_test.go` | 单元测试 |

## 依赖关系

- `github.com/gin-gonic/gin` - Context
- 被 `server/handlers/` 全部 handler 使用

## 上游同步注意事项

- 错误码新增追加到尾部，**不重排已有编号**（前端 i18n 依赖编号映射）
- `Success`/`Fail` 的返回结构是公共契约，禁止修改字段名
