# site/ - 站点服务门面

> 导航：[根目录](../../CLAUDE.md) > internal > **site**

## 职责

`sitesync/` 的薄包装/门面层。对外暴露站点同步、签到、项目管理的稳定接口，把实现委托给 `sitesync/`。

存在目的：解耦上层（`server/handlers`、`task/`）与具体同步实现，便于 `sitesync/` 内部重构而不影响调用方。

## 入口与公开接口

| 符号 | 说明 |
|------|------|
| `SyncAccount(ctx, accountID)` | 同步单个账户 |
| `CheckinAccount(ctx, accountID)` | 单账户签到 |
| `ProjectAccount(ctx, accountID)` | 账户级项目同步，返回站点 ID 列表 |
| `ProjectSite(ctx, siteID)` | 站点级项目同步 |
| `SyncAll(ctx)` | 全量同步 |
| `CheckinAll(ctx)` | 全量签到 |
| `RefreshAccountRandomCheckinSchedule(ctx, accountID)` | 刷新随机签到时间表（paid 站点自动清空调度） |
| `DeleteSite(ctx, siteID)` | 删除站点（包含级联清理） |

## 关键文件

| 文件 | 职责 |
|------|------|
| `service.go` | 全部公开函数；每个函数都是 `sitesync/` 对应函数的转发 |

## site_type 影响

`RefreshAccountRandomCheckinSchedule` 内部委托给 `sitesync/schedule.go`，当站点为 `paid` 类型时清空签到调度。门面层自身不做类型判断，逻辑在 `sitesync/` 中。

## 依赖关系

- `internal/sitesync` - 全部实际实现
- `internal/model` - 返回结果类型

## 上游同步注意事项

- 此模块作为稳定门面，新增接口先在 `sitesync/` 实现，再在 `service.go` 透出
- 不在此模块中包含业务逻辑

## 变更记录 (Changelog)

| 日期 | 变更 |
|------|------|
| 2025-05-21 | 文档补充 `RefreshAccountRandomCheckinSchedule` 对 `paid` 站点的清空调度行为说明 |
