# helper/ - 通用辅助工具

> 导航：[根目录](../../CLAUDE.md) > internal > **helper**

## 职责

跨模块共享的通用辅助函数。与 `utils/` 的区别：`helper/` 偏业务领域（通道、价格、延迟），`utils/` 偏纯技术工具（缓存、日志、字符串）。

## 关键文件

| 文件 | 职责 |
|------|------|
| `channel.go` | 通道相关辅助：URL 拼接、Key 解析、模型匹配 |
| `fetch.go` | HTTP 抓取封装（带超时、重试、UA） |
| `fetch_test.go` | fetch 单元测试 |
| `price.go` | 价格计算辅助（按 token / 按字符） |
| `delay.go` | 延迟与退避策略 |
| `delay_test.go` | delay 单元测试 |

## 依赖关系

- `internal/client` - HTTP 客户端
- `internal/model` - 通道与价格模型
- 被 `relay/`、`sitesync/`、`probe/`、`task/` 引用
