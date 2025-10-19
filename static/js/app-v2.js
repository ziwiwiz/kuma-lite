const { createApp } = Vue;

const app = createApp({
    data() {
        return {
            monitors: [],
            stats: null,
            loading: true,
            error: null,
            lastUpdate: '',
            countdown: 60,
            paused: false,
            charts: {},
            refreshInterval: null,
            countdownInterval: null,
            tooltip: {
                show: false,
                text: '',
                x: 0,
                y: 0
            }
        };
    },
    computed: {
        // 按组分类监控项，并按照 Kuma 原始配置的分组顺序排列
        groupedMonitors() {
            const groups = {};
            this.monitors.forEach(monitor => {
                // 使用 Kuma API 返回的 group 字段
                const groupName = monitor.group || 'other';
                if (!groups[groupName]) {
                    groups[groupName] = {
                        monitors: [],
                        order: monitor.groupOrder !== undefined ? monitor.groupOrder : 999 // 使用第一个 monitor 的 groupOrder
                    };
                }
                // 为每个监控项添加选中的时间段（默认100次）
                if (!monitor.selectedPeriod) {
                    monitor.selectedPeriod = 100;
                }
                groups[groupName].monitors.push(monitor);
            });
            
            // 转换为数组并按 order 排序
            const result = Object.entries(groups)
                .map(([name, data]) => ({
                    name: name,
                    monitors: data.monitors,
                    order: data.order
                }))
                .sort((a, b) => a.order - b.order);
            
            return result;
        }
    },
    mounted() {
        this.fetchData();
        this.startAutoRefresh();
    },
    beforeUnmount() {
        this.stopAutoRefresh();
    },
    methods: {
        // 获取数据
        async fetchData() {
            if (this.paused) return;
            
            try {
                this.loading = true;
                this.error = null;

                // 获取监控列表
                const monitorsRes = await axios.get('/api/monitors');
                if (monitorsRes.data.success) {
                    this.monitors = monitorsRes.data.data;
                    
                    // 为每个监控项获取历史数据
                    await this.fetchAllHistory();
                }

                // 获取统计信息
                const statsRes = await axios.get('/api/stats');
                if (statsRes.data.success) {
                    this.stats = statsRes.data.data;
                }

                this.lastUpdate = new Date().toLocaleString('zh-CN');
                this.loading = false;
                this.countdown = 60;
            } catch (err) {
                this.error = '获取数据失败: ' + (err.message || '未知错误');
                this.loading = false;
                console.error('Fetch error:', err);
            }
        },

        // 获取所有监控项的历史数据
        async fetchAllHistory() {
            const promises = this.monitors.map(async (monitor) => {
                try {
                    const res = await axios.get(`/api/monitors/${monitor.id}/history?hours=24`);
                    if (res.data.success && res.data.data.length > 0) {
                        monitor.statusHistory = res.data.data.slice(-100); // 最近100条
                        // 计算平均响应时间
                        const validResponses = res.data.data.filter(item => item.status === 1);
                        if (validResponses.length > 0) {
                            const sum = validResponses.reduce((acc, item) => acc + item.responseTime, 0);
                            monitor.avgResponseTime = Math.round(sum / validResponses.length);
                        }
                    } else {
                        monitor.statusHistory = [];
                    }
                } catch (err) {
                    console.error(`Failed to fetch history for monitor ${monitor.id}:`, err);
                    monitor.statusHistory = [];
                }
            });

            await Promise.all(promises);
            
            // 使用 Vue 的 nextTick 确保 DOM 更新后再渲染图表
            this.$nextTick(() => {
                // 增加延迟时间，确保图表容器已经完全渲染
                setTimeout(() => {
                    this.renderAllCharts();
                }, 300);
            });
        },

        // 获取显示的历史数据（根据选择的周期）
        getDisplayHistory(monitor) {
            if (!monitor.statusHistory) return [];
            const period = monitor.selectedPeriod || 100;
            return monitor.statusHistory.slice(-period);
        },

        // 获取平均响应时间
        getAvgResponseTime(monitor) {
            const data = this.getDisplayHistory(monitor);
            if (!data.length) return 0;
            const validTimes = data.filter(d => d.status === 1).map(d => d.responseTime);
            if (!validTimes.length) return 0;
            const avg = validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length;
            return Math.round(avg);
        },

        // 获取最大响应时间
        getMaxResponseTime(monitor) {
            const data = this.getDisplayHistory(monitor);
            if (!data.length) return 0;
            const validTimes = data.filter(d => d.status === 1).map(d => d.responseTime);
            if (!validTimes.length) return 0;
            return Math.max(...validTimes);
        },

        // 渲染所有图表
        renderAllCharts() {
            this.monitors.forEach(monitor => {
                const chartEl = document.getElementById('chart-' + monitor.id);
                if (chartEl) {
                    this.renderChart(monitor);
                }
            });
            
            // 如果有容器未找到，500ms 后重试一次
            setTimeout(() => {
                this.monitors.forEach(monitor => {
                    const chartEl = document.getElementById('chart-' + monitor.id);
                    if (chartEl && !this.charts[monitor.id]) {
                        this.renderChart(monitor);
                    }
                });
            }, 500);
        },

        // 渲染单个图表
        renderChart(monitor) {
            const chartEl = document.getElementById('chart-' + monitor.id);
            if (!chartEl) {
                console.warn(`图表容器不存在: chart-${monitor.id}`);
                return;
            }
            if (!monitor.statusHistory) {
                console.warn(`监控 ${monitor.id} 没有历史数据`);
                return;
            }
            if (monitor.statusHistory.length === 0) {
                console.warn(`监控 ${monitor.id} 历史数据为空`);
                return;
            }

            // 销毁旧图表
            if (this.charts[monitor.id]) {
                this.charts[monitor.id].dispose();
            }

            const chart = echarts.init(chartEl);
            this.charts[monitor.id] = chart;

            // 根据选择的周期过滤数据
            const period = monitor.selectedPeriod || 50;
            const data = this.getDisplayHistory(monitor);

            const times = data.map(item => {
                const date = new Date(item.createdAt);
                return date.toLocaleTimeString('zh-CN', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                });
            });

            // 构建连续的响应时间数据（保持数据连续性）
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
                // 离线/重试：使用前一个有效值
                return lastValidValue;
            });

            // 构建 markArea 数据 - 标记维护和离线时段
            const markAreas = [];
            let areaStart = null;
            let areaStatus = null;
            
            data.forEach((item, index) => {
                if (item.status !== 1) {
                    // 离线或维护状态
                    if (areaStart === null) {
                        // 开始新的区域
                        areaStart = index;
                        areaStatus = item.status;
                    } else if (areaStatus !== item.status) {
                        // 状态变化了,结束当前区域,开始新区域
                        markAreas.push({
                            status: areaStatus,
                            start: areaStart,
                            end: index - 1
                        });
                        areaStart = index;
                        areaStatus = item.status;
                    }
                } else {
                    // 正常状态
                    if (areaStart !== null) {
                        // 结束之前的区域
                        markAreas.push({
                            status: areaStatus,
                            start: areaStart,
                            end: index - 1
                        });
                        areaStart = null;
                        areaStatus = null;
                    }
                }
            });
            
            // 如果最后还有未结束的区域
            if (areaStart !== null) {
                markAreas.push({
                    status: areaStatus,
                    start: areaStart,
                    end: data.length - 1
                });
            }
            
            // 计算Y轴范围 - 使用平均值和标准差，避免偶发大延迟导致趋势图不清晰
            const validTimes = responseTimes.filter(t => t !== null);
            let maxTime = 100;
            
            if (validTimes.length > 0) {
                // 计算平均值
                const avgTime = validTimes.reduce((sum, t) => sum + t, 0) / validTimes.length;
                // 计算标准差
                const variance = validTimes.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / validTimes.length;
                const stdDev = Math.sqrt(variance);
                
                // 使用平均值 + 2倍标准差作为上限，这样可以包含约95%的正常数据
                // 同时排除极端异常值的影响
                maxTime = avgTime + 2 * stdDev;
                
                // 如果所有数据都很接近（标准差很小），使用最大值
                if (stdDev < avgTime * 0.2) {
                    maxTime = Math.max(...validTimes);
                }
                
                // 添加一些边距使图表更美观
                const margin = maxTime * 0.1 || 10;
                maxTime = maxTime + margin;
            }

            // 创建 Bar 遮罩数据：用 bar 覆盖离线/重试区域的趋势线
            const barMaskData = data.map((item) => {
                if (item.status === 1) {
                    return null;  // 正常状态不显示 bar
                }
                const color = item.status === 2 
                    ? 'rgba(245, 158, 11, 0.3)'  // 橙色 - 重试中
                    : 'rgba(239, 68, 68, 0.3)';   // 红色 - 离线
                
                return {
                    value: Math.round(maxTime),  // bar 高度覆盖整个 Y 轴
                    itemStyle: {
                        color: color,
                        borderWidth: 0
                    }
                };
            });
            
            const option = {
                grid: {
                    left: '50px',
                    right: '20px',
                    bottom: '30px',
                    top: '20px'
                },
                xAxis: {
                    type: 'category',
                    data: times,
                    boundaryGap: true,  // 数据点居中
                    axisLabel: {
                        fontSize: 11,
                        color: '#6b7280',
                        interval: Math.floor(times.length / 4)
                    },
                    axisLine: {
                        lineStyle: { color: '#e5e7eb' }
                    },
                    axisTick: {
                        show: false
                    }
                },
                yAxis: {
                    type: 'value',
                    min: 0,
                    max: Math.round(maxTime),
                    axisLabel: {
                        fontSize: 11,
                        color: '#6b7280'
                    },
                    axisLine: {
                        show: false
                    },
                    axisTick: {
                        show: false
                    },
                    splitLine: {
                        show: true,
                        lineStyle: {
                            color: '#e5e7eb',
                            width: 1,
                            type: 'dashed'
                        }
                    }
                },
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'line',
                        label: {
                            show: false
                        }
                    },
                    formatter: (params) => {
                        const dataIndex = params[0].dataIndex;
                        const item = data[dataIndex];
                        const time = times[dataIndex];
                        if (item.status === 1) {
                            return `<div style="text-align: left;">${time}<br/>状态: <span style="color: #10b981;">正常</span><br/>响应: ${item.responseTime}ms</div>`;
                        } else if (item.status === 2) {
                            return `<div style="text-align: left;">${time}<br/>状态: <span style="color: #f59e0b;">重试中</span></div>`;
                        } else {
                            return `<div style="text-align: left;">${time}<br/>状态: <span style="color: #ef4444;">离线</span></div>`;
                        }
                    }
                },
                series: [
                    {
                        // 趋势线（底层）
                        type: 'line',
                        data: responseTimes,
                        smooth: true,
                        showSymbol: false,
                        lineStyle: {
                            width: 2,
                            color: '#10b981'
                        },
                        z: 1  // 底层
                    },
                    {
                        // Bar 遮罩（上层）
                        type: 'bar',
                        data: barMaskData,
                        barWidth: '100%',
                        barGap: '-100%',  // 与趋势线重叠
                        z: 10,  // 上层
                        silent: false  // 允许 tooltip
                    }
                ]
            };

            chart.setOption(option);
        },

        // 切换图表周期
        changeChartPeriod(monitorId, period) {
            const monitor = this.monitors.find(m => m.id === monitorId);
            if (monitor) {
                monitor.selectedPeriod = period;
                this.$nextTick(() => {
                    this.renderChart(monitor);
                });
            }
        },

        // 跳转到详情页
        goToDetail(monitorId) {
            window.location.href = `/detail.html?id=${monitorId}`;
        },

        // 获取横幅样式类
        getBannerClass() {
            if (!this.stats) return 'success';
            if (this.stats.downMonitors === 0) return 'success';
            if (this.stats.downMonitors > 3) return 'error';
            return 'warning';
        },

        // 获取状态图标类
        getStatusIconClass(status) {
            if (status === 1) return 'up';
            if (status === 2) return 'maintenance';
            return 'down';
        },

        // 获取状态条类
        getStatusBarClass(item) {
            const status = typeof item === 'object' ? item.status : item;
            if (status === 1) return 'up';
            if (status === 2) return 'maintenance';
            if (status === 0) return 'down';
            return 'pending';
        },

        // 获取状态标题
        getStatusTitle(item) {
            const time = new Date(item.createdAt).toLocaleString('zh-CN');
            if (item.status === 1) {
                return `${time} - 正常 (${item.responseTime}ms)`;
            } else if (item.status === 2) {
                return `${time} - 重试中`;
            } else {
                return `${time} - 离线`;
            }
        },

        // 格式化可用率
        formatUptime(uptime) {
            return (uptime * 100).toFixed(2) + '%';
        },

        // 获取圆形进度条样式
        getUptimeCircleStyle(uptime) {
            const percent = uptime * 100;
            let color = '#10b981'; // 绿色
            if (percent < 95) color = '#ef4444'; // 红色
            else if (percent < 99) color = '#f59e0b'; // 橙色
            return { '--progress-color': color };
        },

        // 获取圆形进度条dasharray
        getCircleDasharray(uptime) {
            const percent = uptime * 100;
            return `${percent} 100`;
        },

        // 获取可用率颜色
        getUptimeColor(uptime) {
            const percent = uptime * 100;
            if (percent >= 99) return '#10b981'; // 绿色
            if (percent >= 95) return '#f59e0b'; // 橙色
            return '#ef4444'; // 红色
        },

        // 暂停/继续自动刷新
        togglePause() {
            this.paused = !this.paused;
            if (this.paused) {
                this.stopAutoRefresh();
            } else {
                this.startAutoRefresh();
                this.fetchData();
            }
        },

        // 开始自动刷新
        startAutoRefresh() {
            this.stopAutoRefresh();
            
            // 每60秒刷新数据
            this.refreshInterval = setInterval(() => {
                if (!this.paused) {
                    this.fetchData();
                }
            }, 60000);
            
            // 每秒更新倒计时
            this.countdownInterval = setInterval(() => {
                if (!this.paused && this.countdown > 0) {
                    this.countdown--;
                } else if (!this.paused && this.countdown === 0) {
                    this.countdown = 60;
                }
            }, 1000);
        },

        // 停止自动刷新
        stopAutoRefresh() {
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
                this.refreshInterval = null;
            }
            if (this.countdownInterval) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
            }
        },

        // 切换所有分组展开/收起（预留功能）
        toggleAllGroups() {
            // TODO: 实现分组展开/收起功能
        },

        // 显示 Tooltip
        showTooltip(event, item) {
            const rect = event.target.getBoundingClientRect();
            this.tooltip.text = this.getStatusTitle(item);
            this.tooltip.x = rect.left + rect.width / 2;
            this.tooltip.y = rect.top - 10;
            this.tooltip.show = true;
        },

        // 隐藏 Tooltip
        hideTooltip() {
            this.tooltip.show = false;
        }
    }
});

app.mount('#app');
