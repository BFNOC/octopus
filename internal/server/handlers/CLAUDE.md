# server/handlers/ - HTTP 请求处理器

> 导航：[根目录](../../../CLAUDE.md) > internal > [server](../CLAUDE.md) > **handlers**

## 职责

接收 HTTP 请求，校验参数，调用 `op/` 或对应业务模块，返回统一格式响应。每个文件聚焦一类资源。

## 路由注册模式

每个文件在 `init()` 函数中通过 `router.NewGroupRouter(prefix).Use(mw).AddRoute(...)` 注册自己的路由。`server/server.go` 启动时统一读取全局注册表挂载到 Gin。

## 文件清单

| 文件 | 资源 / 端点 |
|------|------|
| `apikey.go` | API Key 管理（创建、列出、撤销） |
| `channel.go` | 通道 CRUD |
| `channel_filter.go` | 通道过滤规则 |
| `group.go` | 分组 CRUD |
| `group_health.go` | 分组健康聚合查询 |
| `health.go` | 通道健康状态查询 |
| `images.go` | 图片生成 API 代理 |
| `log.go` | 请求日志查询 |
| `model.go` | LLM 模型元数据 |
| `probe.go` | 模型探活触发与结果查询 |
| `relay.go` | LLM API 代理入口（`/v1/*` 等） |
| `setting.go` | 系统设置读写 |
| `site.go` | 站点 CRUD、签到、同步触发；`updateSite` 对 `site_type` 做预校验 (`Validate`) |
| `site_channel.go` | 站点通道（同步生成的通道）管理 |
| `stats.go` | 统计查询 |
| `tester.go` | 通道测试器（发送测试请求） |
| `update.go` | 自更新检查/触发 |
| `user.go` | 登录、密码修改 |
| `explain.go` | 错误诊断/解释 |
| `crud_errors.go` | CRUD 公共错误处理 |

## site_type 预校验

`site.go` 中的 `updateSite` handler 在调用 `op.SiteUpdate` 前，若请求包含 `site_type` 字段，先调用 `req.SiteType.Validate()` 检查枚举合法性，非法值返回 400。

## 依赖关系

- `internal/op` - 业务逻辑（**唯一允许的下层依赖**）
- `internal/server/router` - 路由注册
- `internal/server/resp` - 响应格式化
- `internal/server/auth` - JWT/APIKey 校验（通过 middleware）
- `internal/relay` - 仅 `relay.go`、`images.go` 引用
- `internal/site`、`internal/health`、`internal/probe`、`internal/update` - 各 handler 对应模块

## 编码约束

- Handler 内部 **不得** 直接访问 `db/` 或 `model/` 的存储方法
- 参数解析与校验在 handler 完成；业务规则下沉到 `op/`
- 所有响应使用 `resp.Success(c, data)` / `resp.Fail(c, code, msg)`

## 上游同步注意事项

- API 参数扩展（如 `model_names`、`prompt`、`delay_ms`）在 handler 层处理，**不改变底层 op/relay 接口签名**
- 新增 handler 放新文件，避免修改上游已有 handler 的核心分发逻辑

## 变更记录 (Changelog)

| 日期 | 变更 |
|------|------|
| 2025-05-21 | `updateSite` handler 新增 `site_type` 预校验（在 `op.SiteUpdate` 调用前验证枚举合法性） |
