const { createApp } = Vue;

const app = createApp({
    data() {
        return {
            monitorId: null,
            monitor: null,
            historyData: [],
            loading: true,
            error: null,
            selectedPeriod: 'recent',  // 默认"最近"
            showPeriodDropdown: false,
            periodOptions: [
                { value: 'recent', label: '最近', hours: null },
                { value: '3h', label: '3h', hours: 3 },
                { value: '6h', label: '6h', hours: 6 },
                { value: '24h', label: '24h', hours: 24 },
                { value: '1w', label: '1w', hours: 168 }
            ],
            chart: null,
            tooltip: {
                show: false,
                text: '',
                x: 0,
                y: 0
            },
            // 自动刷新相关
            refreshInterval: null,
            countdownInterval: null,
            countdown: 60,
            paused: false,
            lastUpdate: ''
        };
    },
    computed: {
        displayHistory() {
            if (!this.historyData || this.historyData.length === 0) return [];
            
            // 如果选择的是"最近",返回最后100条
            if (this.selectedPeriod === 'recent') {
                return this.historyData.slice(-100);
            }
            
            // 否则根据小时数过滤
            const selectedOption = this.periodOptions.find(opt => opt.value === this.selectedPeriod);
            if (!selectedOption || !selectedOption.hours) {
                return this.historyData.slice(-100);
            }
            
            const hoursAgo = new Date(Date.now() - selectedOption.hours * 60 * 60 * 1000);
            return this.historyData.filter(item => new Date(item.createdAt) >= hoursAgo);
        },
        selectedPeriodLabel() {
            const option = this.periodOptions.find(opt => opt.value === this.selectedPeriod);
            return option ? option.label : '最近';
        },
        avgResponseTime() {
            if (!this.displayHistory || this.displayHistory.length === 0) return 0;
            const validData = this.displayHistory.filter(item => item.status === 1);
            if (validData.length === 0) return 0;
            const sum = validData.reduce((acc, item) => acc + item.responseTime, 0);
            return Math.round(sum / validData.length);
        },
        currentResponseTime() {
            if (!this.historyData || this.historyData.length === 0) return '-';
            const latest = this.historyData[this.historyData.length - 1];
            if (latest.status === 1) {
                return latest.responseTime;
            } else if (latest.status === 2) {
                return '重试中';
            } else {
                return '离线';
            }
        },
        maxResponseTime() {
            if (!this.displayHistory || this.displayHistory.length === 0) return 0;
            const validData = this.displayHistory.filter(item => item.status === 1);
            if (validData.length === 0) return 0;
            return Math.max(...validData.map(item => item.responseTime));
        },
        totalChecks() {
            return this.displayHistory.length;
        },
        onlineChecks() {
            return this.displayHistory.filter(item => item.status === 1).length;
        },
        offlineChecks() {
            return this.displayHistory.filter(item => item.status !== 1).length;
        },
        onlineRate() {
            if (this.totalChecks === 0) return '0.00%';
            return ((this.onlineChecks / this.totalChecks) * 100).toFixed(2) + '%';
        }
    },
    mounted() {
        // 初始化主题
        this.initTheme();
        
        // 从 URL 获取监控 ID
        const urlParams = new URLSearchParams(window.location.search);
        this.monitorId = urlParams.get('id');
        
        if (!this.monitorId) {
            this.error = '未指定监控 ID';
            this.loading = false;
            return;
        }

        this.fetchData(true);  // 初次加载，传入 true
        
        // 启动自动刷新
        this.startAutoRefresh();
        
        // 窗口大小变化时重新渲染图表
        window.addEventListener('resize', () => {
            if (this.chart) {
                this.chart.resize();
            }
        });
        
        // 点击外部关闭下拉菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.period-dropdown')) {
                this.showPeriodDropdown = false;
            }
        });
    },
    beforeUnmount() {
        this.stopAutoRefresh();
        if (this.chart) {
            this.chart.dispose();
        }
    },
    methods: {
        async fetchData(isInitial = false) {
            if (this.paused && !isInitial) return;
            
            try {
                if (isInitial) {
                    this.loading = true;
                }
                this.error = null;

                // 获取监控基本信息
                const monitorRes = await axios.get(`/api/monitors/${this.monitorId}`);
                if (monitorRes.data.success) {
                    this.monitor = monitorRes.data.data;
                }

                // 智能增量更新：如果已有数据，只获取最新的数据
                let historyRes;
                if (this.historyData.length > 0 && !isInitial) {
                    // 获取最后一条记录的时间
                    const lastItem = this.historyData[this.historyData.length - 1];
                    const lastTime = new Date(lastItem.createdAt);
                    
                    // 获取最近2分钟的数据（避免遗漏）
                    const sinceMinutes = 2;
                    historyRes = await axios.get(`/api/monitors/${this.monitorId}/history?hours=24`);
                    
                    if (historyRes.data.success) {
                        const newData = historyRes.data.data;
                        // 只添加比最后一条记录更新的数据
                        const incrementalData = newData.filter(item => 
                            new Date(item.createdAt) > lastTime
                        );
                        
                        if (incrementalData.length > 0) {
                            // 追加新数据
                            this.historyData = [...this.historyData, ...incrementalData];
                            // 保持最近24小时的数据
                            const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
                            this.historyData = this.historyData.filter(item => 
                                new Date(item.createdAt) >= cutoffTime
                            );
                            console.log(`增量更新: 添加了 ${incrementalData.length} 条新数据`);
                        }
                    }
                } else {
                    // 初次加载，获取完整的24小时历史数据
                    historyRes = await axios.get(`/api/monitors/${this.monitorId}/history?hours=24`);
                    if (historyRes.data.success) {
                        this.historyData = historyRes.data.data;
                    }
                }

                this.lastUpdate = new Date().toLocaleString('zh-CN');
                this.loading = false;
                this.countdown = 60;

                // 更新图表（直接重新渲染确保所有配置正确应用）
                this.$nextTick(() => {
                    this.renderChart();
                });
            } catch (err) {
                this.error = '获取数据失败: ' + (err.message || '未知错误');
                this.loading = false;
            }
        },
        changePeriod(periodValue) {
            this.selectedPeriod = periodValue;
            this.showPeriodDropdown = false;
            this.$nextTick(() => {
                this.renderChart();
            });
        },
        togglePeriodDropdown() {
            this.showPeriodDropdown = !this.showPeriodDropdown;
        },
        renderChart() {
            const chartEl = document.getElementById('main-chart');
            if (!chartEl) {
                console.warn('图表容器不存在');
                return;
            }
            if (!this.historyData || this.historyData.length === 0) {
                console.warn('没有历史数据');
                return;
            }

            // 销毁旧图表
            if (this.chart) {
                this.chart.dispose();
            }

            const chart = echarts.init(chartEl);
            this.chart = chart;

            const data = this.displayHistory;

            const times = data.map(item => {
                const date = new Date(item.createdAt);
                return date.toLocaleTimeString('zh-CN', { 
                    hour: '2-digit', 
                    minute: '2-digit'
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

            // 构建 markArea 配置（显示离线/重试背景）
            const markAreaData = markAreas.map(area => {
                const color = area.status === 2
                    ? 'rgba(245, 158, 11, 0.3)'  // 橙色 - 重试中
                    : 'rgba(239, 68, 68, 0.3)';   // 红色 - 离线
                
                // markArea 从 area.start 延伸到 area.end + 1，覆盖整个区域
                return [
                    { xAxis: area.start, itemStyle: { color: color } },
                    { xAxis: area.end + 1 }  // +1 延伸到下一个刻度边界
                ];
            });
            
            // 获取主题颜色
            const themeColors = this.getThemeColors();
            
            const option = {
                grid: {
                    left: '50px',
                    right: '30px',
                    bottom: '45px',
                    top: '20px'
                },
                xAxis: {
                    type: 'category',
                    data: times,
                    boundaryGap: true,  // 数据点居中
                    axisLabel: {
                        fontSize: 12,
                        color: themeColors.textColor,
                        rotate: 0,
                        interval: Math.floor(times.length / 8)
                    },
                    axisLine: {
                        lineStyle: { color: themeColors.lineColor }
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
                        fontSize: 12,
                        color: themeColors.textColor
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
                            color: themeColors.gridLineColor,
                            width: 1,
                            type: 'dashed'
                        }
                    }
                },
                // visualMap: 控制趋势线在不同区域的颜色
                visualMap: {
                    show: false,
                    dimension: 0,  // 基于 x 轴索引
                    pieces: data.map((item, index) => ({
                        gte: index,
                        lt: index + 1,
                        color: item.status === 1 ? '#10b981' : 'transparent'  // 正常=绿色，离线/重试=透明
                    })),
                    seriesIndex: 0  // 只应用于趋势线 series
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
                        type: 'line',
                        data: responseTimes,
                        smooth: true,
                        showSymbol: false,
                        lineStyle: {
                            width: 2
                            // 颜色由 visualMap 控制
                        },
                        markArea: {
                            silent: false,  // 允许 tooltip 穿透
                            data: markAreaData,
                            z: 10  // 上层，覆盖趋势线
                        },
                        z: 1  // 趋势线在底层
                    }
                ]
            };

            chart.setOption(option);
        },
        getStatusIconClass(status) {
            if (status === 1) return 'up';
            if (status === 2) return 'maintenance';
            return 'down';
        },
        getStatusBarClass(item) {
            const status = typeof item === 'object' ? item.status : item;
            if (status === 1) return 'up';
            if (status === 2) return 'maintenance';
            return 'down';
        },
        getStatusTitle(item) {
            const time = new Date(item.createdAt).toLocaleString('zh-CN');
            if (item.status === 1) {
                return `${time} - 在线 (${item.responseTime}ms)`;
            } else if (data.value === 2) {
                return `${time} - 重试中`;
            } else {
                return `${time} - 离线`;
            }
        },
        formatUptime(uptime) {
            return (uptime * 100).toFixed(2) + '%';
        },
        getUptimeColor(uptime) {
            const percent = uptime * 100;
            if (percent >= 99) return '#10b981';
            if (percent >= 95) return '#f59e0b';
            return '#ef4444';
        },
        getCircleDasharray(uptime) {
            const percent = uptime * 100;
            return `${percent} 100`;
        },
        goBack() {
            window.location.href = '/';
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
        },

        // 优化的图表更新方法 - 只更新数据，不重建图表
        updateChart() {
            if (!this.chart) {
                // 如果图表不存在，创建新图表
                this.renderChart();
                return;
            }

            const data = this.displayHistory;
            if (!data || data.length === 0) {
                return;
            }

            // 准备新数据
            const times = data.map(item => {
                const date = new Date(item.createdAt);
                return date.toLocaleTimeString('zh-CN', { 
                    hour: '2-digit', 
                    minute: '2-digit'
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

            // 构建 markArea 数据
            const markAreas = [];
            let areaStart = null;
            let areaStatus = null;
            
            data.forEach((item, index) => {
                if (item.status !== 1) {
                    if (areaStart === null) {
                        areaStart = index;
                        areaStatus = item.status;
                    } else if (areaStatus !== item.status) {
                        markAreas.push({
                            status: areaStatus,
                            start: areaStart,
                            end: index - 1
                        });
                        areaStart = index;
                        areaStatus = item.status;
                    }
                } else {
                    if (areaStart !== null) {
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
            
            if (areaStart !== null) {
                markAreas.push({
                    status: areaStatus,
                    start: areaStart,
                    end: data.length - 1
                });
            }

            const markAreaData = markAreas.map(area => {
                const color = area.status === 2 
                    ? 'rgba(245, 158, 11, 0.3)'
                    : 'rgba(239, 68, 68, 0.3)';
                
                // markArea 从 area.start 延伸到 area.end + 1，覆盖整个区域
                return [
                    { 
                        xAxis: area.start,
                        itemStyle: { 
                            color: color
                        }
                    },
                    { 
                        xAxis: area.end + 1  // +1 延伸到下一个刻度边界
                    }
                ];
            });

            // 计算Y轴范围
            const validTimes = responseTimes.filter(t => t !== null);
            let maxTime = 100;
            
            if (validTimes.length > 0) {
                const avgTime = validTimes.reduce((sum, t) => sum + t, 0) / validTimes.length;
                const variance = validTimes.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / validTimes.length;
                const stdDev = Math.sqrt(variance);
                
                maxTime = avgTime + 2 * stdDev;
                
                if (stdDev < avgTime * 0.2) {
                    maxTime = Math.max(...validTimes);
                }
                
                const margin = maxTime * 0.1 || 10;
                maxTime = maxTime + margin;
            }

            // 使用 setOption 更新数据（合并更新，保留其他配置）
            this.chart.setOption({
                xAxis: {
                    data: times
                },
                yAxis: {
                    max: Math.round(maxTime)
                },
                visualMap: {
                    pieces: data.map((item, index) => ({
                        gte: index,
                        lt: index + 1,
                        color: item.status === 1 ? '#10b981' : 'transparent'
                    }))
                },
                series: [{
                    type: 'line',
                    data: responseTimes,
                    smooth: true,
                    showSymbol: false,
                    lineStyle: {
                        width: 2
                        // 颜色由 visualMap 控制
                    },
                    markArea: {
                        silent: false,  // 允许 tooltip 穿透
                        data: markAreaData,
                        z: 10  // 上层，覆盖趋势线
                    },
                    z: 1  // 趋势线在底层
                }]
            });  // 默认 notMerge: false，合并更新
        },

        // 开始自动刷新
        startAutoRefresh() {
            this.stopAutoRefresh();
            
            // 每60秒刷新数据
            this.refreshInterval = setInterval(() => {
                if (!this.paused) {
                    this.fetchData(false);
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

        // 切换暂停/继续
        togglePause() {
            this.paused = !this.paused;
            if (!this.paused) {
                this.countdown = 60;
                this.fetchData(false);
            }
        },

        // 初始化主题
        initTheme() {
            const savedTheme = localStorage.getItem('themeMode') || 'auto';
            console.log('Detail page - Loading theme:', savedTheme);
            this.applyTheme(savedTheme);
            
            // 监听系统主题变化（当设置为 auto 时）
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                const currentTheme = localStorage.getItem('themeMode') || 'auto';
                if (currentTheme === 'auto') {
                    console.log('System theme changed, dark mode:', e.matches);
                    document.documentElement.classList.toggle('dark-mode', e.matches);
                    document.body.classList.toggle('dark-mode', e.matches);
                    // 重新渲染图表
                    if (this.chart && this.historyData.length > 0) {
                        this.renderChart();
                    }
                }
            });
            
            // 监听 localStorage 变化（从其他页面切换主题）
            window.addEventListener('storage', (e) => {
                if (e.key === 'themeMode') {
                    console.log('Theme changed from another tab:', e.newValue);
                    this.applyTheme(e.newValue || 'auto');
                }
            });
        },

        // 应用主题
        applyTheme(theme) {
            console.log('Applying theme:', theme);
            const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            
            if (theme === 'auto') {
                console.log('Auto mode - System prefers dark:', window.matchMedia('(prefers-color-scheme: dark)').matches);
            } else {
                console.log('Manual mode - Dark mode:', theme === 'dark');
            }
            
            // 同时给 html 和 body 添加/移除 dark-mode class
            document.documentElement.classList.toggle('dark-mode', isDark);
            document.body.classList.toggle('dark-mode', isDark);
            console.log('Body has dark-mode class:', document.body.classList.contains('dark-mode'));
            
            // 如果图表已存在，重新渲染以应用新主题
            if (this.chart && this.historyData.length > 0) {
                this.renderChart();
            }
        },

        // 获取主题颜色
        getThemeColors() {
            const isDark = document.body.classList.contains('dark-mode');
            return {
                textColor: isDark ? '#a0a0a0' : '#6b7280',
                lineColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb',
                gridLineColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb'
            };
        }
    }
});

app.mount('#app');
