# task/ - 后台定时任务

> 导航：[根目录](../../CLAUDE.md) > internal > **task**

## 职责

调度后台周期性任务：统计持久化、站点同步、价格刷新、过期清理。

## 关键文件

| 文件 | 职责 |
|------|------|
| `init.go` | `Init()` 注册所有任务到调度器 |
| `task.go` | `RUN()` 主循环，调度并执行已注册任务 |
| `channel.go` | 通道相关定时任务（健康聚合、状态持久化） |
| `sync.go` | 站点账户/价格定时同步（委托 `sitesync/`） |
| `site.go` | 站点级定时任务（签到、项目同步） |
| `cleanup.go` | 过期数据清理（日志、统计、临时文件） |

## 调度入口

```
cmd/start.go: task.Init() → safe.Go("task-runner", task.RUN)
```

## 依赖关系

- `internal/op` - 业务逻辑调用
- `internal/sitesync` - 站点同步
- `internal/price` - 价格刷新
- `internal/utils/safe` - 安全 goroutine 启动

## 上游同步注意事项

- 新增任务在新文件中注册，避免修改 `init.go` 之外的已有调度文件
- 频率/超时通过配置或 Setting 控制，避免硬编码
