# sitesync/ - 站点同步核心

> 导航：[根目录](../../CLAUDE.md) > internal > **sitesync**

## 职责
与外部 LLM 站点 API 同步：账户信息、模型列表、定价、余额、签到、项目管理。

## 关键文件

| 文件 | 职责 |
|------|------|
| `core.go` | 核心同步逻辑：`SyncAccount`, `CheckinAccount`, `ProjectAccount`, `ProjectSite`；`eligibleCheckinAccounts` 过滤 `paid` 站点 |
| `sync.go` | 同步编排：`SyncAll`, 批量同步 |
| `sync_fetch.go` | 同步数据拉取：从站点 API 获取账户/模型/价格数据 |
| `storage.go` | 同步结果持久化到数据库 |
| `schedule.go` | 同步调度：定时同步策略；`RefreshAccountRandomCheckinSchedule` 对 `paid` 站点清空签到调度 |
| `detect.go` | 站点类型探测：自动识别站点 API 格式 |
| `http.go` | 站点 HTTP 客户端封装 |
| `pricing.go` | 价格同步逻辑 |
| `balance.go` | 余额查询与同步 |
| `project.go` | 项目管理：模型分组投影 |
| `create_key.go` | API Key 创建/管理 |
| `anyrouter.go` | AnyRouter 站点适配 |
| `sub2api_auth.go` | Sub2API 认证适配 |
| `route_probe.go` | 路由探测：测试站点 API 可达性 |
| `stub.go` | Stub 实现 |
| `errors.go` | 错误类型定义 |
| `sync_result.go` | 同步结果数据结构 |

## site_type 过滤逻辑

### 签到过滤 (`core.go`: `eligibleCheckinAccounts`)
- 遍历站点列表时，`SiteType == "paid"` 的站点整体跳过（其下所有账户均不参与批量签到）
- 仅 `free` 站点（或未设置 site_type 的站点）的启用且开启 auto_checkin 的账户进入签到队列

### 签到调度 (`schedule.go`: `RefreshAccountRandomCheckinSchedule`)
- 当账户所属站点为 `paid` 类型时，直接将 `next_auto_checkin_at` 设为 `nil`（清空调度）
- 防止 paid 站点的账户残留过期的签到计划

## 数据流

```
定时任务 (task/) -> SyncAll -> SyncAccount (per site)
    -> http.go 拉取站点数据
    -> sync_fetch.go 解析响应
    -> storage.go 持久化到 DB
    -> pricing.go 同步价格
```

## 依赖
- `op/` - 站点/通道 CRUD
- `model/` - 数据模型
- `client/` - HTTP 客户端

## 变更记录 (Changelog)

| 日期 | 变更 |
|------|------|
| 2025-05-21 | `eligibleCheckinAccounts` 新增 `SiteTypePaid` 过滤；`RefreshAccountRandomCheckinSchedule` 对 `paid` 站点清空签到调度 |
