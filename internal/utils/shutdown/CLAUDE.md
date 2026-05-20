# utils/shutdown/ - 优雅关机

> 导航：[根目录](../../../CLAUDE.md) > internal > utils > **shutdown**

## 职责

优雅关机管理：注册清理函数，监听系统信号 (SIGINT/SIGTERM/SIGHUP)，按 LIFO 顺序执行清理。

## 关键文件

| 文件 | 职责 |
|------|------|
| `shutdown.go` | `Init(log)`：初始化；`Register(fn)`：注册清理函数；`Listen()`：阻塞监听信号并执行清理；`Shutdown()`：主动触发清理 |

## 公开接口

| 函数 | 说明 |
|------|------|
| `Init(log)` | 初始化日志实例 |
| `Register(fn)` | 注册清理函数，按 LIFO 顺序执行 |
| `Listen()` | 阻塞等待退出信号，执行所有清理函数后 `os.Exit(0)` |
| `Shutdown()` | 手动触发关机流程（不退出进程） |

## 依赖关系

- 无外部依赖，通过 `logger` 接口注入日志
