# 趋势图需求文档

## 当前状态
- 文件位置：
  - 详情页：`static/js/app-detail.js`
  - 主页：`static/js/app-v2.js`
- ECharts 图表配置
- **实现状态**：✅ 已完成（2025-10-19）

---

## 核心需求

### 1. 趋势线显示规则

#### 1.1 正常状态（status === 1）
- ✅ 显示绿色线条
- ✅ 使用实际响应时间 `item.responseTime`
- ✅ 显示数据点

#### 1.2 离线/重试状态（status !== 1）
- ✅ **数据连续性**：使用前一个有效值（lastValidValue），如果前面有效值取不到则取后面的
- 目的：保持数据的连续性，便于计算和参考
- ✅ **视觉隐藏**：通过 visualMap 控制线条颜色为透明（transparent）

---

### 2. 背景 markArea 显示

#### 2.1 显示区域
- ✅ 只在离线/重试状态（status !== 1）显示 markArea
- ✅ markArea 从 `area.start` 延伸到 `area.end + 1`，完整覆盖区域到下一个刻度边界

#### 2.2 颜色和透明度
- ✅ **重试中**（status === 2）：`rgba(245, 158, 11, 0.3)` - 橙色半透明
- ✅ **离线**（status === 0）：`rgba(239, 68, 68, 0.3)` - 红色半透明
- ✅ **透明度固定为 0.3**（不要更高，保持淡色）

---

### 3. 图表配置

#### 3.1 X 轴
- ✅ `type: 'category'`
- ✅ `boundaryGap: true` - 数据点自动居中在刻度之间
- ✅ 显示时间标签（HH:MM 格式）

#### 3.2 Y 轴
- ✅ `type: 'value'`
- ✅ 显示灰色虚线网格（splitLine）
- ✅ 自动计算范围（使用平均值+标准差）

#### 3.3 层级关系
- ✅ markArea 背景：`z: 10`（上层）
- ✅ 趋势线：`z: 1`（底层）
- ✅ 目标：markArea 显示时，通过 visualMap 隐藏下面的趋势线

#### 3.4 visualMap 配置
- ✅ `show: false` - 不显示控件
- ✅ `dimension: 0` - 基于 x 轴索引
- ✅ `pieces` - 为每个数据点配置颜色：
  - 正常状态：`#10b981`（绿色）
  - 离线/重试：`transparent`（透明）
- ✅ `seriesIndex: 0` - 只应用于趋势线 series

---

## 实现细节

### 4.1 markArea 构建逻辑
```javascript
const markAreaData = markAreas.map(area => {
    const color = area.status === 2
        ? 'rgba(245, 158, 11, 0.3)'  // 橙色 - 重试中
        : 'rgba(239, 68, 68, 0.3)';   // 红色 - 离线
    
    // +1 延伸到下一个刻度边界，确保完整覆盖
    return [
        { xAxis: area.start, itemStyle: { color: color } },
        { xAxis: area.end + 1 }
    ];
});
```

### 4.2 数据连续性逻辑
```javascript
let lastValidValue = null;
let firstValidValue = null;

// 先找第一个有效值
for (let i = 0; i < data.length; i++) {
    if (data[i].status === 1) {
        firstValidValue = data[i].responseTime;
        break;
    }
}

lastValidValue = firstValidValue;
const responseTimes = data.map(item => {
    if (item.status === 1) {
        lastValidValue = item.responseTime;
        return item.responseTime;
    }
    return lastValidValue;  // 使用前一个有效值
});
```

### 4.3 自动刷新处理
- ✅ 详情页自动刷新（60秒）时调用 `renderChart()` 完全重建图表
- ✅ 确保 markArea、visualMap、tooltip 等所有配置正确应用
- ✅ 增量数据更新后触发图表重新渲染

---

## 验收标准
1. ✅ 正常状态之间的趋势线保持连接（不断开）
2. ✅ 离线/重试区域看不到绿色趋势线（关键部分）
3. ✅ markArea 背景颜色淡（透明度 0.3）
4. ✅ 数据保持连续性（可用于计算）
5. ✅ markArea 完整覆盖到下一个数据点边界
6. ✅ 自动刷新时所有效果正确更新
7. ✅ tooltip 在所有情况下正常显示

---

## 已知问题和解决方案

### 问题 1：单个数据点 markArea 无法显示
**原因**：markArea 需要区域范围，单点（start === end）无法显示  
**解决**：使用 `area.end + 1` 让单点也能形成区域

### 问题 2：markArea 未延伸到下一个数据点
**原因**：`boundaryGap: true` 时，数据点在刻度中间，`xAxis: area.end` 只到数据点中心  
**解决**：使用 `xAxis: area.end + 1` 延伸到下一个刻度边界

### 问题 3：自动刷新时趋势线隐藏/显示失效
**原因**：`updateChart()` 增量更新时配置不完整，visualMap 未更新  
**解决**：改用 `renderChart()` 完全重建图表，确保所有配置正确应用

### 问题 4：自动刷新后 tooltip 消失
**原因**：增量更新时 tooltip 配置被覆盖  
**解决**：使用 `renderChart()` 完全重建，保留所有配置

---

## 版本历史
- **v1.0.2** (2025-10-19)
  - ✅ 使用 markArea + visualMap 实现需求
  - ✅ 修复 markArea 边界延伸问题
  - ✅ 修复自动刷新时配置更新问题
  - ✅ 优化数据连续性逻辑
