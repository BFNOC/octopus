# utils/snowflake/ - ID 生成器

> 导航：[根目录](../../../CLAUDE.md) > internal > utils > **snowflake**

## 职责

基于毫秒时间戳的唯一 ID 生成器。同一毫秒内多次调用时递增，保证全局唯一。

## 关键文件

| 文件 | 职责 |
|------|------|
| `snowflake.go` | `GenerateID() int64`：线程安全的 ID 生成 |

## 依赖关系

- 无外部依赖
