## Stage 1: Build frontend
FROM node:22-alpine AS frontend
WORKDIR /app/web
COPY web/package.json web/pnpm-lock.yaml ./
RUN corepack enable && \
    pnpm config set registry https://registry.npmmirror.com && \
    pnpm install --frozen-lockfile --ignore-scripts && \
    pnpm rebuild @swc/core sharp unrs-resolver
COPY web/ ./
RUN pnpm run build

## Stage 2: Build backend
FROM golang:1.25-alpine AS backend
WORKDIR /app
COPY go.mod go.sum ./
RUN go env -w GOPROXY=https://goproxy.cn,direct && \
    go mod download
COPY . .
COPY --from=frontend /app/web/out/ ./static/out/
ARG VERSION=v0.9.20-fork.12
ARG COMMIT=unknown
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w \
  -X 'github.com/bestruirui/octopus/internal/conf.Version=${VERSION}' \
  -X 'github.com/bestruirui/octopus/internal/conf.Commit=${COMMIT}' \
  -X 'github.com/bestruirui/octopus/internal/conf.BuildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)'" \
  -o octopus .

## Stage 3: Runtime
FROM alpine:3.20
ENV TZ=Asia/Shanghai
RUN apk add --no-cache ca-certificates tzdata && \
    mkdir -p /app/data
COPY --from=backend /app/octopus /app/octopus
WORKDIR /app
EXPOSE 8080
CMD ["./octopus", "start"]
