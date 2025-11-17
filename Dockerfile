# 构建阶段 - 使用Debian替代Alpine解决sqlite CGO编译问题
FROM golang:1.21-bullseye AS builder

# 设置工作目录
WORKDIR /app

# 安装构建依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libc6-dev \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

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

# 构建应用 (启用CGO编译sqlite)
RUN CGO_ENABLED=1 GOOS=linux go build \
    -ldflags "-w -s -X main.Version=${VERSION} -X main.Commit=${COMMIT} -X main.BuildTime=${BUILDTIME}" \
    -a -installsuffix cgo \
    -o kuma-lite backend/main.go

# 运行阶段 - 使用Debian Slim最小化镜像
FROM debian:bullseye-slim

WORKDIR /app

# 安装运行时依赖 (仅必需的库)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libsqlite3-0 \
    wget \
    tzdata \
    && rm -rf /var/lib/apt/lists/* \
    # 创建非root用户和组
    && groupadd -g 1000 kuma \
    && useradd -r -u 1000 -g kuma kuma \
    # 创建数据目录并设置权限
    && mkdir -p /data \
    && chown -R kuma:kuma /app /data

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
