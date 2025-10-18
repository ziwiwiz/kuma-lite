# Kuma Lite 文件清单

## 核心文件（当前使用）

### 前端文件
```
static/
├── index.html              # 主页面 - 监控列表
├── detail.html             # 详情页 - 单个监控详情
├── css/
│   ├── style-v2.css        # 主页面样式
│   └── style-detail.css    # 详情页样式
└── js/
    ├── app-v2.js           # 主页面逻辑（Vue 3）
    └── app-detail.js       # 详情页逻辑（Vue 3）
```

### 后端文件
```
backend/
├── main.go                 # 程序入口
├── api/
│   ├── router.go          # 路由配置
│   └── handlers.go        # API 处理器
├── cache/
│   └── cache.go           # 内存缓存
├── config/
│   └── config.go          # 配置管理
├── database/
│   ├── db.go              # 数据库连接
│   └── repository.go      # 数据访问层
├── fetcher/
│   └── kuma.go            # Kuma API 客户端
├── models/
│   └── monitor.go         # 数据模型
└── scheduler/
    └── scheduler.go       # 定时任务
```

### 配置文件
```
├── docker-compose.yml      # 生产环境容器配置
├── docker-compose.dev.yml  # 开发环境容器配置
├── Dockerfile             # Docker 镜像构建文件
├── go.mod                 # Go 模块依赖
├── go.sum                 # Go 模块校验和
├── .env.example           # 环境变量示例
└── .gitignore             # Git 忽略规则
```

### 脚本文件
```
├── build.sh               # 构建脚本
├── start.sh               # 启动脚本
├── dev.sh                 # 开发模式启动
├── dev-stop.sh            # 停止开发容器
└── dev-logs.sh            # 查看开发日志
```

### 文档文件
```
docs/
├── API.md                 # API 接口文档
├── DEPLOYMENT.md          # 部署指南
├── DEVELOPMENT.md         # 开发指南
├── FRONTEND_OPTIMIZATION.md   # 前端优化记录
├── REQUIREMENTS.md        # 需求文档
├── TROUBLESHOOTING.md     # 故障排除
├── UI_DESIGN_NOTES.md     # UI 设计笔记
└── UI_OPTIMIZATION_REPORT.md  # UI 优化报告

根目录/
├── README.md              # 项目说明
├── QUICKSTART.md          # 快速开始
├── DEV_GUIDE.md           # 开发指南
├── ARCHITECTURE.md        # 架构文档（新增）
└── FILE_MANIFEST.md       # 本文件
```

---

## 已清理的文件（已删除）

### 旧版本前端文件
```
static/
├── index-new.html         # ✗ 已删除 - 旧版主页
├── index-v2.html          # ✗ 已删除 - v2 版本（已合并到 index.html）
├── index.html.backup      # ✗ 已删除 - 备份文件
├── index.html.backup-*    # ✗ 已删除 - 时间戳备份
├── index.html.card-backup # ✗ 已删除 - 卡片版本备份
├── index.html.list-backup # ✗ 已删除 - 列表版本备份
├── test-packet-loss.html  # ✗ 已删除 - 测试文件
└── test-vue.html          # ✗ 已删除 - 测试文件
```

### 旧版本 JavaScript 文件
```
static/js/
├── app.js                 # ✗ 已删除 - 旧版主页逻辑
├── app-new.js             # ✗ 已删除 - 新版本测试
├── components.js          # ✗ 已删除 - 旧组件
└── components.js.backup   # ✗ 已删除 - 备份
```

### 旧版本 CSS 文件
```
static/css/
├── style.css              # ✗ 已删除 - 旧版样式
└── style-new.css          # ✗ 已删除 - 新版测试样式
```

### 其他清理
```
.history/                  # ✗ 已删除 - 历史记录目录
```

---

## 文件用途说明

### 主要页面文件

#### `static/index.html`
**用途**: 监控列表主页面  
**功能**:
- 显示所有监控项的卡片网格
- 按 Kuma 原始配置顺序展示分组
- 实时状态更新（60秒）
- 支持 100/50/25 次历史切换
- 点击卡片跳转详情页

**依赖**:
- Vue 3.3.4 (CDN)
- Axios 1.5.0 (CDN)
- ECharts 5.4.3 (CDN)
- `/css/style-v2.css?v=20251018-3`
- `/js/app-v2.js?v=20251018-3`

#### `static/detail.html`
**用途**: 单个监控详情页  
**功能**:
- 显示单个监控的完整信息
- 大型趋势图（450px）
- 详细统计信息
- 周期切换（100/50/25）
- 离线点 markPoint 可视化

**依赖**:
- Vue 3.3.4 (CDN)
- Axios 1.5.0 (CDN)
- ECharts 5.4.3 (CDN)
- `/css/style-detail.css`
- `/js/app-detail.js`

### JavaScript 文件

#### `static/js/app-v2.js`
**用途**: 主页面 Vue 应用逻辑  
**核心功能**:
- 监控数据获取和刷新
- 历史数据获取
- ECharts 图表渲染
- 周期过滤和切换
- Tooltip 显示
- 响应时间统计（平均/最大）
- 分组排序（按 groupOrder）

**关键方法**:
```javascript
fetchData()              // 获取监控列表
fetchAllHistory()        // 获取所有历史
getDisplayHistory()      // 根据周期过滤
getAvgResponseTime()     // 计算平均延迟
getMaxResponseTime()     // 计算最大延迟
renderChart()            // 渲染图表
showTooltip()            // 显示提示
goToDetail()             // 跳转详情
```

**计算属性**:
```javascript
groupedMonitors()        // 按分组整理并按 groupOrder 排序
                         // 注意：使用 !== undefined 判断避免 groupOrder=0 误判
```

#### `static/js/app-detail.js`
**用途**: 详情页 Vue 应用逻辑  
**核心功能**:
- URL 参数解析
- 单个监控数据获取
- 完整历史数据获取
- 大型趋势图渲染
- 离线点 markPoint 标记
- 统计信息计算

**关键方法**:
```javascript
fetchMonitor()           // 获取监控信息
fetchHistory()           // 获取历史数据
changePeriod()           // 切换周期
renderChart()            // 渲染大图表
showTooltip()            // 显示提示
```

### CSS 文件

#### `static/css/style-v2.css`
**用途**: 主页面样式  
**包含**:
- 全局样式重置
- 卡片网格布局
- 状态栏样式
- 迷你图表容器
- 自定义 tooltip
- 响应式设计（移动端）
- 加载动画

#### `static/css/style-detail.css`
**用途**: 详情页样式  
**包含**:
- 大型元素样式
- 监控信息卡片
- 统计卡片网格
- 大型状态栏（40px）
- 大型图表容器（450px）
- 响应式设计
- 返回按钮样式

### 后端核心文件

#### `backend/main.go`
**用途**: 程序入口  
**职责**:
- 加载配置
- 初始化数据库
- 启动定时任务
- 启动 HTTP 服务

#### `backend/api/router.go`
**用途**: 路由配置  
**定义路由**:
```
GET /                          -> index.html
GET /detail.html               -> detail.html
GET /api/monitors              -> 监控列表
GET /api/monitors/:id          -> 单个监控
GET /api/monitors/:id/history  -> 历史数据
GET /api/stats                 -> 统计信息
```

#### `backend/api/handlers.go`
**用途**: API 请求处理  
**处理器**:
- `HealthCheck`: 健康检查
- `GetMonitors`: 获取监控列表
- `GetMonitorByID`: 获取单个监控
- `GetMonitorHistory`: 获取历史记录
- `GetStats`: 获取统计信息

#### `backend/fetcher/kuma.go`
**用途**: Kuma API 数据同步  
**核心流程**:
1. 从 Kuma API 获取 PublicGroupList
2. 解析监控项和分组信息
3. 获取每个监控的心跳历史
4. 保存到本地数据库

#### `backend/models/monitor.go`
**用途**: 数据模型定义  
**模型**:
- `Monitor`: 监控项
  - 包含 `GroupOrder` 字段：记录分组在 Kuma API 中的索引位置
  - 用于前端按原始配置顺序展示分组
- `HeartBeat`: 心跳记录

**字段说明**:
```go
GroupOrder int  // 分组排序顺序，值为该分组在 Kuma PublicGroupList 中的索引
                // 前端使用此字段保持与 Kuma 一致的分组顺序
```

---

## 数据库文件

```
data/
└── kuma-lite.db           # SQLite 数据库

表结构:
- monitors                 # 监控项表
- heart_beats              # 心跳记录表
```

---

## Docker 文件

#### `Dockerfile`
**用途**: 构建 Docker 镜像  
**特点**:
- 多阶段构建
- Go 1.21-bullseye 编译
- Debian bullseye-slim 运行
- CGO_ENABLED=1 支持 SQLite

#### `docker-compose.yml`
**用途**: 生产环境部署  
**配置**:
- 端口映射: 8080:8080
- 数据卷: ./data:/data
- 自动重启

#### `docker-compose.dev.yml`
**用途**: 开发环境  
**配置**:
- 代码挂载（热重载）
- 实时编译
- 日志输出

---

## 脚本文件说明

#### `build.sh`
构建 Docker 镜像

#### `start.sh`
启动生产容器

#### `dev.sh`
启动开发容器（热重载）

#### `dev-stop.sh`
停止开发容器

#### `dev-logs.sh`
查看开发日志（实时）

---

## 文件统计

### 当前文件数量
- **前端文件**: 6 个（2 HTML + 2 CSS + 2 JS）
- **后端文件**: 9 个（Go 源码）
- **配置文件**: 6 个
- **文档文件**: 14 个
- **脚本文件**: 5 个
- **总计**: 40 个核心文件

### 已清理文件
- **删除文件**: 13 个
- **清理目录**: 1 个（.history）

---

## 重要技术说明

### 分组排序实现（GroupOrder）

**问题**: 前端需要按照 Kuma 原始配置的分组顺序展示监控项

**解决方案**:
1. **后端**：在 `Monitor` 模型添加 `GroupOrder` 字段
2. **数据抓取**：`fetcher/kuma.go` 的 `ParseMonitors()` 遍历 `PublicGroupList` 时记录索引
3. **前端排序**：`app-v2.js` 的 `groupedMonitors()` 计算属性按 `order` 升序排序

**关键 Bug 修复**:
```javascript
// ❌ 错误写法（groupOrder=0 会被误判为 falsy）
order: monitor.groupOrder || 999

// ✅ 正确写法
order: monitor.groupOrder !== undefined ? monitor.groupOrder : 999
```

**影响**: 保证 bwg (groupOrder=0) 等分组显示在正确位置

---

**最后更新**: 2025-10-18  
**维护人员**: [维护者]
