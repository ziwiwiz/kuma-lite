# ==== Builder ====
FROM golang:1.21-bullseye AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y gcc libc6-dev libsqlite3-dev && rm -rf /var/lib/apt/lists/*

COPY go.mod go.sum ./
RUN go mod download

COPY backend ./backend

# 构建（CGO + glibc）
RUN CGO_ENABLED=1 GOOS=linux go build \
    -ldflags="-s -w" \
    -o kuma-lite backend/main.go


# ==== Runtime ====
# 使用 glibc 版本的 Distroless，大幅瘦身但不会破坏 CGO
FROM gcr.io/distroless/base-debian12:nonroot

WORKDIR /app

# 拷贝二进制
COPY --from=builder /app/kuma-lite /app/kuma-lite

# 拷贝静态资源
COPY static /app/static

# 创建数据目录
RUN mkdir -p /data
VOLUME ["/data"]

ENV DB_PATH=/data/kuma-lite.db

EXPOSE 8080

USER nonroot

ENTRYPOINT ["/app/kuma-lite"]

