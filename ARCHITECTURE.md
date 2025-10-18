# Kuma Lite 项目架构文档

## 项目概述

Kuma Lite 是一个轻量级的服务监控系统前端展示应用，基于 Uptime Kuma 的数据源，提供简洁美观的监控状态可视化界面。

**技术栈**：
- **后端**: Go 1.21 + Gin + GORM + SQLite
- **前端**: Vue 3 (CDN) + ECharts 5.4.3 + Axios
- **容器化**: Docker + Docker Compose

---

## 目录结构

```
kuma-lite/
├── backend/                    # 后端 Go 代码
│   ├── main.go                # 主程序入口
│   ├── api/                   # API 路由和处理器
│   │   ├── router.go         # 路由配置
│   │   └── handlers.go       # HTTP 请求处理函数
│   ├── cache/                # 缓存层
│   │   └── cache.go          # 内存缓存实现
│   ├── config/               # 配置管理
│   │   └── config.go         # 环境变量配置
│   ├── database/             # 数据库层
│   │   ├── db.go            # 数据库连接
│   │   └── repository.go    # 数据访问层
│   ├── fetcher/             # 数据获取层
│   │   └── kuma.go          # Kuma API 客户端
│   ├── models/              # 数据模型
│   │   └── monitor.go       # 监控项模型
│   └── scheduler/           # 定时任务
│       └── scheduler.go     # 数据同步调度器
│
├── static/                   # 前端静态资源
│   ├── index.html           # 主页面（监控列表）
│   ├── detail.html          # 详情页（单个监控详细信息）
│   ├── css/
│   │   ├── style-v2.css     # 主页面样式
│   │   └── style-detail.css # 详情页样式
│   └── js/
│       ├── app-v2.js        # 主页面逻辑
│       └── app-detail.js    # 详情页逻辑
│
├── data/                     # 数据目录
│   └── kuma-lite.db         # SQLite 数据库文件
│
├── docs/                     # 项目文档
│   ├── API.md               # API 接口文档
│   ├── DEPLOYMENT.md        # 部署指南
│   ├── DEVELOPMENT.md       # 开发指南
│   └── ...                  # 其他文档
│
├── docker-compose.yml        # 生产环境 Docker Compose 配置
├── docker-compose.dev.yml    # 开发环境 Docker Compose 配置
├── Dockerfile               # Docker 镜像构建文件
├── go.mod                   # Go 模块依赖
├── go.sum                   # Go 模块校验
├── .env.example             # 环境变量示例
├── build.sh                 # 构建脚本
├── start.sh                 # 启动脚本
├── dev.sh                   # 开发模式启动
├── dev-stop.sh              # 停止开发容器
├── dev-logs.sh              # 查看开发日志
├── README.md                # 项目说明
├── QUICKSTART.md            # 快速开始指南
└── ARCHITECTURE.md          # 本文档
```

---

## 核心模块说明

### 1. 后端模块

#### 1.1 主程序 (`backend/main.go`)
**作用**: 应用程序入口，负责初始化各个模块并启动 HTTP 服务器。

**主要流程**:
1. 加载环境变量配置
2. 初始化数据库连接
3. 自动迁移数据表
4. 启动定时数据同步任务
5. 配置并启动 Gin HTTP 服务器

#### 1.2 API 层 (`backend/api/`)

**`router.go`** - 路由配置
- 定义 API 路由规则
- 配置静态文件服务
- 设置 CORS 跨域中间件

**路由列表**:
```
GET  /                          -> index.html
GET  /index.html                -> index.html
GET  /detail.html               -> detail.html
GET  /css/*                     -> 静态 CSS 文件
GET  /js/*                      -> 静态 JS 文件
GET  /api/health                -> 健康检查
GET  /api/monitors              -> 获取所有监控项
GET  /api/monitors/:id          -> 获取单个监控项
GET  /api/monitors/:id/history  -> 获取监控历史数据
GET  /api/stats                 -> 获取统计信息
```

**`handlers.go`** - 请求处理器
- `HealthCheck()`: 健康检查接口
- `GetMonitors()`: 返回所有监控项及其最新状态
- `GetMonitorByID()`: 返回指定监控项的详细信息
- `GetMonitorHistory()`: 返回指定监控项的历史记录
- `GetStats()`: 返回全局统计信息（总数/在线/离线）

#### 1.3 数据库层 (`backend/database/`)

**`db.go`** - 数据库连接
- 使用 GORM 连接 SQLite 数据库
- 提供单例模式的数据库实例
- 处理数据库初始化和迁移

**`repository.go`** - 数据访问层
- 封装所有数据库操作
- 提供 CRUD 接口
- 主要方法:
  - `SaveMonitor()`: 保存/更新监控项
  - `SaveHeartbeat()`: 保存心跳记录
  - `GetAllMonitors()`: 获取所有监控项
  - `GetMonitorByID()`: 获取单个监控项
  - `GetMonitorHistory()`: 获取历史记录

#### 1.4 数据获取层 (`backend/fetcher/`)

**`kuma.go`** - Kuma API 客户端
- 从 Uptime Kuma 获取监控数据
- 解析 Kuma API 响应
- 转换为内部数据结构

**核心方法**:
- `FetchAndSaveData()`: 主数据同步方法
- `ParseMonitors()`: 解析监控项数据
- `FetchHeartbeats()`: 获取历史心跳数据

**数据流**:
```
Kuma API (PublicGroupList) 
  -> ParseMonitors() 
  -> SaveMonitor()
  -> FetchHeartbeats() 
  -> SaveHeartbeat()
```

#### 1.5 缓存层 (`backend/cache/`)

**`cache.go`** - 内存缓存
- 使用 sync.Map 实现线程安全的内存缓存
- 支持 TTL（过期时间）
- 减少数据库查询压力

#### 1.6 定时任务 (`backend/scheduler/`)

**`scheduler.go`** - 数据同步调度器
- 每 60 秒从 Kuma API 同步数据
- 更新监控项状态
- 保存历史记录

#### 1.7 数据模型 (`backend/models/`)

**`monitor.go`** - 核心数据模型

**Monitor（监控项）**:
```go
type Monitor struct {
    ID              int       `gorm:"primaryKey" json:"id"`
    Name            string    `gorm:"size:255;not null" json:"name"`
    URL             string    `gorm:"size:512" json:"url"`
    Type            string    `gorm:"size:50" json:"type"`
    Status          int       `gorm:"default:0" json:"status"`      // 0=离线 1=在线 2=维护
    ResponseTime    float64   `json:"responseTime"`                 // 最新响应时间（毫秒）
    AvgResponseTime float64   `json:"avgResponseTime"`              // 平均响应时间
    Uptime          float64   `json:"uptime"`                       // 可用率（0-1）
    Group           string    `gorm:"size:100" json:"group"`        // Kuma 分组名称
    GroupOrder      int       `gorm:"default:0" json:"groupOrder"`  // 分组排序顺序（保持 Kuma 原始配置顺序）
    CreatedAt       time.Time `json:"createdAt"`
    UpdatedAt       time.Time `json:"updatedAt"`
}
```

**字段说明**:
- `GroupOrder`: 记录该监控项所属分组在 Kuma API `PublicGroupList` 中的索引位置，用于前端按原始配置顺序展示分组

**HeartBeat（心跳记录）**:
```go
type HeartBeat struct {
    ID           int       `gorm:"primaryKey" json:"id"`
    MonitorID    int       `gorm:"index;not null" json:"monitorId"`
    Status       int       `gorm:"not null" json:"status"`           // 0=离线 1=在线 2=维护
    ResponseTime float64   `json:"responseTime"`                     // 响应时间（毫秒）
    Message      string    `gorm:"type:text" json:"message"`
    CreatedAt    time.Time `gorm:"index" json:"createdAt"`
}
```

---

### 2. 前端模块

#### 2.1 主页面 (`static/index.html` + `static/js/app-v2.js`)

**功能**:
- 展示所有监控项的卡片列表
- 按 Kuma 原始配置顺序显示分组
- 实时更新监控状态
- 支持 100/50/25 次历史记录切换
- 点击卡片跳转到详情页

**核心组件**:
- **顶部横幅**: 显示全局状态（所有正常/部分异常）
- **控制栏**: 暂停/继续、立即刷新按钮
- **监控卡片**: 
  - 监控名称 + 状态图标
  - 运行时间圆环（0-100%）
  - 响应时间信息（LT/AL/MAX）
  - 状态栏（绿色=在线，红色=离线，橙色=部分在线）
  - 迷你趋势图（ECharts）
  - 周期切换按钮（100/50/25）

**数据流**:
```
fetchData() 
  -> GET /api/monitors
  -> fetchAllHistory() for each monitor
  -> GET /api/monitors/:id/history
  -> renderAllCharts()
```

**关键方法**:
- `fetchData()`: 获取所有监控项
- `fetchAllHistory()`: 获取所有历史记录
- `getDisplayHistory(monitor)`: 根据选择周期过滤历史
- `getAvgResponseTime(monitor)`: 计算平均延迟
- `getMaxResponseTime(monitor)`: 计算最大延迟
- `renderChart(monitor)`: 渲染 ECharts 图表
- `showTooltip(event, item)`: 显示状态格 tooltip
- `goToDetail(monitorId)`: 跳转到详情页

**计算属性**:
- `groupedMonitors()`: 按分组整理监控项并按 `groupOrder` 排序
  - 返回数组格式：`[{name, monitors, order}, ...]`
  - 排序规则：`sort((a, b) => a.order - b.order)`
  - **注意**：使用 `!== undefined` 判断避免 `groupOrder=0` 被误判为 falsy

**图表优化**:
- Y 轴从 0 开始
- 使用平均值 + 2倍标准差作为上限，排除极端异常值
- 保证正常延迟波动清晰可见

#### 2.2 详情页 (`static/detail.html` + `static/js/app-detail.js`)

**功能**:
- 展示单个监控项的详细信息
- 大型趋势图（450px 高度）
- 完整的统计信息
- 支持 100/50/25 次历史记录切换

**核心组件**:
- **返回按钮**: 返回主页
- **监控信息卡片**:
  - 大号运行时间圆环（80px）
  - 监控名称、URL、类型
  - 分组、当前响应、平均响应、最大延迟
- **周期选择器**: 100/50/25 按钮
- **大型状态栏**: 40px 高度，带图例
- **趋势图**: 
  - 450px 高度
  - 显示响应时间曲线
  - 使用 markPoint 标记离线时间点（红色 pin 图标）
- **统计卡片**: 在线率、总检查次数、在线/离线次数

**数据流**:
```
URL: /detail.html?id=123
  -> 解析 URLSearchParams
  -> GET /api/monitors/:id
  -> GET /api/monitors/:id/history
  -> renderChart()
```

**关键方法**:
- `fetchMonitor()`: 获取监控项基本信息
- `fetchHistory()`: 获取历史记录
- `changePeriod(period)`: 切换周期
- `renderChart()`: 渲染大型趋势图
- `showTooltip(event, item)`: 显示状态格 tooltip

**离线可视化**:
- 使用 ECharts markPoint 功能
- 红色 pin 图标 + "离线" 标签
- 比散点图更清晰

#### 2.3 样式文件

**`style-v2.css`** - 主页面样式
- 卡片网格布局（grid）
- 响应式设计（移动端自适应）
- 状态栏动画效果
- 自定义 tooltip 样式

**`style-detail.css`** - 详情页样式
- 大型元素设计（圆环、状态栏、图表）
- 统计卡片布局
- 响应式断点

---

## 数据流程

### 完整数据流程图

```
┌─────────────────────────────────────────────────────────┐
│                    Uptime Kuma API                      │
│              https://kuma.v2.games/                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ 每 60 秒轮询
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│              Backend (Go + Gin)                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Scheduler (定时任务)                            │  │
│  │    └─> Fetcher.FetchAndSaveData()               │  │
│  └──────────────────────────────────────────────────┘  │
│                     │                                    │
│                     ↓                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Fetcher (Kuma API 客户端)                      │  │
│  │    └─> ParseMonitors()                          │  │
│  │    └─> FetchHeartbeats()                        │  │
│  └──────────────────────────────────────────────────┘  │
│                     │                                    │
│                     ↓                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Database Repository (数据访问层)                │  │
│  │    └─> SaveMonitor()                            │  │
│  │    └─> SaveHeartbeat()                          │  │
│  └──────────────────────────────────────────────────┘  │
│                     │                                    │
│                     ↓                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │  SQLite Database                                 │  │
│  │    - monitors 表                                 │  │
│  │    - heart_beats 表                              │  │
│  └──────────────────────────────────────────────────┘  │
│                     ↑                                    │
│                     │ 查询                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │  API Handlers (HTTP 接口)                       │  │
│  │    - GET /api/monitors                          │  │
│  │    - GET /api/monitors/:id                      │  │
│  │    - GET /api/monitors/:id/history              │  │
│  │    - GET /api/stats                             │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTP/JSON
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│            Frontend (Vue 3 + ECharts)                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │  index.html (主页面)                             │  │
│  │    └─> app-v2.js                                │  │
│  │        - 获取监控列表                            │  │
│  │        - 获取历史数据                            │  │
│  │        - 渲染卡片和图表                          │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  detail.html (详情页)                            │  │
│  │    └─> app-detail.js                            │  │
│  │        - 获取单个监控信息                        │  │
│  │        - 获取完整历史数据                        │  │
│  │        - 渲染大型趋势图                          │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 关键技术实现

### 1. 智能 Y 轴范围计算

**问题**: 偶发大延迟会导致趋势图 Y 轴范围过大，正常波动看不清。

**解决方案**:
```javascript
// 计算平均值
const avgTime = validTimes.reduce((sum, t) => sum + t, 0) / validTimes.length;

// 计算标准差
const variance = validTimes.reduce((sum, t) => 
    sum + Math.pow(t - avgTime, 2), 0) / validTimes.length;
const stdDev = Math.sqrt(variance);

// 使用平均值 + 2倍标准差作为上限（包含95%正常数据）
maxTime = avgTime + 2 * stdDev;

// Y 轴: min=0, max=计算出的上限
```

### 2. 动态周期过滤

**需求**: 切换周期（100/50/25）时，状态栏、图表、统计数据同步更新。

**实现**:
```javascript
// 主页面
getDisplayHistory(monitor) {
    return monitor.statusHistory.slice(-monitor.selectedPeriod);
}

// 详情页
computed: {
    displayHistory() {
        return this.historyData.slice(-this.selectedPeriod);
    },
    avgResponseTime() {
        // 基于 displayHistory 计算
    },
    maxResponseTime() {
        // 基于 displayHistory 计算
    }
}
```

### 3. 自定义 Tooltip

**问题**: 浏览器原生 title 属性不够明显。

**解决方案**: Vue 动态 tooltip 组件
```javascript
// 数据状态
tooltip: {
    show: false,
    text: '',
    x: 0,
    y: 0
}

// 鼠标事件
showTooltip(event, item) {
    const rect = event.target.getBoundingClientRect();
    this.tooltip.text = this.getStatusTitle(item);
    this.tooltip.x = rect.left + rect.width / 2;
    this.tooltip.y = rect.top - 10;
    this.tooltip.show = true;
}
```

### 4. 离线点可视化

**需求**: 在趋势图中清晰显示离线时间点。

**实现**: ECharts markPoint
```javascript
markPoint: {
    symbol: 'pin',
    symbolSize: 50,
    itemStyle: {
        color: '#ef4444',
        borderColor: '#dc2626',
        borderWidth: 2
    },
    label: {
        formatter: '离线',
        color: '#fff',
        fontSize: 11
    },
    data: offlineMarkers  // [{xAxis: index, yAxis: 0, value: '离线'}]
}
```

---

## 配置说明

### 环境变量 (`.env`)

```bash
# Kuma API 配置
KUMA_URL=https://kuma.v2.games/vps        # Kuma 状态页 URL
KUMA_API_URL=https://kuma.v2.games       # Kuma API 基础 URL

# 服务器配置
PORT=8080                                 # HTTP 服务端口

# 数据库配置
DB_PATH=./data/kuma-lite.db              # SQLite 数据库路径

# 同步配置
SYNC_INTERVAL=60                          # 数据同步间隔（秒）
```

---

## 部署方式

### 开发环境

```bash
# 启动开发容器（带热重载）
./dev.sh

# 查看日志
./dev-logs.sh

# 停止容器
./dev-stop.sh
```

### 生产环境

```bash
# 构建并启动
./build.sh
./start.sh

# 或使用 Docker Compose
docker-compose up -d
```

---

## API 接口规范

详见 `docs/API.md`

---

## 后续开发建议

### 1. 功能增强
- [ ] 添加告警功能（邮件/webhook 通知）
- [ ] 支持多个 Kuma 实例
- [ ] 添加用户认证和权限管理
- [ ] 导出监控数据（CSV/JSON）
- [ ] 自定义仪表板布局

### 2. 性能优化
- [ ] 实现 WebSocket 实时推送
- [ ] 添加 Redis 缓存层
- [ ] 历史数据定期归档
- [ ] 前端资源 CDN 加速

### 3. 监控增强
- [ ] 更多图表类型（饼图、柱状图）
- [ ] SLA 报告生成
- [ ] 响应时间分位数统计（P50/P95/P99）
- [ ] 监控对比功能

### 4. 用户体验
- [ ] 深色模式支持
- [ ] 多语言支持
- [ ] 移动端原生应用
- [ ] 自定义主题颜色

---

## 维护指南

### 日志查看
```bash
# 开发环境
./dev-logs.sh

# 生产环境
docker-compose logs -f
```

### 数据库备份
```bash
# 备份
cp data/kuma-lite.db data/kuma-lite.db.backup

# 恢复
cp data/kuma-lite.db.backup data/kuma-lite.db
```

### 清理旧数据
```sql
-- 删除 30 天前的心跳记录
DELETE FROM heart_beats WHERE created_at < datetime('now', '-30 days');

-- 清理孤立的心跳记录
DELETE FROM heart_beats WHERE monitor_id NOT IN (SELECT id FROM monitors);
```

---

## 贡献指南

欢迎提交 Issue 和 Pull Request！

### 代码规范
- **Go**: 遵循 `gofmt` 和 `golint` 规范
- **JavaScript**: 使用 ES6+ 语法，保持代码简洁
- **CSS**: 使用 BEM 命名规范

### 提交规范
```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式调整
refactor: 重构
test: 测试相关
chore: 构建/工具相关
```

---

## 许可证

MIT License

---

## 联系方式

- 项目地址: [GitHub 仓库地址]
- 作者: [作者信息]
- Email: [联系邮箱]

---

**最后更新**: 2025-10-18
