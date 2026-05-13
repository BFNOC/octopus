## Stage 1: Build frontend
FROM node:22-alpine AS frontend
WORKDIR /app/web
COPY web/package.json web/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm run build

## Stage 2: Build backend
FROM golang:1.25-alpine AS backend
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /app/web/out/ ./static/
ARG VERSION=v1.0.0-bfnoc
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
