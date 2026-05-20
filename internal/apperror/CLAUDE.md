# apperror/ - 应用错误体系

> 导航：[根目录](../../CLAUDE.md) > internal > **apperror**

## 职责

定义统一的应用错误类型 `Error`，携带机器可读的 `Code`、人类可读的 `Message`、HTTP `Status` 和可选参数 `Params`。UI 客户端按 Code 翻译，Message 仅作后备。

## 关键文件

| 文件 | 职责 |
|------|------|
| `apperror.go` | `Error` 结构体、构造函数 (`New`/`Newf`/`Wrap`/`Wrapf`)、提取函数 (`Code`/`Message`/`Status`/`Params`/`IsCode`)、快捷构造 (`InvalidJSON`/`InvalidParam`) |
| `apperror_test.go` | 单元测试 |

## 错误码命名空间

| 前缀 | 用途 |
|------|------|
| `common.*` | 通用错误（JSON 解析、参数校验、404、数据库错误等） |
| `auth.*` | 认证授权（未授权、Token 过期、API Key 禁用/超额等） |
| `site.sub2api.*` | 站点 Sub2API 特有错误 |

## 公开接口

| 函数 | 说明 |
|------|------|
| `New(code, message)` | 创建错误 |
| `Wrap(code, message, err)` | 包装已有 error |
| `Code(err) string` | 从 error 链提取 Code |
| `Status(err) int` | 从 error 链提取 HTTP Status |
| `IsCode(err, code) bool` | 判断错误码 |

## 依赖关系

- 无外部依赖，仅标准库
- 被 `server/handlers/`、`server/resp/`、`op/` 等模块引用
