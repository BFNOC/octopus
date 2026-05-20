# op/ - 业务逻辑层 (Service)

> 导航：[根目录](../../CLAUDE.md) > internal > **op**

## 职责

封装所有业务逻辑，是 Handler 与 DB/Cache 之间的唯一中间层。Handler 必须通过 `op/` 访问数据，不得直接操作 `db/` 或 `model/`。

包含：
- DB CRUD 封装
- 内存缓存（运行时加载 + 关机持久化）
- 跨实体的业务规则（如分组健康聚合、站点绑定）

## 关键入口

| 符号 | 说明 |
|------|------|
| `InitCache() error` | 启动时把 DB 数据加载到内存缓存（setting / channel / group / apikey / llm / site_price / stats） |
| `SaveCache() error` | 关机时把脏缓存回写 DB |
| `UserInit() error` | 首次启动创建默认管理员 |

## 关键文件

| 文件 | 职责 |
|------|------|
| `cache.go` | 缓存初始化与持久化编排（`InitCache`、`SaveCache`） |
| `setting.go` | Setting KV 缓存读写（被几乎所有模块使用） |
| `channel.go` | Channel CRUD + 缓存 |
| `channel_filter.go` | 通道过滤规则 |
| `group.go` | Group CRUD + 缓存 |
| `group_snapshot.go` | 分组配置快照 |
| `group_health.go` | 分组聚合健康状态 |
| `apikey.go` | API Key 管理（生成 `sk-octopus-*`、校验、配额） |
| `apikey_filter.go` | API Key 过滤规则 |
| `user.go` | 用户管理（登录、密码） |
| `llm.go` | LLM 模型元数据缓存（来自 `price/`） |
| `site.go` | 站点 CRUD |
| `site_binding.go` | 站点-通道绑定关系 |
| `site_channel.go` | 站点通道管理 |
| `site_channel_errors.go` | 站点通道错误类型 |
| `site_import.go` | 站点导入 |
| `site_import_errors.go` | 站点导入错误类型 |
| `site_price.go` | 站点价格 |
| `probe.go` | 探活结果存取 |
| `log.go` | 请求日志写入 |
| `stats.go` | 全局统计 |
| `stats_site_model.go` | 站点-模型维度统计 |
| `stats_site_model_backfill.go` | 历史统计回填（异步） |
| `balancer_state.go` | 负载均衡器状态持久化 |
| `backup.go` | 备份导入/导出 |

## 缓存模式

- 数据加载到内存（`utils/cache` 分片缓存）；读路径走缓存，写路径双写 DB + 缓存
- 启动顺序敏感：setting → channel → group → apikey → llm → site_price → stats（见 `cache.go`）

## 依赖关系

- `internal/db` - 持久化
- `internal/model` - 数据结构
- `internal/utils/cache` - 分片缓存
- 被 `server/handlers/`、`relay/`、`sitesync/`、`task/` 调用

## 上游同步注意事项

- 新增业务函数优先创建新文件（如 `xxx_ext.go`）或新方法，避免修改上游已有函数签名
- 缓存初始化顺序如有变化，必须更新 `cache.go` 并保证依赖顺序
