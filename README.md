# Kuma-Lite

> 第三方 Uptime Kuma 监控仪表盘 - 更直观、更强大的状态展示

## 📚 文档导航

- [快速开始](./QUICKSTART.md) - 5 分钟快速部署
- [架构文档](./ARCHITECTURE.md) - 完整的技术架构和实现细节
- [文件清单](./FILE_MANIFEST.md) - 项目文件说明和用途
- [更新日志](./CHANGELOG.md) - 版本更新记录
- [开发指南](./DEV_GUIDE.md) - 开发环境搭建
- [API 文档](./docs/API.md) - API 接口规范
- [部署指南](./docs/DEPLOYMENT.md) - 生产环境部署

---

## 项目简介

Kuma-Lite 是一个第三方 Uptime Kuma 监控仪表盘项目，旨在解决 Uptime Kuma 内建公开状态页面不够直观、没有延迟图表等痛点。

本项目参考开源项目 [kuma-mieru](https://github.com/Alice39s/kuma-mieru) 的设计理念，在其基础上进行了增强和优化。

## 核心特性

- ✅ **直观的监控展示**: 清晰的状态卡片和可视化图表
- 📊 **延迟图表**: 实时展示服务响应时间趋势
- 🚀 **后端缓存**: 数据缓存和整理，提升访问速度
- 💾 **持久化存储**: 历史数据持久化，支持长期数据分析
- 🐳 **Docker 部署**: 单容器部署，开箱即用
- 🔒 **无跨域问题**: 后端直接数据获取，前端直接使用
- 🎯 **一体化架构**: 后端提供 API 和静态页面服务，部署简单

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

## 项目架构

```
kuma-lite/
├── backend/                # 后端 Go 项目
│   ├── api/                # API 路由处理
│   │   ├── handlers.go     # HTTP 处理器
│   │   └── router.go       # 路由配置
│   ├── cache/              # 缓存逻辑
│   │   └── cache.go        # 缓存管理器
│   ├── database/           # 数据库操作
│   │   ├── db.go           # 数据库连接
│   │   └── repository.go   # 数据访问层
│   ├── fetcher/            # 数据获取
│   │   ├── kuma.go         # Uptime Kuma 数据抓取
│   │   └── parser.go       # 数据解析逻辑
│   ├── models/             # 数据模型
│   │   └── monitor.go      # 监控项模型
│   ├── config/             # 配置管理
│   │   └── config.go       # 配置加载
│   ├── scheduler/          # 定时任务
│   │   └── scheduler.go    # 数据定期获取
│   └── main.go             # 主入口
├── static/                 # 前端静态资源
│   ├── index.html          # 主页面
│   ├── css/
│   │   └── style.css       # 自定义样式
│   └── js/
│       ├── app.js          # Vue 主应用
│       ├── api.js          # API 调用封装
│       ├── components.js   # Vue 组件定义
│       └── utils.js        # 工具函数
├── data/                   # 数据存储目录
│   └── kuma-lite.db        # SQLite 数据库（运行时生成）
├── docs/                   # 项目文档
│   ├── REQUIREMENTS.md     # 需求文档
│   ├── DESIGN.md           # 设计文档
│   ├── API.md              # API 文档
│   └── DEPLOYMENT.md       # 部署文档
├── Dockerfile              # Docker 镜像构建
├── docker-compose.yml      # Docker Compose 配置
├── .env.example            # 环境变量示例
├── go.mod                  # Go 依赖管理
├── go.sum
└── README.md               # 项目说明
```

## 快速开始

### 使用 Docker 部署（推荐）

```bash
# 克隆项目
git clone https://github.com/yourusername/kuma-lite.git
cd kuma-lite

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置 Uptime Kuma API 地址

# 启动容器
docker-compose up -d
```

访问 `http://localhost:3000` 即可查看监控仪表盘。

### 本地开发

```bash
# 安装 Go 依赖
go mod download

# 配置环境变量
export KUMA_API_URL=https://your-kuma-instance.com
export KUMA_STATUS_PAGE_SLUG=your-status-page-slug

# 运行服务
go run backend/main.go
```

访问 `http://localhost:8080` 查看应用。

## 配置说明

### 环境变量

```env
# Uptime Kuma 配置
KUMA_API_URL=https://your-kuma-instance.com
KUMA_STATUS_PAGE_SLUG=your-status-page-slug

# 服务器配置
SERVER_PORT=8080

# 缓存配置
CACHE_DURATION=60          # 缓存时间（秒）
FETCH_INTERVAL=30          # 数据获取间隔（秒）

# 数据库配置
DB_PATH=./data/kuma-lite.db

# 数据保留策略
DATA_RETENTION_DAYS=30     # 历史数据保留天数
```

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

## 功能特性

### 1. 监控展示

- ✅ 实时监控状态卡片
- ✅ 服务可用率统计
- ✅ 响应时间趋势图表
- ✅ 事件日志展示
- ✅ 分组管理和筛选

### 2. 数据可视化

- 📊 ECharts 响应时间折线图
- 📈 可用率百分比展示
- 📉 状态历史时间轴
- 🔍 自定义时间范围查询

### 3. 性能优化

- ⚡ 内存缓存，秒级响应
- 💾 增量数据更新
- 🔄 智能刷新策略
- 📦 轻量级部署包

## 开发进度

- [x] 需求分析和架构设计
- [ ] 后端 Go 服务开发
  - [ ] 项目结构搭建
  - [ ] 配置管理模块
  - [ ] 数据获取模块（Uptime Kuma API）
  - [ ] 数据解析逻辑
  - [ ] 缓存管理模块
  - [ ] 数据库持久化（SQLite + GORM）
  - [ ] REST API 接口
  - [ ] 定时任务调度
  - [ ] 静态文件服务
- [ ] 前端开发
  - [ ] HTML 页面结构
  - [ ] Vue 组件设计
  - [ ] 监控卡片组件
  - [ ] 图表可视化组件
  - [ ] API 集成
  - [ ] 响应式布局
- [ ] Docker 容器化
  - [ ] Dockerfile 编写
  - [ ] docker-compose 配置
  - [ ] 构建优化
- [ ] 文档完善
  - [ ] API 文档
  - [ ] 部署文档
  - [ ] 使用说明
- [ ] 测试和优化

## 参考项目

- [kuma-mieru](https://github.com/Alice39s/kuma-mieru) - 原始参考项目
- [Uptime Kuma](https://github.com/louislam/uptime-kuma) - 上游监控系统

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

