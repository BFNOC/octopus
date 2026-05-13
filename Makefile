VERSION    := $(shell git describe --tags --abbrev=0 2>/dev/null || echo "v1.0.0-bfnoc")
COMMIT     := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_TIME := $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
AUTHOR     := BFNOC

LDFLAGS := -s -w \
  -X 'github.com/bestruirui/octopus/internal/conf.Version=$(VERSION)' \
  -X 'github.com/bestruirui/octopus/internal/conf.Commit=$(COMMIT)' \
  -X 'github.com/bestruirui/octopus/internal/conf.BuildTime=$(BUILD_TIME)' \
  -X 'github.com/bestruirui/octopus/internal/conf.Author=$(AUTHOR)'

.PHONY: build run clean go

# 完整构建：前端 + 后端
build: static/out/index.html go

# 只构建 Go 后端（前端没变时用这个）
go:
	CGO_ENABLED=0 go build -ldflags="$(LDFLAGS)" -tags=jsoniter -o octopus .

# 前端：只在源码变更时重建
static/out/index.html: $(shell find web/src web/public web/package.json web/pnpm-lock.yaml web/next.config.ts web/tsconfig.json -type f 2>/dev/null)
	@echo "==> frontend changed, rebuilding..."
	cd web && pnpm install && pnpm run build
	rm -rf static/out
	cp -r web/out static/out

run: build
	./octopus start

clean:
	rm -rf octopus build/ static/out/ web/out/
