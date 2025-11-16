#!/bin/bash

# Kuma-Lite Docker 构建脚本

echo "================================"
echo "   Kuma-Lite Docker 构建"
echo "================================"

# 设置镜像名称和标签
IMAGE_NAME="kuma-lite"
IMAGE_TAG="latest"

echo "使用 Docker 多阶段构建..."
echo "镜像名称: ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""

# 构建 Docker 镜像
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

# 检查构建结果
if [ $? -eq 0 ]; then
    echo ""
    echo "================================"
    echo "   构建成功！"
    echo "================================"
    echo ""
    echo "镜像信息:"
    docker images ${IMAGE_NAME}:${IMAGE_TAG}
    echo ""
    echo "运行容器:"
    echo "  docker-compose up -d"
    echo ""
    echo "或者直接运行:"
    echo "  docker run -d -p 8080:8080 -v \$(pwd)/data:/data ${IMAGE_NAME}:${IMAGE_TAG}"
else
    echo ""
    echo "================================"
    echo "   构建失败！"
    echo "================================"
    exit 1
fi
