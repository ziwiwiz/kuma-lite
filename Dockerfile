# ============================
# 1) 构建阶段（Go + CGO + sqlite）
# ============================
FROM golang:1.21-alpine AS builder

WORKDIR /app

# ---- 构建参数 ----
ARG VERSION
ARG COMMIT
ARG BUILDTIME

# 安装构建依赖
RUN apk add --no-cache \
    gcc \
    musl-dev \
    sqlite-dev

# 复制 go.mod 和 go.sum
COPY go.mod go.sum ./
RUN go mod download

# 复制源代码
COPY backend ./backend

# 构建（启用 CGO，动态链接 sqlite）
RUN CGO_ENABLED=1 go build \
    -ldflags "-X main.Version=${VERSION} -X main.Commit=${COMMIT} -X main.BuildTime=${BUILDTIME}" \
    -o kuma-lite backend/main.go

# ============================
# 2) 运行阶段（超小 Alpine）
# ============================
FROM alpine:3.20

WORKDIR /app

# 运行时依赖（sqlite 动态链接需要）
RUN apk add --no-cache \
    sqlite-libs \
    ca-certificates

# 拷贝二进制程序
COPY --from=builder /app/kuma-lite .

# 静态资源
COPY static ./static

# 数据目录
RUN mkdir -p /data

ENV DB_PATH=/data/kuma-lite.db

EXPOSE 8080

CMD ["./kuma-lite"]

