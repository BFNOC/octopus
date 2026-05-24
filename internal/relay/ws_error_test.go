package relay

import "testing"

func TestIsUpstreamQuotaErrorMatchesUserQuota(t *testing.T) {
	if !isUpstreamQuotaError(`{"code":"insufficient_user_quota","message":"预扣费额度失败, 用户剩余额度不足"}`) {
		t.Fatal("expected insufficient_user_quota prepay failure to be treated as upstream quota")
	}
	if isUpstreamQuotaError("rate_limit_exceeded: too many requests") {
		t.Fatal("did not expect plain rate limit to be treated as upstream quota")
	}
}
