# server/router/ - 自定义路由框架

> 导航：[根目录](../../../CLAUDE.md) > internal > [server](../CLAUDE.md) > **router**

## 职责

在 Gin 之上提供 **链式注册 + 全局收集** 的路由抽象：每个 handler 文件用 `init()` 注册自己的 `GroupRouter`，框架在启动时一次性挂载。

## 公开 API

```go
router.NewGroupRouter("/api/v1/channels").
    Use(middleware.Auth()).
    AddRoute(&router.Route{Method: "GET",  Path: "",    Handler: listChannels}).
    AddRoute(&router.Route{Method: "POST", Path: "",    Handler: createChannel}).
    AddRoute(&router.Route{Method: "DELETE", Path: "/:id", Handler: deleteChannel})
```

| 符号 | 说明 |
|------|------|
| `NewGroupRouter(path string) *GroupRouter` | 创建并自动登记到全局表 |
| `(*GroupRouter).Use(mw ...gin.HandlerFunc)` | 链式追加中间件 |
| `(*GroupRouter).AddRoute(r *Route)` | 链式追加路由 |
| `MountAll(engine *gin.Engine)` | 由 `server.go` 调用，把全局表挂载到 Gin |
| `Route` | 路由定义结构体：`Method`、`Path`、`Handler`、可选中间件 |

## 关键文件

| 文件 | 职责 |
|------|------|
| `router.go` | `GroupRouter`、`Route`、全局注册表、挂载逻辑 |

## 依赖关系

- `github.com/gin-gonic/gin` - 底层引擎
- 被所有 `server/handlers/*.go` 通过 `init()` 使用

## 上游同步注意事项

- 此模块为基础设施，**禁止修改** `NewGroupRouter` / `Route` 的现有签名
- 新功能（如路由元数据、OpenAPI 导出）通过扩展字段或新方法实现
