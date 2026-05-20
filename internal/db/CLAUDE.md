# db/ - 数据库层

> 导航：[根目录](../../CLAUDE.md) > internal > **db**

## 职责

GORM 数据库连接管理与迁移调度。支持 SQLite（默认）/ MySQL / PostgreSQL 三种驱动。

## 入口与公开接口

| 符号 | 说明 |
|------|------|
| `InitDB(dbType, path string, debug bool) error` | 初始化数据库连接并运行迁移 |
| `Close() error` | 关闭数据库连接（注册到 shutdown） |
| `DB()` *gorm.DB | 获取全局 GORM 实例（供 `op/` 使用） |

## 关键文件

| 文件 | 职责 |
|------|------|
| `db.go` | 连接初始化、驱动选择、迁移调用 |
| `migrate/migrate.go` | 迁移调度入口，按版本顺序执行 |
| `migrate/00X.go` | 单个版本的迁移逻辑（schema 变更 + 数据迁移），编号递增 |
| `migrate/00X_test.go` | 迁移测试，验证升级幂等性与回滚行为 |

## 子模块

- `migrate/` - 数据库 schema 迁移，编号 `001` ~ `011`（截至当前）

## 依赖关系

- `gorm.io/gorm` + 三种驱动 (`sqlite`、`mysql`、`postgres`)
- `internal/conf` - 读取数据库类型与路径
- `internal/model` - 注册 GORM 模型用于 AutoMigrate

## 上游同步注意事项

- 新增迁移必须递增编号（不复用已发布的编号）
- 迁移内只做 schema 变更与必要的数据补齐，业务逻辑放在 `op/`
