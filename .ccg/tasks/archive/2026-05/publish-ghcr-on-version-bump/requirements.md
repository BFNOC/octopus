# Publish GHCR Image Only After Version Bump

## User Request

Update the GitHub Actions release flow so GitHub builds and publishes the Docker
image to GitHub Container Registry only after a version bump, instead of on every
push.

## Working Interpretation

- Version truth source for this fork is `internal/conf/version.go`.
- A version bump is a push that changes `internal/conf/version.go`.
- The target registry is GHCR (`ghcr.io`).
- Avoid Docker Hub publishing unless explicitly requested.
- Build and publish only `linux/amd64`; remove other release platforms and
  extra image variants because this fork is for personal use.
- Treat `dev` as the release branch for this fork so a later `master` push does
  not republish the same version or move the `latest` image tag.
- Keep existing unrelated working tree changes untouched.

## Analysis Outcome

- Prefer path-triggered publish over tag-triggered publish because the local fork
  workflow bumps `internal/conf/version.go` directly.
- Ensure the build script uses the bumped version instead of the latest git tag;
  otherwise fork builds can be tagged correctly in GHCR while embedding an older
  upstream tag in the binary.
- Allow `build/docker/**` through `.dockerignore` because the release workflow
  builds the binary before the Docker image and `Dockerfile.debian` copies that
  prebuilt binary from the Docker context.
