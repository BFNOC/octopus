# Review

## Summary

- Root cause confirmed: root `Dockerfile` built the frontend without `NEXT_PUBLIC_APP_VERSION`, so `web/src/lib/info.ts` fell back to `unknown` while the backend still reported `conf.Version`.
- Final fix kept scope to two files: `Dockerfile` and `web/src/components/modules/setting/Info.tsx`.

## Validation

- `cd web && NEXT_PUBLIC_APP_VERSION=v0.9.20-fork.12 pnpm run build` ✅
- `cd web && pnpm lint` ✅
- Built assets contain `v0.9.20-fork.12`:
  - `web/out/_next/static/chunks/90d80c1a0632b728.js`
  - `web/.next/server/chunks/ssr/src_components_modules_setting_index_tsx_396e71c6._.js`
- `docker build --build-arg VERSION=v0.9.20-fork.12 --build-arg COMMIT=test-commit -t octopus:version-fix-test .` ❌
  - Blocked by Docker Hub auth/network reset while pulling base images, not by a Dockerfile syntax or build-step failure.

## External Reviews

- Antigravity reviewer: approve, no findings on final diff.
- Claude reviewer: approve, no findings on final diff.
