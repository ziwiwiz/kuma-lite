# 🚀 Kuma-Lite 快速开始

## 功能特性

✨ **完整的 Uptime Kuma 数据展示**
- 实时监控状态（正常/异常/维护中）
- 响应时间统计
- 24小时可用率
- 42个监控项的完整数据

📊 **强大的可视化**
- 响应时间趋势图（24小时历史）
- 丢包/超时可视化（紫色尖峰）
- 彩色进度条显示在线率
- 悬停查看详细信息

🎨 **现代化界面**
- 卡片式布局
- 平滑动画效果
- 响应式设计
- 品牌色渐变背景

## 当前运行状态

### 容器状态
```bash
docker-compose -f docker-compose.dev.yml ps
```

### 访问地址
- **主界面**: http://localhost:8080
- **测试页面**: http://localhost:8080/test-packet-loss.html
- **API文档**: 见 `docs/API.md`

## 数据验证

### 查看统计信息
```bash
curl http://localhost:8080/api/stats | jq '.'
```

**预期输出**:
```json
{
  "success": true,
  "data": {
    "totalMonitors": 42,
    "upMonitors": 42,
    "downMonitors": 0,
    "avgUptime": 0.9958345701686779,
    "avgResponseTime": 198.61904761904762
  }
}
```

### 查看监控列表
```bash
curl http://localhost:8080/api/monitors | jq '.data[0:3]'
```

### 查看历史数据
```bash
curl http://localhost:8080/api/monitors/1/history?hours=24 | jq '.data[0:3]'
```

## 丢包可视化说明

### 图表解读
1. **橙色区域图**: 正常响应时间
   - 连续的曲线
   - 填充渐变效果
   - 悬停显示具体数值

2. **紫色尖峰**: 丢包/超时
   - 大头钉符号
   - 始终在 y=0 位置
   - 悬停显示"✗ 丢包/超时"

### 数据结构
```javascript
{
  "status": 1,        // 0=丢包, 1=正常
  "responseTime": 195, // 毫秒
  "createdAt": "2025-10-18T07:36:33.726Z"
}
```

## 界面操作

### 1. 查看监控概览
- 访问 http://localhost:8080
- 顶部显示统计信息（总数、正常、异常、平均可用率）
- 卡片网格显示所有监控项

### 2. 查看详细信息
- 点击任意监控卡片
- 弹出模态框显示详细信息
- 底部显示24小时响应时间趋势图
- 如有丢包，自动显示紫色标记

### 3. 测试丢包可视化
- 访问 http://localhost:8080/test-packet-loss.html
- 查看包含5%丢包率的模拟数据
- 验证图表渲染效果

## 数据更新机制

### 自动刷新
- **前端**: 每60秒自动刷新数据
- **后端**: 每30秒从 Kuma API 获取最新数据
- **数据保留**: 默认保留30天历史记录

### 手动刷新
刷新浏览器页面即可获取最新数据

## 停止和重启

### 停止容器
```bash
docker-compose -f docker-compose.dev.yml down
```

### 重启容器
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### 查看日志
```bash
docker-compose -f docker-compose.dev.yml logs -f
```

## 性能指标

### 当前配置
- **监控项数量**: 42
- **数据点密度**: 每分钟1个
- **历史数据**: 24小时 = 1440个数据点
- **数据库大小**: ~12MB
- **内存占用**: ~50MB
- **CPU使用**: 基本可忽略

### 响应时间
- **API响应**: <10ms (有缓存)
- **页面加载**: <1s
- **图表渲染**: <500ms

## 已知特性

### 当前监控状态
✅ 所有42个监控项均正常运行
✅ 平均在线率: 99.58%
✅ 平均响应时间: 198.6ms
✅ 无丢包记录（所有服务稳定）

### 测试建议
由于当前环境所有监控都很稳定，建议使用测试页面查看丢包可视化效果：
http://localhost:8080/test-packet-loss.html

## 开发模式

### 热重载
Docker开发环境已配置文件挂载：
- 修改 `backend/**/*.go` - 需要重新构建
- 修改 `static/**/*` - 自动生效（刷新浏览器）

### 重新构建
```bash
docker-compose -f docker-compose.dev.yml up -d --build
```

## 下一步

1. ✅ 数据获取完全正常
2. ✅ 界面美化完成
3. ✅ 丢包可视化实现
4. 🔄 可选: 添加更多功能（见 `docs/FRONTEND_OPTIMIZATION.md`）

## 问题排查

### 数据不显示
```bash
# 检查容器状态
docker-compose -f docker-compose.dev.yml ps

# 查看日志
docker-compose -f docker-compose.dev.yml logs --tail=50

# 检查数据库
docker-compose -f docker-compose.dev.yml exec kuma-lite-dev ls -lh /data/
```

### API错误
```bash
# 测试健康检查
curl http://localhost:8080/api/health

# 查看详细错误
docker-compose -f docker-compose.dev.yml logs -f | grep ERROR
```

## 文档索引

- 📖 **API文档**: `docs/API.md`
- 🛠️ **开发指南**: `docs/DEVELOPMENT.md`
- 🚀 **部署指南**: `docs/DEPLOYMENT.md`
- 🎨 **界面优化**: `docs/FRONTEND_OPTIMIZATION.md`
- 📋 **需求文档**: `docs/REQUIREMENTS.md`

---

**项目状态**: ✅ 生产就绪

**最后更新**: 2025-10-18

**Kuma 实例**: https://kuma.v2.games/vps (42 monitors)
