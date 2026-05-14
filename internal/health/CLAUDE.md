# health/ - 通道健康状态管理

## 职责
基于请求成功率的通道健康状态机，驱动 relay 的通道选择决策。

## 状态机

```
Active (活跃) → Penalized (受罚) → Recovering (恢复中) → Quarantined (隔离)
     ↑                                                        |
     └────────────────── 恢复成功 ──────────────────────────────┘
```

- **Active**: 正常服务，无惩罚
- **Penalized**: 因连续失败被降权
- **Recovering**: 从惩罚状态逐步恢复
- **Quarantined**: 严重故障，暂时不可用

## 关键文件

| 文件 | 职责 |
|------|------|
| `state.go` | 状态定义 + `DeriveHealthState` 状态推导逻辑 |
| `classifier.go` | 信号分类器：将请求结果转为健康信号 |
| `buffer.go` | 环形缓冲区：滑动窗口统计近期成功率 |
| `dashboard.go` | 健康仪表盘：`ListChannelHealthStates` 汇总所有通道状态 |

## 依赖
- 被 `relay/` 查询以做通道选择
- 被 `server/handlers/health.go` 暴露给前端
