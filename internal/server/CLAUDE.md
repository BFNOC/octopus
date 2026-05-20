# server/ - HTTP 服务层

> 导航：[根目录](../../CLAUDE.md) > internal > **server**

## 职责

启动 Gin HTTP 服务器、注册中间件、装配路由、提供静态文件。聚合 `handlers/`、`middleware/`、`router/`、`auth/`、`resp/` 五个子模块。

## 入口与公开接口

| 符号 | 说明 |
|------|------|
| `Start() error` | 启动 HTTP Server（绑定监听地址，注册所有路由） |
| `Close() error` | 优雅关闭（注册到 shutdown） |

## 关键文件

| 文件 | 职责 |
|------|------|
| `server.go` | Gin 引擎构建、Mode 切换、gzip、静态文件挂载、路由汇总、Server 启停 |

## 子模块

| 子模块 | 职责 | 详细文档 |
|--------|------|----------|
| `handlers/` | HTTP 请求处理器（按资源分文件） | [./handlers/CLAUDE.md](./handlers/CLAUDE.md) |
| `middleware/` | Auth/CORS/Logger/Static/Validate 中间件 | [./middleware/CLAUDE.md](./middleware/CLAUDE.md) |
| `router/` | 自定义路由框架（链式注册：`NewGroupRouter().Use().AddRoute()`） | [./router/CLAUDE.md](./router/CLAUDE.md) |
| `auth/` | JWT 与 API Key 校验 | [./auth/CLAUDE.md](./auth/CLAUDE.md) |
| `resp/` | 统一响应格式 `{code, message, data}` 与错误码 | [./resp/CLAUDE.md](./resp/CLAUDE.md) |

## 启动流程（与 cmd/start.go 协作）

```
cmd/start.go: server.Start()
    ↓
server.go: 构建 Gin → 注册全局中间件 → 从 router 注册表批量挂载路由
    ↓
handlers/ init() 阶段已通过 NewGroupRouter 注册了所有路由
    ↓
监听端口（conf.AppConfig.Server.Host:Port）
```

## 依赖关系

- `internal/conf` - 端口、Mode
- `internal/op` - 间接（通过 handlers 调用）
- `static/` 包 - 嵌入的前端构建产物
- `github.com/gin-gonic/gin` - Web 框架

## 上游同步注意事项

- `server.go` 本体尽量不改，新增中间件/路由通过 `handlers/` 子模块的 `init()` 注入
- 新增中间件放在 `middleware/` 新文件中
