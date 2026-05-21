# model/ - 数据模型

> 导航：[根目录](../../CLAUDE.md) > internal > **model**

## 职责

定义所有 GORM 持久化模型与跨模块共享的数据结构体。不包含业务逻辑（业务逻辑在 `op/`）。

## 主要模型

| 文件 | 模型 / 关键类型 |
|------|------|
| `user.go` | `User`（管理员账户、密码哈希） |
| `apikey.go` | `APIKey`（`sk-octopus-*` 格式，状态、配额） |
| `apikey_filter.go` | `APIKeyFilter`（白名单/黑名单规则） |
| `channel.go` | `Channel`（LLM 通道：URL、Key、模型列表、权重） |
| `channel_filter.go` | `ChannelFilter`（通道过滤规则） |
| `group.go` | `Group`（通道分组：负载均衡策略、亲和） |
| `group_health.go` | `GroupHealth`（分组聚合健康状态） |
| `group_snapshot.go` | `GroupSnapshot`（分组配置快照，用于回滚） |
| `site.go` | `Site`（外部 LLM 站点）、`SiteType` 枚举（`free`/`paid`）、`SiteAccount`、`SiteToken`、`SiteModel` 等 |
| `site_channel.go` | `SiteChannel`（站点同步出来的通道） |
| `site_import.go` | 站点导入元数据 |
| `site_price.go` | 站点价格快照 |
| `site_route_metadata.go` | 站点路由探测元数据 |
| `setting.go` | `Setting`（KV 设置：CORS、JWT secret 等） + `SettingKey*` 常量 |
| `probe.go` | 探活结果模型 |
| `log.go` | 请求日志模型 |
| `stats.go` | 统计数据模型 |
| `llm.go` | LLM 模型元数据（价格、能力） |
| `backup.go` | 备份/恢复数据结构 |

## Site 模型站点类型 (`SiteType`)

`Site` 结构体包含 `SiteType` 字段，用于区分免费站点与付费站点：

| 枚举值 | 含义 | 行为影响 |
|--------|------|---------|
| `free` (默认) | 免费站点 | 支持签到功能，签到调度正常执行 |
| `paid` | 付费站点 | 跳过签到（`eligibleCheckinAccounts` 过滤）、清空随机签到调度、前端隐藏签到相关 UI |

- `SiteType.Validate()` 校验枚举值合法性
- `Site.Normalize()` 在空值时回退为 `free`
- `SiteUpdateRequest` 包含可选 `SiteType` 指针字段，支持部分更新

## 公开接口约定

- 所有模型实现 GORM 标准（`ID`、`CreatedAt`、`UpdatedAt`）
- 跨进程序列化使用 JSON tag（前后端共用）
- `Setting` 模型存储运行时可变配置；通过 `op/setting.go` 读写并缓存

## 依赖关系

- `gorm.io/gorm` - 标签与 hook
- 被 `op/`、`db/migrate`、`server/handlers`、`relay/`、`sitesync/` 等广泛引用

## 上游同步注意事项

- **新增字段安全**：在已有结构体上加字段属于纯增量，可直接修改
- **新增模型**：在新文件中定义，命名遵循领域语义
- **不修改字段类型**：避免破坏上游迁移与序列化兼容性

## 变更记录 (Changelog)

| 日期 | 变更 |
|------|------|
| 2025-05-21 | 新增 `SiteType` 枚举（`free`/`paid`）及 `Site.SiteType` 字段、`SiteUpdateRequest.SiteType` 字段；`Normalize()` 支持空值回退 `free`；`Validate()` 链增加 `SiteType.Validate()` |
