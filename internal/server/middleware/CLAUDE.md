# server/middleware/ - Gin 中间件

> 导航：[根目录](../../../CLAUDE.md) > internal > [server](../CLAUDE.md) > **middleware**

## 职责

提供 Gin 中间件：认证、CORS、日志、静态文件、参数校验。

## 关键文件

| 文件 | 中间件 | 说明 |
|------|--------|------|
| `auth.go` | `Auth()` | 管理面板 JWT 验证；`AuthAPIKey()` 验证 `sk-octopus-*` |
| `cors.go` | `CORS()` | 根据 Setting 中 CORS 配置动态设置允许的源 |
| `logger.go` | `Logger()` | 请求日志（路径、状态、耗时） |
| `static.go` | `Static()` | 服务嵌入的前端构建产物（`static/` 包） |
| `validate.go` | `Validate(...)` | 通用参数校验封装（基于 binding 标签） |

## 注册顺序

`server.go` 注册全局中间件顺序：CORS → Logger → Static（路由命中前）。Auth 在具体路由组上按需 `Use`。

## 依赖关系

- `internal/op` - 读取 Setting（CORS、JWT 配置）
- `internal/server/auth` - JWT 解析
- `internal/utils/log` - 结构化日志

## 上游同步注意事项

- 新中间件放新文件，不修改 `auth.go`/`cors.go` 等已有中间件的签名
- 通过 `Use(...)` 在路由组层叠加，避免改全局注册顺序
