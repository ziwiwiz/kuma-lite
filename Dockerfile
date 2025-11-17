# 构建阶段
FROM golang:1.21-alpine AS builder

# 设置工作目录
WORKDIR /app

# 安装构建依赖 (CGO编译sqlite必需)
RUN apk add --no-cache \
    gcc \
    musl-dev \
    sqlite-dev \
    git

# 设置构建参数
ARG VERSION=dev
ARG COMMIT=unknown
ARG BUILDTIME=unknown

# 复制 go.mod 和 go.sum (利用缓存层)
COPY go.mod go.sum ./

# 下载依赖
RUN go mod download && go mod verify

# 复制源代码
COPY backend ./backend

# 构建应用 (动态链接sqlite,避免静态链接问题)
RUN CGO_ENABLED=1 GOOS=linux go build \
    -ldflags "-w -s -X main.Version=${VERSION} -X main.Commit=${COMMIT} -X main.BuildTime=${BUILDTIME}" \
    -o kuma-lite backend/main.go

# 运行阶段 - 使用更小的Alpine基础镜像
FROM alpine:3.18

WORKDIR /app

# 安装运行时依赖 (sqlite-libs是运行必需的)
RUN apk add --no-cache \
    ca-certificates \
    sqlite-libs \
    tzdata \
    wget && \
    # 创建非root用户和组
    addgroup -g 1000 kuma && \
    adduser -D -u 1000 -G kuma kuma && \
    # 创建数据目录并设置权限
    mkdir -p /data && \
    chown -R kuma:kuma /app /data

# 从构建阶段复制二进制文件
COPY --from=builder --chown=kuma:kuma /app/kuma-lite .

# 复制静态文件
COPY --chown=kuma:kuma static ./static

# 切换到非root用户
USER kuma

# 暴露端口
EXPOSE 8080

# 设置环境变量
ENV DB_PATH=/data/kuma-lite.db

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# 启动应用
CMD ["./kuma-lite"]
