#!/bin/bash

# Kuma-Lite 开发环境日志查看脚本

set -e

BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📋 查看 Kuma-Lite 开发环境日志...${NC}"
echo ""

docker-compose -f docker-compose.dev.yml logs -f --tail=100
