# utils/log/ - 结构化日志

> 导航：[根目录](../../../CLAUDE.md) > internal > utils > **log**

## 职责

基于 Zap 的全局结构化日志。支持 console/json 两种输出格式，运行时动态调整日志级别。

## 关键文件

| 文件 | 职责 |
|------|------|
| `log.go` | `Configure(cfg)`：初始化日志；`SetLevel(level)`：运行时调级；`Infof/Warnf/Errorf/Debugf`：格式化日志；`Infow/Warnw/Errorw/Debugw`：结构化 KV 日志 |

## 配置

| 字段 | 说明 |
|------|------|
| `Level` | 日志级别 (debug/info/warn/error) |
| `Format` | 输出格式 (console/json) |
| `Caller` | 是否包含调用者信息 |
| `StacktraceLevel` | 触发堆栈追踪的级别 |

## 依赖关系

- `go.uber.org/zap` - 底层日志框架
- 被所有模块广泛引用
