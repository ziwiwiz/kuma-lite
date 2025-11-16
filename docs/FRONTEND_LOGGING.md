# 前端日志系统使用说明

## 概述

前端日志系统 (`static/js/logger.js`) 提供了与后端一致的日志级别控制，可以根据后端配置自动调整前端日志输出。

## 快速开始

### 1. 引入日志模块

在HTML文件中引入：

```html
<!-- 在其他JS文件之前引入 -->
<script src="/js/logger.js"></script>
<script src="/js/app-v2.js"></script>
```

### 2. 使用日志方法

```javascript
// DEBUG级别 - 详细调试信息
logger.debug('正在初始化图表...', chartData);

// INFO级别 - 一般信息
logger.info('数据加载完成:', monitors.length, '个监控项');

// WARN级别 - 警告信息
logger.warn('缓存未命中，从服务器获取数据');

// ERROR级别 - 错误信息
logger.error('数据加载失败:', error);

// FATAL级别 - 致命错误
logger.fatal('无法连接到服务器:', error);
```

## 日志级别控制

### 自动配置

日志系统会在页面加载时自动从后端获取配置：

```javascript
// 自动调用，无需手动初始化
// GET /api/log-config
// 返回: { "logLevel": "INFO" }
```

### 手动设置

如需手动设置日志级别：

```javascript
// 设置为DEBUG级别（显示所有日志）
logger.setLevel('DEBUG');

// 设置为WARN级别（只显示警告和错误）
logger.setLevel('WARN');
```

## 实际应用示例

### 示例1：数据加载

```javascript
async function loadMonitors() {
    logger.debug('开始加载监控数据...');
    
    try {
        const response = await fetch('/api/monitors');
        const data = await response.json();
        
        logger.info('监控数据加载成功:', data.length, '项');
        logger.debug('数据详情:', data);
        
        return data;
    } catch (error) {
        logger.error('加载监控数据失败:', error);
        throw error;
    }
}
```

### 示例2：图表初始化

```javascript
function initChart(chartId, data) {
    logger.debug('初始化图表:', chartId);
    logger.debug('图表数据点数:', data.length);
    
    try {
        const chart = echarts.init(document.getElementById(chartId));
        chart.setOption(option);
        
        logger.info('图表初始化成功:', chartId);
    } catch (error) {
        logger.error('图表初始化失败:', chartId, error);
    }
}
```

### 示例3：API请求

```javascript
async function triggerFetch(source) {
    logger.info('触发数据采集:', source);
    logger.debug('请求参数:', { source });
    
    try {
        const response = await fetch(`/api/trigger-fetch?source=${source}`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            logger.error('采集触发失败:', response.status, response.statusText);
            return;
        }
        
        const result = await response.json();
        logger.info('采集任务已启动:', result);
        logger.debug('响应详情:', result);
    } catch (error) {
        logger.error('采集请求异常:', error);
    }
}
```

## 日志级别说明

| 级别 | 方法 | 用途 | 生产环境 |
|------|------|------|----------|
| DEBUG | `logger.debug()` | 详细调试信息、变量值 | ❌ 不显示 |
| INFO | `logger.info()` | 一般操作信息 | ✅ 显示 |
| WARN | `logger.warn()` | 警告但不影响运行 | ✅ 显示 |
| ERROR | `logger.error()` | 错误信息 | ✅ 显示 |
| FATAL | `logger.fatal()` | 致命错误 | ✅ 显示 |

## 最佳实践

### 1. 合理使用日志级别

```javascript
// ✅ 好的做法
logger.debug('循环处理:', index, item);  // 详细调试
logger.info('用户操作:', action);        // 重要操作
logger.warn('数据缺失:', field);         // 潜在问题
logger.error('请求失败:', error);        // 错误情况

// ❌ 不好的做法
logger.info('进入函数');                 // 太详细，应用debug
logger.error('数据为空');                // 不是错误，应用warn
```

### 2. 提供足够的上下文

```javascript
// ✅ 好的做法
logger.error('加载监控数据失败:', monitorId, error);

// ❌ 不好的做法
logger.error('失败');  // 信息不足
```

### 3. 避免敏感信息

```javascript
// ❌ 不要记录敏感信息
logger.debug('用户密码:', password);
logger.debug('API密钥:', apiKey);

// ✅ 记录必要的非敏感信息
logger.debug('用户ID:', userId);
logger.debug('请求路径:', path);
```

### 4. 性能考虑

```javascript
// ✅ 大量数据使用DEBUG级别
logger.debug('心跳数据详情:', heartbeats);  // 生产环境不输出

// ❌ 避免在循环中使用INFO
for (let item of items) {
    logger.info('处理:', item);  // 会产生大量日志
}

// ✅ 在循环外总结
logger.info('处理完成:', items.length, '项');
```

## 与后端日志配合

### 开发环境
```bash
# 后端设置
LOG_LEVEL=DEBUG

# 前端自动配置为DEBUG
# 显示所有详细日志
```

### 生产环境
```bash
# 后端设置
LOG_LEVEL=INFO

# 前端自动配置为INFO
# 只显示重要信息和错误
```

### 故障排查
```bash
# 临时切换到DEBUG
LOG_LEVEL=DEBUG

# 重启服务
docker-compose restart

# 前端会自动获取新配置
# 刷新页面后生效
```

## 浏览器控制台输出

### DEBUG级别输出
```
[DEBUG] 开始加载监控数据...
[DEBUG] 数据详情: Array(10)
[INFO] 监控数据加载成功: 10 项
[DEBUG] 初始化图表: chart-1
[DEBUG] 图表数据点数: 100
```

### INFO级别输出（生产环境推荐）
```
[INFO] 监控数据加载成功: 10 项
[INFO] 图表初始化成功: chart-1
```

### WARN级别输出
```
[WARN] 缓存未命中
[ERROR] 数据加载失败: NetworkError
```

## 注意事项

1. **自动初始化**：日志系统在页面加载时自动初始化，无需手动调用
2. **异步配置**：后端配置获取是异步的，初始化期间的日志使用默认INFO级别
3. **浏览器兼容**：使用标准console API，兼容所有现代浏览器
4. **性能影响**：DEBUG级别在生产环境会被过滤，不会影响性能
5. **实时更新**：修改后端日志级别后，需刷新页面才能生效

## 完整示例

```html
<!DOCTYPE html>
<html>
<head>
    <title>监控仪表盘</title>
    <script src="/js/logger.js"></script>
</head>
<body>
    <div id="app"></div>
    
    <script>
        // 等待日志系统初始化
        logger.init().then(() => {
            // 开始应用逻辑
            initApp();
        });
        
        function initApp() {
            logger.info('应用初始化开始');
            logger.debug('配置:', appConfig);
            
            loadData()
                .then(data => {
                    logger.info('数据加载完成:', data.length);
                    renderUI(data);
                })
                .catch(error => {
                    logger.error('应用初始化失败:', error);
                });
        }
    </script>
</body>
</html>
```

## 更多资源

- 后端日志配置：[docs/LOG_LEVELS.md](../docs/LOG_LEVELS.md)
- 日志系统升级说明：[LOG_SYSTEM_UPGRADE.md](../LOG_SYSTEM_UPGRADE.md)
