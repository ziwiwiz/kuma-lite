#!/bin/bash

# Kuma-Lite 启动脚本

echo "================================"
echo "   Kuma-Lite 启动脚本"
echo "================================"

# 检查是否存在 .env 文件
if [ ! -f .env ]; then
    echo "错误: .env 文件不存在"
    echo "请复制 .env.example 并配置环境变量:"
    echo "  cp .env.example .env"
    exit 1
fi

# 加载环境变量
export $(grep -v '^#' .env | xargs)

# 验证必需的环境变量
if [ -z "$KUMA_API_URL" ]; then
    echo "错误: KUMA_API_URL 未设置"
    exit 1
fi

if [ -z "$KUMA_STATUS_PAGE_SLUG" ]; then
    echo "错误: KUMA_STATUS_PAGE_SLUG 未设置"
    exit 1
fi

echo "配置检查通过"
echo "Kuma API: $KUMA_API_URL"
echo "Status Page Slug: $KUMA_STATUS_PAGE_SLUG"
echo ""

# 创建数据目录
mkdir -p data

# 检查 Go 版本
echo "检查 Go 版本..."
if ! command -v go &> /dev/null; then
    echo "错误: 未找到 Go，请先安装 Go 1.21+"
    exit 1
fi

GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
echo "Go 版本: $GO_VERSION"
echo ""

# 下载依赖
echo "下载 Go 依赖..."
go mod download

# 运行应用
echo ""
echo "启动 Kuma-Lite..."
echo "================================"
go run backend/main.go
