# Review

## 实现摘要

- 新增 `internal/upstreamerr` 统一识别余额不足、预扣费失败、账号额度不足与 key 额度不足。
- relay 失败链路命中账号级额度不足时，自动禁用托管站点账号并重新投影 managed channels；命中通用 key 额度不足时，禁用触发错误的 channel key，并在托管渠道中禁用对应源 `SiteToken`。
- 同步合并保留已禁用的 ready token，避免下一次站点同步把自动禁用状态重新打开。
- 临时 rate limit/RPM/TPM/per-minute quota 文案不会被识别为永久额度耗尽。

## 验证

- `go test ./internal/upstreamerr ./internal/health ./internal/op ./internal/sitesync ./internal/relay`
- `go test ./...`

## 双模型审查

- 初审：Antigravity 和 Claude 均指出需要修正 sitesync disabled token 继承、cache/balancer 刷新与 rate-limit 误禁边界。
- 复审：修复后两轮双模型审查均完成；最终 Antigravity 与 Claude 均为 `APPROVE`，无 Critical 阻塞问题。

## 已处理反馈

- `ChannelKeyEnabled` 重复禁用时不再因 `RowsAffected=0` 跳过缓存刷新和 balancer reset。
- `quota exceeded` 在包含 `rate limit`、`per minute`、`rpm`、`tpm` 等临时限流信号时不会触发永久禁用。
- 补充账号级与 key 级自动禁用集成测试。
- quota 信号优先于降级 exclusion，避免明确额度错误被 `token limit` 等文本压制。
