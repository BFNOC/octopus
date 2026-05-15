#!/bin/bash
set -e

# 从 version.go 读取版本号
VERSION=$(sed -n 's/.*Version.*= *"\([^"]*\)".*/\1/p' internal/conf/version.go)
COMMIT=$(git rev-parse --short HEAD)

echo "Version: $VERSION"
echo "Commit:  $COMMIT"

docker buildx build \
    --platform linux/amd64 \
    -t hfxmci/octopus:latest \
    -t "hfxmci/octopus:${VERSION}" \
    --build-arg VERSION="${VERSION}" \
    --build-arg COMMIT="${COMMIT}" \
    --push \
    .
