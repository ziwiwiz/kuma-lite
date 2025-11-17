# ---------- 构建阶段 ----------
FROM golang:1.21 AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc libc6-dev libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY go.mod go.sum ./
RUN go mod download

COPY backend ./backend

ARG VERSION
ARG COMMIT
ARG BUILDTIME

RUN CGO_ENABLED=1 go build \
    -ldflags "-s -w -X main.Version=${VERSION} -X main.Commit=${COMMIT} -X main.BuildTime=${BUILDTIME}" \
    -o kuma-lite backend/main.go


# ---------- 运行阶段（Distroless，极致瘦身） ----------
FROM gcr.io/distroless/base-debian12

WORKDIR /app

# 复制可执行文件
COPY --from=builder /app/kuma-lite .

# 静态文件（你项目必须要）
COPY static ./static

# 数据目录（distroless 没有 mkdir，直接 COPY）
# 如果需要创建空目录，需要使用下面方式：
COPY --from=builder /dev/null /data/.keep

EXPOSE 8080
ENV DB_PATH=/data/kuma-lite.db

CMD ["./kuma-lite"]

