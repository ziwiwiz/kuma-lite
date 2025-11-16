# Kuma-Lite

> 第三方 Uptime Kuma 监控仪表盘 - 更直观、更强大的状态展示

## 📚 文档导航

- [快速开始](./QUICKSTART.md) - 5 分钟快速部署
- [更新日志](./CHANGELOG.md) - 版本更新记录
- [API 文档](./docs/API.md) - API 接口规范
- [部署指南](./docs/DEPLOYMENT.md) - 生产环境部署
- [日志配置](./docs/LOG_LEVELS.md) - 日志级别配置说明
- [问题排查](./docs/TROUBLESHOOTING.md) - 常见问题解决

---

## 项目简介

Kuma-Lite 是一个第三方 Uptime Kuma 监控仪表盘项目，旨在解决 Uptime Kuma 内建公开状态页面不够直观、没有延迟图表等痛点。

本项目参考开源项目 [kuma-mieru](https://github.com/Alice39s/kuma-mieru) 的设计理念，在其基础上进行了增强和优化。

## ✨ 核心特性

### 界面与交互
- 🎨 **现代化界面**: 清晰的状态卡片和可视化图表
- 📱 **响应式设计**: 完美适配桌面端和移动端
- 🌓 **主题切换**: 亮色/暗色/自动跟随系统
- 🌍 **多语言支持**: 中文/English

### 数据展示
- 📊 **延迟图表**: 实时展示服务响应时间趋势
- 📈 **历史记录**: 支持查看最近 25/50/100 次记录
- 🎯 **状态可视化**: 
  - 在线/离线/重试/维护状态区分
  - 状态条颜色标注
  - 可用率环形进度展示

### 性能与架构
- ⚡ **后端缓存**: 数据缓存和整理，提升访问速度
- 💾 **持久化存储**: SQLite 历史数据持久化
- 🐳 **Docker 部署**: 单容器部署，开箱即用
- 🔒 **无跨域问题**: 后端直接数据获取
- 📝 **分级日志**: DEBUG/INFO/WARN/ERROR/FATAL 五级日志控制

### 高级功能
- 🔍 **搜索过滤**: 快速查找监控项或分组
- 📦 **精简模式**: 卡片/列表视图切换
- ⏸️ **自动刷新**: 可暂停/继续自动刷新
- 🔧 **维护模式**: 支持维护公告展示

## 技术栈

### 后端
- Go 1.21+ - 高性能后端语言
- Gin - Web 框架，提供 API 和静态文件服务
- SQLite - 轻量级数据库（持久化存储）
- Go-Cache - 内存缓存
- GORM - ORM 框架

### 前端
- Vue 3 - 渐进式 JavaScript 框架（CDN 引入，无需构建）
- ECharts - 图表可视化（CDN 引入）
- Axios - HTTP 客户端（CDN 引入）
- 原生 CSS / Tailwind CDN - 样式方案

### 部署
- Docker - 容器化部署
- 单容器包含所有服务

## 📁 项目架构

```
kuma-lite/
├── backend/                      # 后端 Go 项目
│   ├── api/                      # API 路由处理
│   │   ├── handlers.go           # 监控数据 API 处理器
│   │   ├── maintenance_handlers.go  # 维护公告 API 处理器
│   │   └── router.go             # 路由配置
│   ├── cache/                    # 缓存逻辑
│   │   └── cache.go              # 内存缓存管理
│   ├── config/                   # 配置管理
│   │   └── config.go             # 环境变量加载
│   ├── database/                 # 数据库操作
│   │   ├── db.go                 # SQLite 连接
│   │   ├── migration.go          # 数据库迁移
│   │   ├── repository.go         # 监控数据访问层
│   │   └── maintenance_repository.go  # 维护数据访问层
│   ├── fetcher/                  # 数据获取
│   │   └── kuma.go               # Uptime Kuma 数据抓取
│   ├── logger/                   # 日志系统
│   │   └── logger.go             # 分级日志实现
│   ├── models/                   # 数据模型
│   │   ├── monitor.go            # 监控项模型
│   │   └── maintenance.go        # 维护公告模型
│   ├── scheduler/                # 定时任务
│   │   └── scheduler.go          # 数据定期获取和清理
│   └── main.go                   # 主入口
├── static/                       # 前端静态资源
│   ├── index.html                # 主页面
│   ├── detail.html               # 详情页面
│   ├── css/
│   │   ├── style-v2.css          # 主样式（含响应式）
│   │   └── style-detail.css      # 详情页样式
│   └── js/
│       ├── app-v2.js             # Vue 主应用（含 i18n）
│       ├── app-detail.js         # 详情页应用
│       └── logger.js             # 前端日志系统
├── data/                         # 数据存储目录
│   └── kuma-lite.db              # SQLite 数据库（运行时生成）
├── docs/                         # 项目文档
│   ├── API.md                    # API 文档
│   ├── DEPLOYMENT.md             # 部署文档
│   ├── REQUIREMENTS.md           # 需求文档
│   ├── TROUBLESHOOTING.md        # 问题排查
│   ├── LOG_LEVELS.md             # 日志配置
│   └── FRONTEND_LOGGING.md       # 前端日志说明
├── Dockerfile                    # Docker 镜像构建
├── docker-compose.yml            # Docker Compose 配置
├── .env.example                  # 环境变量示例
├── go.mod & go.sum               # Go 依赖管理
├── CHANGELOG.md                  # 更新日志
├── QUICKSTART.md                 # 快速开始
└── README.md                     # 项目说明
```

## 🚀 快速开始

### 方式一：Docker Compose（推荐）

适合需要持久化配置和数据的场景。

```bash
# 1. 创建项目目录
mkdir kuma-lite && cd kuma-lite

# 2. 下载配置文件
curl -O https://raw.githubusercontent.com/ziwiwiz/kuma-lite/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/ziwiwiz/kuma-lite/main/.env.example
mv .env.example .env

# 3. 编辑配置文件
nano .env  # 修改 KUMA_API_URL 和 KUMA_STATUS_PAGE_SLUG

# 4. 启动服务
docker-compose up -d

# 5. 查看日志
docker-compose logs -f
```

访问 `http://localhost:8080` 查看监控仪表盘。

**最少配置项**：
```env
KUMA_API_URL=https://your-kuma-instance.com
KUMA_STATUS_PAGE_SLUG=your-status-page-slug
```

### 方式二：Docker 命令（快速体验）

适合快速测试和临时使用。

```bash
docker run -d \
  --name kuma-lite \
  -p 8080:8080 \
  -v $(pwd)/data:/data \
  -e KUMA_API_URL=https://your-kuma-instance.com \
  -e KUMA_STATUS_PAGE_SLUG=your-status-page-slug \
  -e LOG_LEVEL=WARN \
  --restart unless-stopped \
  ziwiwiz/kuma-lite:latest
```

查看日志：`docker logs -f kuma-lite`

**镜像地址**：[ziwiwiz/kuma-lite](https://hub.docker.com/r/ziwiwiz/kuma-lite)

**可用标签**：
- `latest` - 最新开发版
- `v1.x.x` - 稳定发行版

### 方式三：本地开发

适合开发调试和功能定制。

```bash
# 1. 克隆仓库
git clone https://github.com/ziwiwiz/kuma-lite.git
cd kuma-lite

# 2. 安装依赖
go mod download

# 3. 配置环境变量
cp .env.example .env
nano .env

# 4. 运行服务
go run backend/main.go

# 或使用 air 热重载（推荐）
air
```

访问 `http://localhost:8080` 查看应用。

## ⚙️ 配置说明

所有配置通过 `.env` 文件或环境变量设置：

### 必需配置

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `KUMA_API_URL` | Uptime Kuma 实例地址 | `https://status.example.com` |
| `KUMA_STATUS_PAGE_SLUG` | 状态页面 slug | `my-status-page` |

### 可选配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `SERVER_PORT` | `8080` | 服务监听端口 |
| `CACHE_DURATION` | `60` | 缓存持续时间（秒） |
| `FETCH_INTERVAL` | `60` | 数据获取间隔（秒） |
| `CONCURRENT_QUERY_WORKERS` | `10` | 并发查询线程数 |
| `DATA_RETENTION_DAYS` | `90` | 数据保留天数（0=永久） |
| `LOG_LEVEL` | `INFO` | 日志级别（推荐 `WARN`） |
| `LOG_ENABLE_COLOR` | `true` | 彩色日志输出 |

完整配置示例请查看 [.env.example](./.env.example)

**配置技巧**：
- 生产环境建议使用 `LOG_LEVEL=WARN` 减少日志输出
- `FETCH_INTERVAL` 建议与 `CACHE_DURATION` 保持一致
- `DATA_RETENTION_DAYS=0` 可永久保留数据，但会增加数据库大小

详细配置说明请参考 [部署文档](./docs/DEPLOYMENT.md) 和 [日志配置](./docs/LOG_LEVELS.md)

## 工作原理

### 1. 数据流程

```
Uptime Kuma Status Page
        ↓ (定期抓取)
   Go Backend Fetcher
        ↓ (解析数据)
   Memory Cache + SQLite
        ↓ (REST API)
   Vue Frontend (Browser)
        ↓ (可视化展示)
      用户界面
```

### 2. 数据解析与缓存

- **定期抓取**: 后端定时从 Uptime Kuma 状态页面获取数据
- **智能解析**: 解析监控项状态、响应时间、可用率等信息
- **双层缓存**:
  - 内存缓存：快速响应，减少数据库查询
  - 数据库持久化：SQLite 存储历史数据
- **自动清理**: 定期清理过期数据，保持数据库轻量

### 3. API 设计

Go 后端提供 RESTful API：

- `GET /api/monitors` - 获取所有监控项列表
- `GET /api/monitors/:id` - 获取单个监控项详情
- `GET /api/monitors/:id/history` - 获取监控项历史数据
- `GET /api/stats` - 获取统计信息
- `GET /` - 提供前端页面服务

### 4. 前端展示

- Vue 3 通过 CDN 引入，无需打包构建
- 单页面应用，组件化开发
- ECharts 实现响应时间图表
- 响应式设计，支持移动端访问

## 🎯 功能特性

### 监控展示
- ✅ 实时监控状态卡片
- ✅ 分组管理和折叠
- ✅ 服务可用率环形图
- ✅ 响应时间统计（LAST/AVG/MAX）
- ✅ 状态条可视化（在线/离线/重试/维护）
- ✅ 监控类型图标（HTTP/TCP/Ping/DNS）

### 详情页面
- ✅ ECharts 响应时间折线图
- ✅ 可拖拽缩放查看
- ✅ 历史数据切换（25/50/100条）
- ✅ 离线状态区域高亮
- ✅ 数据断点自动识别

### 维护管理
- ✅ 维护公告展示
- ✅ 计划中/进行中/已完成状态
- ✅ Markdown 格式支持
- ✅ 可折叠卡片设计

### 系统功能
- ✅ 搜索过滤监控项
- ✅ 自动刷新（可暂停）
- ✅ 精简/完整模式切换
- ✅ 主题切换（亮/暗/自动）
- ✅ 多语言支持（中/英）
- ✅ 移动端响应式适配
- ✅ 分级日志系统

## 📸 截图

### 主页面
- 状态卡片展示
- 分组管理
- 搜索和过滤

### 详情页
- 响应时间图表
- 历史数据查看
- 交互式缩放

### 移动端
- 响应式布局
- 垂直堆叠控件
- 触摸优化

## 🔧 开发说明

### 本地开发
```bash
# 安装依赖
go mod download

# 运行服务（热重载）
go run backend/main.go

# 或使用 air（推荐）
air
```

### Docker 构建
```bash
# 构建镜像
docker build -t kuma-lite:latest .

# 推送到 Docker Hub
./push-to-dockerhub.sh
```

## 🤝 参考项目

- [kuma-mieru](https://github.com/Alice39s/kuma-mieru) - 原始参考项目
- [Uptime Kuma](https://github.com/louislam/uptime-kuma) - 上游监控系统

## 📄 许可证

MIT License

## 💬 贡献

欢迎提交 Issue 和 Pull Request！

如有问题或建议，请访问 [Issues](https://github.com/ziwiwiz/kuma-lite/issues) 页面。

