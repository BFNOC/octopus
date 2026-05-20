# relay/bodycache/ - 请求体缓存

> 导航：[根目录](../../../CLAUDE.md) > internal > [relay](../CLAUDE.md) > **bodycache**

## 职责

可重放的请求体缓存：小体积（≤16MB）缓存在内存，大体积落盘临时文件。支持多次调用 `NewReader()` 重放请求体，用于重试场景。

## 关键文件

| 文件 | 职责 |
|------|------|
| `body_cache.go` | `BodyCache` 核心 + `spillWriter` 溢写策略 + 环境变量配置 + 临时文件清理 |

## 核心类型

| 类型 | 说明 |
|------|------|
| `BodyCache` | 缓存对象，`New(r)` 创建，`NewReader()` 获取可重放的 Reader，`Close()` 释放资源 |
| `BodyTooLargeError` | 超过最大限制时返回，上层可据此返回 413 |
| `spillWriter` | 内部溢写策略：先写内存 Buffer，超阈值后落盘 |

## 环境变量配置

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `OCTOPUS_IMAGES_BODY_MAX_MB` | 256 | 最大请求体 (MB) |
| `OCTOPUS_IMAGES_BODY_MEMORY_THRESHOLD_MB` | 16 | 内存阈值 (MB)，超过落盘 |
| `OCTOPUS_IMAGES_BODY_TMP_DIR` | `./cache` | 临时文件目录 |
| `OCTOPUS_IMAGES_BODY_TMP_CLEANUP_HOURS` | 24 | 启动时清理早于此时间的临时文件 |

## 依赖关系

- 无外部依赖，仅标准库
