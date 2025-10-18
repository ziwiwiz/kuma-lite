#!/bin/bash

# Kuma-Lite 开发环境停止脚本

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🛑 停止 Kuma-Lite 开发环境...${NC}"
echo ""

docker-compose -f docker-compose.dev.yml down

echo ""
echo -e "${GREEN}✓ 开发环境已停止${NC}"
