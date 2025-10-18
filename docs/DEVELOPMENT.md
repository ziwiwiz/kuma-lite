# Kuma-Lite 开发环境指南

## 快速开始

### 1. 环境准备

确保你的系统已安装：
- Docker
- Docker Compose

### 2. 配置环境变量

首次运行时，脚本会自动从 `.env.example` 复制创建 `.env` 文件。你也可以手动创建：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置你的 Kuma 实例信息：

```env
KUMA_API_URL=https://your-kuma-instance.com
KUMA_STATUS_PAGE_SLUG=your-status-page-slug
```

### 3. 启动开发环境

```bash
./dev.sh
```

这个脚本会：
- ✅ 检查并创建 `.env` 文件
- ✅ 创建数据目录
- ✅ 构建开发镜像
- ✅ 启动开发容器（支持热重载）

### 4. 访问应用

- **应用地址**: http://localhost:8080
- **调试端口**: localhost:2345 (Delve 远程调试)

## 开发特性

### 🔥 代码热重载

开发环境使用 [Air](https://github.com/cosmtrek/air) 实现自动热重载：

- 修改 `backend/` 目录下的任何 `.go` 文件
- Air 会自动检测变化并重新编译
- 应用自动重启，无需手动操作

### 📁 目录挂载

以下目录被挂载到容器中，支持实时更新：

```
./backend  → /app/backend   # 后端代码
./static   → /app/static    # 静态文件
./data     → /data          # 数据库和持久化数据
```

### 🐛 调试支持

开发容器暴露了 Delve 调试端口（2345），你可以：

1. 在 VS Code 中配置 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Remote Debug",
      "type": "go",
      "request": "attach",
      "mode": "remote",
      "remotePath": "/app",
      "port": 2345,
      "host": "localhost"
    }
  ]
}
```

2. 在代码中设置断点
3. 在 VS Code 中启动调试会话

## 常用命令

### 启动开发环境

```bash
./dev.sh
```

### 查看日志

```bash
./dev-logs.sh
# 或者
docker-compose -f docker-compose.dev.yml logs -f
```

### 停止开发环境

```bash
./dev-stop.sh
# 或者
docker-compose -f docker-compose.dev.yml down
```

### 重启服务

```bash
docker-compose -f docker-compose.dev.yml restart
```

### 进入容器

```bash
docker exec -it kuma-lite-dev bash
```

### 查看容器状态

```bash
docker-compose -f docker-compose.dev.yml ps
```

### 重新构建镜像

```bash
docker-compose -f docker-compose.dev.yml build --no-cache
```

## 数据库管理

### 使用 Adminer（可选）

如果需要图形化管理 SQLite 数据库，可以启动 Adminer：

```bash
docker-compose -f docker-compose.dev.yml --profile debug up -d adminer
```

访问 http://localhost:8081 使用 Adminer。

### 使用 SQLite CLI

```bash
# 进入容器
docker exec -it kuma-lite-dev bash

# 打开数据库
sqlite3 /data/kuma-lite.db

# 查看表
.tables

# 查看表结构
.schema monitors

# 退出
.quit
```

## 项目结构

```
kuma-lite/
├── backend/              # Go 后端代码
│   ├── main.go          # 应用入口
│   ├── api/             # API 路由和处理器
│   ├── cache/           # 缓存层
│   ├── config/          # 配置管理
│   ├── database/        # 数据库操作
│   ├── fetcher/         # Kuma 数据获取
│   ├── models/          # 数据模型
│   └── scheduler/       # 定时任务
├── static/              # 静态文件（HTML/CSS/JS）
├── data/                # 数据目录（不提交到 Git）
├── docs/                # 项目文档
├── Dockerfile           # 生产环境 Dockerfile
├── Dockerfile.dev       # 开发环境 Dockerfile
├── docker-compose.yml   # 生产环境配置
├── docker-compose.dev.yml # 开发环境配置
├── .air.toml           # Air 热重载配置
└── .env                 # 环境变量（不提交到 Git）
```

## 开发工作流

### 添加新功能

1. 在 `backend/` 相应目录下修改或创建文件
2. Air 会自动检测变化并重新编译
3. 在浏览器中刷新查看效果
4. 使用 `./dev-logs.sh` 查看日志

### 修改静态文件

1. 修改 `static/` 目录下的文件
2. 刷新浏览器即可看到变化（无需重启）

### 调试问题

1. 使用 `./dev-logs.sh` 查看实时日志
2. 使用 `docker exec -it kuma-lite-dev bash` 进入容器检查
3. 使用 Delve 远程调试（端口 2345）

## 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `KUMA_API_URL` | Uptime Kuma 实例地址 | 必填 |
| `KUMA_STATUS_PAGE_SLUG` | 状态页面 slug | 必填 |
| `SERVER_PORT` | 应用端口 | 8080 |
| `CACHE_DURATION` | 缓存时长（秒） | 60 |
| `FETCH_INTERVAL` | 数据获取间隔（秒） | 30 |
| `DB_PATH` | 数据库路径 | /data/kuma-lite.db |
| `DATA_RETENTION_DAYS` | 数据保留天数 | 30 |
| `GIN_MODE` | Gin 框架模式 | debug |
| `LOG_LEVEL` | 日志级别 | debug |

## 常见问题

### Q: 端口被占用怎么办？

A: 修改 `docker-compose.dev.yml` 中的端口映射：

```yaml
ports:
  - "8081:8080"  # 将主机端口改为 8081
```

### Q: 如何清理数据库重新开始？

A: 删除数据目录后重启：

```bash
./dev-stop.sh
rm -rf data/
./dev.sh
```

### Q: 修改代码后没有自动重载？

A: 检查 Air 日志：

```bash
docker-compose -f docker-compose.dev.yml logs -f kuma-lite-dev
```

确保修改的文件在 `.air.toml` 的监听范围内。

### Q: 如何更新依赖？

A: 修改 `go.mod` 后重新构建镜像：

```bash
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up -d
```

## 生产部署

开发完成后，使用生产环境配置部署：

```bash
# 构建生产镜像
docker build -t kuma-lite:latest .

# 使用 docker-compose 部署
docker-compose up -d
```

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

[MIT License](../LICENSE)
