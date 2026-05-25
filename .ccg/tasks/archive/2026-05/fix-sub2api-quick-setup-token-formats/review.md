# Review

## Superseded scope note

本轮审查发生在只补 Sub2API access token + refresh token + timestamp 后。
用户随后扩大范围为“其他平台也参考 metapi 实现”，因此本文件先记录阶段性审查结果，后续完成扩展范围后需要重新双模型审查。

## Antigravity reviewer

- Verdict: APPROVE.
- Critical: none.
- Warning: none.
- Info: `Step1AddSite.tsx` 中 `refreshToken` / `tokenExpiresAt` 在切换到 API Key 后仍保留在组件 state；提交逻辑会过滤，不构成功能或安全问题，可作为 UX polish 清理。

## Claude reviewer

- Critical: none.
- Major:
  - `Step1AddSite.tsx` duplicate-site detection 在检测时返回 `""`，调用方只能看到“无法识别平台”式流程信号；这是重复站点检测脏改动相关，不是 Sub2API token 字段核心问题。
  - `Step1AddSite.tsx` submit guard 在 `submitting || isSitesLoading || detectingUrl` 时静默返回，用户可能无反馈。
- Minor:
  - `site-token.ts` 秒/毫秒阈值对 JWT exp 合理，placeholder 已说明。
  - Label 隐式关联符合现有表单模式。

## Local validation already passed

- `cd web && pnpm lint`
- `cd web && pnpm exec tsc --noEmit`
- `cd web && pnpm build`

## Final expanded-scope review

Scope:

- `web/src/components/modules/wizard/Step1AddSite.tsx`
- `web/src/components/modules/site/index.tsx`
- `web/src/lib/site-token.ts`

Local validation after expanded username/password support and reviewer disposition:

- `cd web && pnpm lint`
- `cd web && pnpm exec tsc --noEmit`
- `cd web && pnpm build`

Antigravity reviewer:

- Verdict: APPROVE.
- Critical: none.
- Warning: none.
- Info: confirms platform credential mappings match requirements, inactive fields are filtered before payload submission, and shared `parseTokenExpiresAtInput` removes duplicate parsing logic.

Claude reviewer:

- Critical: none.
- Major:
  - Switching away from Sub2API AccessToken cleared `refreshToken` / `tokenExpiresAt` draft state; fixed by preserving those fields on credential-type toggles and still filtering them from non-Sub2API payloads.
  - Suggested submitting `refresh_token` / `token_expires_at` unconditionally for future platform symmetry; not adopted because both the user-specified metapi reference and current quick-setup requirement only expose/pass these fields for Sub2API session credentials.
- Minor:
  - Username/password description may be clarified later; current backend sync path does log in with username/password to resolve a managed access token.
  - Main token state can persist across platform switches but is excluded from username/password payloads; no functional leak.
  - Claimed seconds/milliseconds threshold would misclassify `1748000000`; rejected as incorrect because values below `1_000_000_000_000` are treated as seconds and multiplied to milliseconds.
