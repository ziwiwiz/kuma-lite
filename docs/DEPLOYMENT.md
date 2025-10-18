# Kuma-Lite 部署文档

## Docker 部署 (推荐)

### 使用 Docker Compose

1. **克隆项目**
```bash
git clone https://github.com/yourusername/kuma-lite.git
cd kuma-lite
```

2. **配置环境变量**
```bash
cp .env.example .env
```

编辑 `.env` 文件:
```env
KUMA_API_URL=https://your-kuma-instance.com
KUMA_STATUS_PAGE_SLUG=your-status-page-slug
SERVER_PORT=8080
CACHE_DURATION=60
FETCH_INTERVAL=30
DB_PATH=/data/kuma-lite.db
DATA_RETENTION_DAYS=30
```

3. **启动服务**
```bash
docker-compose up -d
```

4. **访问应用**
打开浏览器访问: `http://localhost:3000`

### 使用 Docker 命令

```bash
docker run -d \
  --name kuma-lite \
  -p 3000:8080 \
  -v $(pwd)/data:/data \
  -e KUMA_API_URL=https://your-kuma-instance.com \
  -e KUMA_STATUS_PAGE_SLUG=your-status-page-slug \
  kuma-lite:latest
```

## 本地开发部署

### 前置要求

- Go 1.21 或更高版本
- SQLite3

### 步骤

1. **克隆项目**
```bash
git clone https://github.com/yourusername/kuma-lite.git
cd kuma-lite
```

2. **安装依赖**
```bash
go mod download
```

3. **配置环境变量**
```bash
export KUMA_API_URL=https://your-kuma-instance.com
export KUMA_STATUS_PAGE_SLUG=your-status-page-slug
export SERVER_PORT=8080
```

4. **运行服务**
```bash
go run backend/main.go
```

5. **访问应用**
打开浏览器访问: `http://localhost:8080`

## 生产环境部署

### 构建二进制文件

```bash
# Linux
CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -o kuma-lite backend/main.go

# Windows
CGO_ENABLED=1 GOOS=windows GOARCH=amd64 go build -o kuma-lite.exe backend/main.go

# macOS
CGO_ENABLED=1 GOOS=darwin GOARCH=amd64 go build -o kuma-lite backend/main.go
```

### 使用 Systemd 管理服务 (Linux)

创建服务文件 `/etc/systemd/system/kuma-lite.service`:

```ini
[Unit]
Description=Kuma-Lite Monitoring Dashboard
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/kuma-lite
Environment="KUMA_API_URL=https://your-kuma-instance.com"
Environment="KUMA_STATUS_PAGE_SLUG=your-status-page-slug"
ExecStart=/opt/kuma-lite/kuma-lite
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

启动服务:
```bash
sudo systemctl daemon-reload
sudo systemctl enable kuma-lite
sudo systemctl start kuma-lite
```

## 反向代理配置

### Nginx

```nginx
server {
    listen 80;
    server_name monitor.example.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy

```
monitor.example.com {
    reverse_proxy localhost:8080
}
```

## 数据备份

### 备份 SQLite 数据库

```bash
# 备份
cp data/kuma-lite.db data/kuma-lite.db.backup

# 或使用 SQLite 命令
sqlite3 data/kuma-lite.db ".backup 'data/kuma-lite.db.backup'"
```

### 自动备份脚本

```bash
#!/bin/bash
BACKUP_DIR="/backup/kuma-lite"
DB_PATH="/opt/kuma-lite/data/kuma-lite.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
sqlite3 $DB_PATH ".backup '$BACKUP_DIR/kuma-lite_$DATE.db'"

# 保留最近 7 天的备份
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
```

## 故障排查

### 检查日志

```bash
# Docker 容器日志
docker logs kuma-lite

# Systemd 服务日志
sudo journalctl -u kuma-lite -f
```

### 常见问题

1. **无法连接到 Uptime Kuma**
   - 检查 `KUMA_API_URL` 配置是否正确
   - 确认状态页面是公开的
   - 检查网络连接

2. **数据库错误**
   - 确认 data 目录有写入权限
   - 检查磁盘空间是否充足

3. **端口冲突**
   - 修改 `SERVER_PORT` 环境变量
   - 或修改 Docker 端口映射

## 性能优化

1. **调整缓存时间**
   - 增加 `CACHE_DURATION` 减少数据库查询
   - 减少 `FETCH_INTERVAL` 获取更实时的数据

2. **数据清理**
   - 减少 `DATA_RETENTION_DAYS` 保持数据库轻量
   - 定期执行 SQLite VACUUM 命令

3. **资源限制** (Docker)
```yaml
services:
  kuma-lite:
    # ...其他配置...
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
```
