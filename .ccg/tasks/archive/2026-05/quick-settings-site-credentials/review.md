# Review

## External review

- Round 1: Antigravity and Claude found URL detection race/stale overwrite risks, swallowed `refetchChannels` errors, and credential type coupling.
- Round 2: Claude approved the fixes. Antigravity found one remaining UX warning: a pending blur-triggered no-feedback detection could suppress toast feedback when the user immediately clicked the manual detect button.
- Round 3: Antigravity and Claude both approved. No remaining Critical or Warning findings.

## Disposition

- Fixed URL detection concurrency by reusing same-URL pending detection promises and guarding stale completions with run IDs, current URL refs, and platform selection version refs.
- Fixed stale auto-detection overwrites by preventing completed detection requests from applying after the user manually changes platform.
- Fixed suppressed manual detect feedback by allowing a later explicit detect click to upgrade an existing pending detection to feedback mode.
- Fixed channel refetch error handling by checking `result.isError` and surfacing the error through the existing sync error UI.
- Fixed wizard credential type coupling by reusing `SiteCredentialType` as the store type.
- Rejected the first Claude claim that frontend key creation did not resync: existing backend `CreateAccountToken` calls `SyncAccount(ctx, accountID)` after creating the target-site key.

## Validation

- `pnpm exec tsc --noEmit` from `web`: passed.
- `pnpm exec eslint src/components/modules/wizard/Step1AddSite.tsx src/components/modules/wizard/Step2Sync.tsx src/components/modules/wizard/store.ts` from `web`: passed.
- `pnpm build` from `web`: passed.
- `go test ./internal/sitesync ./internal/server/handlers ./internal/op`: passed.
