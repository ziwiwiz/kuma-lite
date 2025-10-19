#!/bin/bash

# Kuma-Lite 开发环境启动脚本（简化版）

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Kuma-Lite 开发环境${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查 .env 文件
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  未找到 .env 文件，请先配置！${NC}"
    exit 1
fi

# 创建数据目录
mkdir -p data

# 重新构建并启动服务
echo -e "${GREEN}🔨 重新构建镜像...${NC}"
docker-compose -f docker-compose.dev.yml build --no-cache

echo -e "${GREEN}🚀 启动开发环境...${NC}"
docker-compose -f docker-compose.dev.yml up -d

echo ""
echo -e "${GREEN}✓ 开发环境启动成功！${NC}"
echo ""
echo -e "${BLUE}📋 访问地址:${NC}"
echo -e "   应用: ${GREEN}http://localhost:8080${NC}"
echo -e "   API:  ${GREEN}http://localhost:8080/api/monitors${NC}"
echo ""
echo -e "${BLUE}📝 常用命令:${NC}"
echo -e "   查看日志: ${YELLOW}./dev-logs.sh${NC}"
echo -e "   停止服务: ${YELLOW}./dev-stop.sh${NC}"
echo ""
