# Kuma-Lite API 文档

## 基础信息

- **Base URL**: `http://localhost:8080`
- **Content-Type**: `application/json`

## API 端点

### 1. 获取所有监控项

**端点**: `GET /api/monitors`

**描述**: 获取所有监控项的列表及当前状态

**响应**:
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
  ],
  "timestamp": "2025-10-17T10:00:00Z"
}
```

**状态码**:
- `200`: 成功
- `500`: 服务器错误

### 2. 获取单个监控项

**端点**: `GET /api/monitors/:id`

**描述**: 获取指定监控项的详细信息

**路径参数**:
- `id` (int): 监控项 ID

**响应**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Website",
    "type": "http",
    "url": "https://example.com",
    "status": 1,
    "uptime": 99.9,
    "responseTime": 150,
    "updatedAt": "2025-10-17T10:00:00Z"
  }
}
```

### 3. 获取监控历史

**端点**: `GET /api/monitors/:id/history`

**描述**: 获取指定监控项的历史心跳数据

**路径参数**:
- `id` (int): 监控项 ID

**查询参数**:
- `hours` (int, 可选): 查询最近 N 小时的数据,默认 24

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "monitorId": 1,
      "status": 1,
      "responseTime": 150,
      "message": "OK",
      "createdAt": "2025-10-17T10:00:00Z"
    }
  ]
}
```

### 4. 获取统计信息

**端点**: `GET /api/stats`

**描述**: 获取整体监控统计信息

**响应**:
```json
{
  "success": true,
  "data": {
    "totalMonitors": 10,
    "upMonitors": 9,
    "downMonitors": 1,
    "avgUptime": 99.5,
    "avgResponseTime": 200
  }
}
```

### 5. 健康检查

**端点**: `GET /api/health`

**描述**: 检查服务健康状态

**响应**:
```json
{
  "success": true,
  "message": "Service is healthy"
}
```

## 错误响应

所有 API 错误响应格式:

```json
{
  "success": false,
  "error": "错误描述信息"
}
```

## 状态码说明

- `1`: 正常 (Up)
- `0`: 异常 (Down)
- `2`: 维护中 (Maintenance)

## 数据更新频率

- 监控数据每 30 秒从 Uptime Kuma 获取一次
- API 响应使用缓存,缓存时间 60 秒
- 历史数据实时查询数据库
