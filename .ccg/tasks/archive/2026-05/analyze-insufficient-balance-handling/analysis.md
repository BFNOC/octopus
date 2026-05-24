# Analysis

## Question

当上游账号或渠道请求返回余额不足、额度耗尽、`insufficient_quota`、`billing` 等错误时，程序是否会熔断、如何恢复、用户是否能看到提示。

## Findings

- 余额/额度相关错误会通过文本匹配归类为硬失败：`internal/health/classifier.go` 匹配 `billing`、`insufficient_quota`；`internal/relay/degrade.go` 也将这些信号作为 forbidden 降级信号。
- 熔断粒度是 `channelID:keyID:modelName`，不是站点或站点账号级别。普通请求在同通道重试结束后调用 `balancer.RecordFailure(...)`，硬失败连续达到阈值后进入 Open。
- 默认阈值是连续 5 次失败，基础冷却 60 秒，最大冷却 600 秒，按 trip count 指数退避。
- 冷却期到期后下一次请求会懒迁移到 HalfOpen，只放行一个试探请求。成功则 Closed；失败则回 Open 并延长冷却。
- 健康状态是独立内存态。一次硬失败即可让通道健康状态显示为 `quarantined`，但这不等于熔断器已经达到 5 次阈值。
- 不会自动永久禁用站点、站点账号或渠道。通道编辑、删除、分组变更等操作会清理对应通道的内存熔断状态。
- 普通 HTTP relay 的客户端响应通常是泛化的 `channel failed`；详细上游错误会记录在请求日志和 attempts 中。部分 WS/连续会话路径会把 quota 类错误转为 `upstream_quota_exceeded` 和中文提示。

## Verification

- `go test ./internal/relay ./internal/relay/balancer ./internal/health`: passed
- 双模型只读分析：antigravity 与 claude 均确认核心链路；本记录采用本地读码结论为准。
