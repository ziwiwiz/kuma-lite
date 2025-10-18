# 构建阶段
FROM golang:1.21-bullseye AS builder

WORKDIR /app

# 安装构建依赖
RUN apt-get update && apt-get install -y gcc libc6-dev libsqlite3-dev && rm -rf /var/lib/apt/lists/*

# 复制 go.mod 和 go.sum
COPY go.mod go.sum ./
RUN go mod download

# 复制源代码
COPY backend ./backend

# 构建应用
RUN CGO_ENABLED=1 go build -o kuma-lite backend/main.go

# 运行阶段
FROM debian:bullseye-slim

WORKDIR /app

# 安装运行时依赖
RUN apt-get update && apt-get install -y ca-certificates sqlite3 && rm -rf /var/lib/apt/lists/*

# 从构建阶段复制二进制文件
COPY --from=builder /app/kuma-lite .

# 复制静态文件
COPY static ./static

# 创建数据目录
RUN mkdir -p /data

# 暴露端口
EXPOSE 8080

# 设置环境变量
ENV DB_PATH=/data/kuma-lite.db

# 启动应用
CMD ["./kuma-lite"]
