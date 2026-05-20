# utils/safe/ - 安全执行工具

> 导航：[根目录](../../../CLAUDE.md) > internal > utils > **safe**

## 职责

Goroutine panic 恢复工具：确保 goroutine 内的 panic 被捕获并记录日志，不导致进程崩溃。

## 关键文件

| 文件 | 职责 |
|------|------|
| `safe.go` | `Go(name, fn)`：在新 goroutine 中安全执行 fn；`Run(name, fn)`：同步安全执行；`RecoverHandler(name, onPanic)`：返回 defer 用的恢复函数 |

## 公开接口

| 函数 | 说明 |
|------|------|
| `Go(name, fn)` | 启动带 panic 恢复的 goroutine |
| `Run(name, fn)` | 同步执行带 panic 恢复 |
| `RecoverHandler(name, onPanic)` | 生成 defer 恢复函数，可选回调 |

## 依赖关系

- `utils/log` - 日志记录
