# db/migrate/ - 数据库迁移

> 导航：[根目录](../../../CLAUDE.md) > internal > [db](../CLAUDE.md) > **migrate**

## 职责

版本化的数据库 schema 迁移。迁移分为 BeforeAutoMigrate（GORM AutoMigrate 之前）和 AfterAutoMigrate（之后）两个阶段，通过 `MigrationRecord` 表记录执行状态，保证幂等性。

## 关键文件

| 文件 | 职责 |
|------|------|
| `migrate.go` | 迁移框架：注册、排序、去重、按版本执行、状态记录 (upsert) |
| `001.go` ~ `013.go` | 各版本迁移逻辑（schema 变更 + 数据补齐） |
| `proxy_pool.go` | 代理池相关迁移 |
| `group_health_probe_mode.go` | 分组健康探测模式迁移 |
| `*_test.go` | 迁移测试（004~007, 010, group_health_probe_mode） |

## 公开接口

| 函数 | 说明 |
|------|------|
| `RegisterBeforeAutoMigration(m)` | 注册 AutoMigrate 前执行的迁移 |
| `RegisterAfterAutoMigration(m)` | 注册 AutoMigrate 后执行的迁移 |
| `BeforeAutoMigrate(db)` | 执行所有 Before 迁移 |
| `AfterAutoMigrate(db)` | 执行所有 After 迁移 |

## 规范

- 编号严格递增，不复用已发布的编号
- 迁移只做 schema 变更与必要的数据补齐
- 每个迁移通过 `MigrationRecord` 表保证幂等
