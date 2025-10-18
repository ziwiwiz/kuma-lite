# Kuma-Lite Docker 开发环境快速指南

## 🎉 环境已就绪

你的 Kuma-Lite 开发环境已经成功搭建并运行！

## 📋 当前配置

- **Kuma 实例**: https://kuma.v2.games
- **状态页面**: vps
- **本地端口**: http://localhost:8080
- **监控项数量**: 42 个

## 🚀 快速命令

### 启动开发环境
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### 查看日志
```bash
# 实时查看日志
docker-compose -f docker-compose.dev.yml logs -f

# 查看最近 50 条日志
docker-compose -f docker-compose.dev.yml logs --tail=50
```

### 停止开发环境
```bash
docker-compose -f docker-compose.dev.yml down
```

### 重启服务
```bash
docker-compose -f docker-compose.dev.yml restart
```

### 重新构建并启动
```bash
docker-compose -f docker-compose.dev.yml up -d --build
```

### 进入容器
```bash
docker exec -it kuma-lite-dev bash
```

## 🔍 API 测试命令

### 健康检查
```bash
curl http://localhost:8080/api/health
```

### 获取所有监控项
```bash
curl http://localhost:8080/api/monitors | jq
```

### 获取统计信息
```bash
curl http://localhost:8080/api/stats | jq
```

### 获取单个监控项详情
```bash
curl http://localhost:8080/api/monitors/1 | jq
```

### 获取监控历史数据
```bash
curl http://localhost:8080/api/monitors/1/history | jq
```

## 📂 项目文件结构

```
kuma-lite/
├── backend/              # Go 后端代码
│   ├── main.go          # 应用入口
│   ├── api/             # API 路由和处理器
│   ├── cache/           # 缓存实现
│   ├── config/          # 配置管理
│   ├── database/        # 数据库操作
│   ├── fetcher/         # Kuma 数据获取
│   ├── models/          # 数据模型
│   └── scheduler/       # 定时任务
├── static/              # 前端静态文件
│   ├── index.html      # 主页面
│   ├── css/            # 样式文件
│   └── js/             # JavaScript 文件
├── data/                # 数据目录（SQLite 数据库）
├── docs/                # 项目文档
├── .env                 # 环境变量配置
├── Dockerfile           # 生产环境镜像
├── docker-compose.yml   # 生产环境配置
└── docker-compose.dev.yml # 开发环境配置
```

## 🛠️ 开发工作流

### 修改后端代码
1. 编辑 `backend/` 目录下的文件
2. 重启容器：`docker-compose -f docker-compose.dev.yml restart`
3. 查看日志：`docker-compose -f docker-compose.dev.yml logs -f`

### 修改前端代码
1. 编辑 `static/` 目录下的文件
2. 重启容器：`docker-compose -f docker-compose.dev.yml restart`
3. 刷新浏览器即可看到变化

### 查看数据库
```bash
# 进入容器
docker exec -it kuma-lite-dev bash

# 打开数据库
sqlite3 /data/kuma-lite.db

# 查看表
.tables

# 查看监控项
SELECT id, name, status, uptime FROM monitors;

# 退出
.quit
```

## 📊 当前运行状态

```bash
# 查看容器状态
docker-compose -f docker-compose.dev.yml ps

# 查看容器资源使用
docker stats kuma-lite-dev
```

## 🐛 常见问题

### 端口被占用
如果 8080 端口被占用，修改 `docker-compose.dev.yml` 中的端口映射：
```yaml
ports:
  - "8081:8080"  # 将主机端口改为 8081
```

### 数据库文件损坏
删除数据库文件并重启：
```bash
rm -rf data/kuma-lite.db*
docker-compose -f docker-compose.dev.yml restart
```

### 查看详细日志
```bash
docker-compose -f docker-compose.dev.yml logs -f --tail=100
```

## 🎯 下一步

1. 访问 http://localhost:8080 查看监控仪表盘
2. 测试 API 接口：http://localhost:8080/api/monitors
3. 根据需要修改代码并测试
4. 查看 `docs/` 目录了解更多详细文档

## 📚 相关文档

- [API 文档](./docs/API.md)
- [部署文档](./docs/DEPLOYMENT.md)
- [需求文档](./docs/REQUIREMENTS.md)

---

**提示**: 开发环境会将数据保存在本地 `./data` 目录中，重启容器不会丢失数据。
