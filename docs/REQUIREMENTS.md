# Kuma-Lite 需求文档

## 项目背景

Uptime Kuma 是一个优秀的开源监控工具,但其内建的公开状态页面存在以下问题:
- 状态展示不够直观
- 缺少响应时间的图表展示
- 历史数据查看不便
- 无法自定义展示样式

## 项目目标

开发一个第三方监控仪表盘,通过抓取 Uptime Kuma 的公开状态页面数据,提供更直观、更强大的监控展示。

## 功能需求

### 1. 核心功能

#### 1.1 数据获取
- 从 Uptime Kuma 公开状态页面获取监控数据
- 支持定时自动刷新
- 解析监控项状态、响应时间、可用率等信息

#### 1.2 数据存储
- 内存缓存:提升访问速度
- SQLite 持久化:保存历史数据
- 自动清理过期数据

#### 1.3 监控展示
- 监控项列表展示
- 实时状态显示(正常/异常/维护中)
- 响应时间折线图
- 可用率百分比
- 事件日志

#### 1.4 API 接口
- 获取所有监控项
- 获取单个监控项详情
- 获取历史数据
- 获取统计信息

### 2. 非功能需求

#### 2.1 性能
- API 响应时间 < 100ms
- 支持并发访问
- 低内存占用

#### 2.2 可用性
- 单容器部署
- 简单的配置方式
- 自动错误恢复

#### 2.3 可维护性
- 清晰的代码结构
- 完善的文档
- 日志记录

## 技术约束

- 后端使用 Go 1.21+
- 前端使用 Vue 3 (CDN 引入)
- 数据库使用 SQLite
- 支持 Docker 部署

## 数据模型

### Monitor (监控项)
```go
type Monitor struct {
    ID          int       // 监控项 ID
    Name        string    // 监控项名称
    Type        string    // 类型 (http, tcp, ping 等)
    URL         string    // 监控地址
    Status      int       // 状态 (0-异常, 1-正常, 2-维护中)
    Uptime      float64   // 可用率 (%)
    ResponseTime int      // 响应时间 (ms)
    UpdatedAt   time.Time // 更新时间
}
```

### HeartBeat (心跳记录)
```go
type HeartBeat struct {
    ID          int       // 记录 ID
    MonitorID   int       // 监控项 ID
    Status      int       // 状态
    ResponseTime int      // 响应时间 (ms)
    Message     string    // 消息
    CreatedAt   time.Time // 创建时间
}
```

## 接口设计

### GET /api/monitors
返回所有监控项列表

**响应示例:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Website",
      "type": "http",
      "url": "https://example.com",
      "status": 1,
      "uptime": 99.9,
      "responseTime": 150,
      "updatedAt": "2025-10-17T10:00:00Z"
    }
  ]
}
```

### GET /api/monitors/:id
获取单个监控项详细信息

### GET /api/monitors/:id/history
获取监控项历史数据

**查询参数:**
- `hours`: 查询小时数 (默认 24)

### GET /api/stats
获取整体统计信息

## 配置项

- `KUMA_API_URL`: Uptime Kuma 实例地址
- `KUMA_STATUS_PAGE_SLUG`: 状态页面 slug
- `SERVER_PORT`: 服务端口 (默认 8080)
- `CACHE_DURATION`: 缓存时间 (秒, 默认 60)
- `FETCH_INTERVAL`: 数据获取间隔 (秒, 默认 30)
- `DB_PATH`: 数据库路径
- `DATA_RETENTION_DAYS`: 数据保留天数 (默认 30)
