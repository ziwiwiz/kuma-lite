#!/bin/bash

# Kuma-Lite 构建脚本

echo "================================"
echo "   Kuma-Lite 构建脚本"
echo "================================"

# 创建输出目录
mkdir -p dist

# 构建 Linux 版本
echo "构建 Linux 版本..."
CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -o dist/kuma-lite-linux-amd64 backend/main.go

# 构建 macOS 版本（如果在 macOS 上）
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "构建 macOS 版本..."
    CGO_ENABLED=1 GOOS=darwin GOARCH=amd64 go build -o dist/kuma-lite-darwin-amd64 backend/main.go
    CGO_ENABLED=1 GOOS=darwin GOARCH=arm64 go build -o dist/kuma-lite-darwin-arm64 backend/main.go
fi

echo ""
echo "构建完成！输出文件在 dist/ 目录"
ls -lh dist/
