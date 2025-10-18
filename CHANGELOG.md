# Kuma Lite 更新日志

## [2025-10-19] - 详情页 UI 全面优化

### ✨ 主要功能优化

#### 1. 状态颜色与可视化优化
- ✅ **修改维护中状态颜色**：从蓝色改为橙色 (#f59e0b)，更符合警告语义
- ✅ **趋势图背景标记 (markArea)**：
  - 维护时段显示橙色半透明背景
  - 离线时段显示红色半透明背景
  - 使用时间标签替代索引，消除左右空白间隙
- ✅ **删除冗余标记**：移除详情页趋势图上的离线 markPoint 标签，避免信息重复

#### 2. Tooltip 修复
- ✅ **主页 Tooltip 重复显示问题**：将 tooltip 元素移到 v-for 循环外部
- ✅ **清理调试代码**：移除所有 console.log 调试语句

#### 3. 详情页布局大幅优化
- ✅ **整合统计信息**：
  - 删除右上角重复的在线率百分比圆圈
  - 将 4 个统计数据整合到监控信息卡片中
  - 周期选择器移至顶部卡片右上角
  - 删除单独的统计信息栏
  
- ✅ **删除状态历史条**：移除冗余的状态条可视化（与趋势图 markArea 重复）

- ✅ **精简信息展示**：
  - 删除"类型"和"分组"统计框
  - 删除"响应时间趋势"标题
  - 统计框从 9 个精简至 7 个

- ✅ **优化图表布局**：
  - Y轴标题移至图表右上角，与图例同行显示
  - 图例顺序调整：在线 → 维护中 → 离线/丢包
  - 图例右对齐显示

#### 4. 周期选择器改进
- ✅ **从按钮改为下拉框**：
  - 新选项：最近(100条)、3h、6h、24h、1w
  - 基于时间范围过滤数据
  - displayHistory() 支持按小时过滤
  - 在线率计算基于选中的时间范围

#### 5. 页面紧凑化优化
- ✅ **大幅压缩顶部信息**：
  - 卡片内边距：30px → 15px 20px (减少 50%)
  - 标题字体：20px → 22px (先缩小后放大以适配)
  - 状态图标：40px → 28px
  - 统计框布局改为 7 列固定宽度
  - 标签简化："当前响应"→"当前"，"平均响应"→"平均"
  - 统计框内边距：12px 15px → 8px 10px
  
- ✅ **周期选择器压缩**：
  - 宽度：140px → 110px
  - 内边距和字体全面缩小
  
- ✅ **图表区域优化**：
  - 内边距：25px → 12px 20px
  - 图例间距减少 50%
  - 图表上边距：40px → 20px
  - 图表下边距：60px → 45px
  
- ✅ **总体效果**：页面高度减少约 35-40%，一屏内可看到完整趋势图

#### 6. 返回按钮与状态整合
- ✅ **合并返回按钮与状态指示**：
  - 返回按钮改为圆形，显示向左箭头
  - 背景色根据服务状态动态变化（绿色/红色/橙色）
  - 添加 hover 效果（透明度 + 缩放）
  - 删除独立返回按钮栏，节省空间

#### 7. 趋势图细节优化
- ✅ **时间标签水平显示**：X轴时间从斜 45° 改为水平 0°，更易阅读
- ✅ **减少图表留白**：优化图例栏和图表之间的间距

### 🎨 UI/UX 改进
- 布局更简洁紧凑，信息层次更清晰
- 状态指示更直观（返回按钮颜色）
- 趋势图成为页面主要焦点
- 响应式布局优化（移动端 2 列显示统计数据）

### 🔧 技术改进
- markArea 使用时间标签 `times[index]` 替代索引，消除边界对齐问题
- 计算属性 displayHistory 支持时间范围过滤
- CSS Grid 布局优化统计框排列
- 版本号递增管理（v=20251019-25 至 v=20251019-36）

### 📝 文件变更
- `static/detail.html` - 布局重构，删除冗余元素，整合统计信息
- `static/css/style-detail.css` - 大量样式优化，删除旧样式，添加新样式
- `static/js/app-detail.js` - 周期选择逻辑，图表配置优化
- `static/js/app-v2.js` - markArea 实现，tooltip 修复
- `static/css/style-v2.css` - 颜色更新

### 🐛 Bug 修复
- ✅ 修复主页 tooltip 重复显示问题
- ✅ 修复 markArea 左右空白间隙问题
- ✅ 修复在线率计算未考虑选中时间范围的问题

---

## [2025-10-18-2] - 分组顺序优化

### 🐛 Bug 修复
- ✅ **修复分组顺序问题**：修复了 `groupOrder` 为 0 时被误判为 falsy 值的 bug
  - 问题：使用 `monitor.groupOrder || 999` 导致 groupOrder=0 的分组（bwg）被排到最后
  - 解决：改用 `monitor.groupOrder !== undefined ? monitor.groupOrder : 999`
  - 影响：分组现在按照 Kuma 原始配置顺序正确排列

### ✨ 功能优化
- ✅ **保持原始分组顺序**：添加 `GroupOrder` 字段记录 Kuma API 中的分组顺序
  - 后端：在 `Monitor` 模型添加 `GroupOrder int` 字段
  - 数据抓取：在 `ParseMonitors()` 中记录分组在 `PublicGroupList` 中的索引
  - 前端排序：`groupedMonitors` 计算属性按 `order` 升序排列
  - 模板更新：适配新的数组数据结构（从对象遍历改为数组遍历）

- ✅ **详情页 Tooltip 完善**：为详情页状态格添加 CSS 样式
  - 添加 `.custom-tooltip` 样式到 `style-detail.css`
  - 与主页面保持一致的悬浮提示体验
  - 显示时间、状态和响应时间

### 🔧 技术改进
- 添加版本号参数到静态文件引用（防止浏览器缓存）
- 添加调试输出：控制台显示分组排序结果

### 📝 文件变更
- `backend/models/monitor.go` - 添加 GroupOrder 字段
- `backend/fetcher/kuma.go` - 记录分组顺序索引
- `static/js/app-v2.js` - 修复 groupOrder 判断逻辑，添加排序和调试
- `static/index.html` - 更新模板遍历方式，添加版本号 v=20251018-3
- `static/css/style-detail.css` - 添加 custom-tooltip 样式

---

## [2025-10-18] - 项目整理与优化

### 🎉 主要更新

#### 1. 项目结构整理
- ✅ 清理了 13 个旧版本和测试文件
- ✅ 删除了 `.history` 历史记录目录
- ✅ 统一文件命名规范
- ✅ 优化目录结构

#### 2. 文档完善
- ✅ 创建 `ARCHITECTURE.md` - 完整的架构文档
- ✅ 创建 `FILE_MANIFEST.md` - 文件清单和用途说明
- ✅ 创建 `CHANGELOG.md` - 本更新日志
- ✅ 更新各种开发文档

#### 3. 功能优化

**前端优化**:
- ✅ 实现周期选择（100/50/25 次）
- ✅ 默认周期改为 100 次
- ✅ 显示最大延迟信息（MAX）
- ✅ 智能 Y 轴范围计算（排除极端异常值）
- ✅ 自定义 Vue Tooltip（替代浏览器原生）
- ✅ 详情页使用 markPoint 可视化离线点
- ✅ 响应式统计数据（基于选择周期）

**后端优化**:
- ✅ 添加 Group 字段支持 Kuma 分组
- ✅ 优化数据同步逻辑
- ✅ 添加详情页路由

### 📁 已删除文件

**静态文件** (13 个):
```
static/index-new.html
static/index-v2.html
static/index.html.backup
static/index.html.backup-20251018182424
static/index.html.card-backup
static/index.html.list-backup
static/test-packet-loss.html
static/test-vue.html
static/js/app.js
static/js/app-new.js
static/js/components.js
static/js/components.js.backup
static/css/style.css
static/css/style-new.css
```

**目录**:
```
.history/
```

### 📦 当前核心文件

**前端** (6 个):
- `index.html` - 主页面
- `detail.html` - 详情页
- `css/style-v2.css` - 主页样式
- `css/style-detail.css` - 详情页样式
- `js/app-v2.js` - 主页逻辑
- `js/app-detail.js` - 详情页逻辑

**后端** (9 个):
- `backend/main.go`
- `backend/api/router.go`
- `backend/api/handlers.go`
- `backend/cache/cache.go`
- `backend/config/config.go`
- `backend/database/db.go`
- `backend/database/repository.go`
- `backend/fetcher/kuma.go`
- `backend/models/monitor.go`
- `backend/scheduler/scheduler.go`

### 🔧 技术改进

#### Y 轴智能范围计算
**问题**: 偶发大延迟导致趋势图不清晰

**解决方案**:
```javascript
// 使用平均值 + 2倍标准差作为上限
const avgTime = validTimes.reduce((sum, t) => sum + t, 0) / validTimes.length;
const stdDev = Math.sqrt(variance);
maxTime = avgTime + 2 * stdDev;  // 包含约95%正常数据
```

**效果**: 
- Y 轴从 0 开始
- 自动排除极端异常值
- 正常波动清晰可见

#### 动态 Tooltip 实现
**问题**: 原生 title 属性不够明显

**解决方案**: Vue 响应式 Tooltip
```javascript
// 鼠标事件绑定
@mouseenter="showTooltip($event, item)"
@mouseleave="hideTooltip"

// 动态定位和内容
tooltip: {
    show: false,
    text: '',
    x: 0,
    y: 0
}
```

**效果**:
- 黑色半透明气泡
- 白色清晰文字
- 动态定位
- 显示时间和延迟信息

#### 离线点可视化
**问题**: 离线时间点不够清晰

**解决方案**: ECharts markPoint
```javascript
markPoint: {
    symbol: 'pin',           // 大头针图标
    symbolSize: 50,          // 50px 大小
    itemStyle: {
        color: '#ef4444'     // 红色
    },
    label: {
        formatter: '离线'    // 文字标签
    }
}
```

**效果**:
- 红色 pin 图标醒目
- "离线" 文字标签
- 比散点图更清晰

### 📊 数据流程

```
Kuma API (每60秒)
    ↓
Backend Scheduler
    ↓
Fetcher → Database
    ↓
API Handlers
    ↓
Frontend (Vue 3 + ECharts)
```

### 🎨 UI/UX 改进

1. **主页面**:
   - 卡片网格布局
   - 按 Kuma 分组显示
   - 100/50/25 周期切换
   - 实时状态更新（60秒）
   - 响应时间统计（LT/AL/MAX）
   - 迷你趋势图
   - 点击跳转详情

2. **详情页**:
   - 大号运行时间圆环（80px）
   - 完整监控信息
   - 大型趋势图（450px）
   - 离线点 markPoint 标记
   - 4 个统计卡片
   - 周期切换同步更新

3. **通用优化**:
   - 响应式设计
   - 移动端适配
   - 状态格 hover 效果
   - 自定义 tooltip
   - 平滑动画过渡

### 🐛 Bug 修复

- ✅ 修复状态栏颜色显示错误
- ✅ 修复周期切换时状态栏不更新
- ✅ 修复平均/最大延迟计算范围错误
- ✅ 修复 Y 轴范围计算导致趋势图不清晰
- ✅ 修复 tooltip 无法显示问题
- ✅ 修复详情页 404 错误

### 📖 文档更新

- ✅ `ARCHITECTURE.md` - 23KB 完整架构文档
- ✅ `FILE_MANIFEST.md` - 9KB 文件清单
- ✅ `CHANGELOG.md` - 本文件
- ✅ 更新 README.md
- ✅ 更新 QUICKSTART.md

### 🚀 性能优化

- ✅ 减少不必要的文件加载
- ✅ 优化图表渲染时机
- ✅ 添加 setTimeout 防止渲染阻塞
- ✅ 清理冗余代码

### 🔮 后续计划

#### 短期计划
- [ ] 添加搜索功能
- [ ] 支持自定义周期
- [ ] 添加导出功能
- [ ] 优化移动端体验

#### 中期计划
- [ ] WebSocket 实时推送
- [ ] 告警通知功能
- [ ] 多 Kuma 实例支持
- [ ] 用户认证系统

#### 长期计划
- [ ] SLA 报告生成
- [ ] 响应时间分位数统计
- [ ] 监控对比功能
- [ ] 深色模式支持

---

## [之前的版本]

### [2025-10-17] - 初始版本
- ✅ 基础监控展示
- ✅ Docker 部署支持
- ✅ Kuma API 集成
- ✅ SQLite 数据存储

---

**更新人员**: [维护者]  
**更新日期**: 2025-10-18
