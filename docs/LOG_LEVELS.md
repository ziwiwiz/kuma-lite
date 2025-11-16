# 日志级别配置说明

## 概述

Kuma-Lite 支持灵活的日志级别配置，可以分别控制后端和前端的日志输出。

## 后端日志配置

### 日志级别

支持以下日志级别（从低到高）：

- **DEBUG**: 调试信息，包含详细的系统运行状态
- **INFO**: 一般信息，包括系统启动、API调用等（默认）
- **WARN**: 警告信息
- **ERROR**: 错误信息
- **FATAL**: 致命错误，会导致程序退出

### 环境变量配置

```bash
# 设置日志级别
LOG_LEVEL=INFO          # 可选值: DEBUG, INFO, WARN, ERROR, FATAL

# 启用/禁用彩色输出
LOG_ENABLE_COLOR=true   # 可选值: true, false
```

### Docker Compose 配置示例

```yaml
environment:
  - LOG_LEVEL=INFO
  - LOG_ENABLE_COLOR=true
```

### 日志输出示例

**INFO 级别**:
```
[INFO] 2025-11-17 10:30:00 - 日志系统初始化完成 - 级别: INFO
[INFO] 2025-11-17 10:30:00 - Kuma-Lite 启动中...
[INFO] 2025-11-17 10:30:01 - 服务器启动在端口 8080
```

**DEBUG 级别**:
```
[DEBUG] 2025-11-17 10:30:00 - ═══════════════════════════════════
[INFO] 2025-11-17 10:30:00 - 🚀 [系统启动] ▶ 阶段1: 开始获取数据
[DEBUG] 2025-11-17 10:30:00 - ═══════════════════════════════════
```

## 前端日志配置

前端会自动读取后端的日志级别配置，通过 `/api/log-config` API 获取。

### API 端点

```
GET /api/log-config
```

**响应示例**:
```json
{
  "logLevel": "INFO"
}
```

### 前端日志使用

前端JavaScript代码会根据后端返回的日志级别决定是否输出调试信息。

**建议**:
- **生产环境**: 使用 `INFO` 或 `WARN` 级别
- **开发环境**: 使用 `DEBUG` 级别
- **故障排查**: 临时切换到 `DEBUG` 级别

## 日志级别对比

| 级别 | 输出内容 | 适用场景 |
|------|----------|----------|
| DEBUG | 所有日志（包括详细调试信息） | 开发调试、故障排查 |
| INFO | 一般信息及以上 | 生产环境（推荐） |
| WARN | 警告及以上 | 只关注警告和错误 |
| ERROR | 错误及以上 | 只关注错误信息 |
| FATAL | 仅致命错误 | 极简日志输出 |

## 运行时修改日志级别

目前不支持运行时动态修改，需要：

1. 修改环境变量或配置文件
2. 重启容器/服务

```bash
# Docker 环境
docker-compose down
# 修改 .env 或 docker-compose.yml 中的 LOG_LEVEL
docker-compose up -d
```

## 注意事项

1. **DEBUG 级别会产生大量日志**，仅在需要时使用
2. **彩色输出**在某些日志收集系统中可能显示异常，可以通过 `LOG_ENABLE_COLOR=false` 关闭
3. 日志配置对性能影响较小，可以根据需要灵活调整
4. 建议在生产环境使用 `INFO` 级别，在开发和调试时使用 `DEBUG` 级别

## 示例：不同场景的配置

### 生产环境
```bash
LOG_LEVEL=INFO
LOG_ENABLE_COLOR=true
```

### 开发环境
```bash
LOG_LEVEL=DEBUG
LOG_ENABLE_COLOR=true
```

### 容器日志收集（如 ELK、Loki）
```bash
LOG_LEVEL=INFO
LOG_ENABLE_COLOR=false  # 避免ANSI颜色码干扰
```

### 故障排查
```bash
LOG_LEVEL=DEBUG
LOG_ENABLE_COLOR=true
```
