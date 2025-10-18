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
            }
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
        // 从 URL 获取监控 ID
        const urlParams = new URLSearchParams(window.location.search);
        this.monitorId = urlParams.get('id');
        
        if (!this.monitorId) {
            this.error = '未指定监控 ID';
            this.loading = false;
            return;
        }

        this.fetchData();
        
        // 点击外部关闭下拉菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.period-dropdown')) {
                this.showPeriodDropdown = false;
            }
        });
    },
    beforeUnmount() {
        if (this.chart) {
            this.chart.dispose();
        }
    },
    methods: {
        async fetchData() {
            try {
                this.loading = true;
                this.error = null;

                // 获取监控基本信息
                const monitorRes = await axios.get(`/api/monitors/${this.monitorId}`);
                if (monitorRes.data.success) {
                    this.monitor = monitorRes.data.data;
                }

                // 获取历史数据（24小时）
                const historyRes = await axios.get(`/api/monitors/${this.monitorId}/history?hours=24`);
                if (historyRes.data.success) {
                    this.historyData = historyRes.data.data;
                }

                this.loading = false;

                // 渲染图表
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
            if (!chartEl || !this.historyData || this.historyData.length === 0) return;

            if (this.chart) {
                this.chart.dispose();
            }

            this.chart = echarts.init(chartEl);

            const data = this.displayHistory;
            const times = data.map(item => {
                const date = new Date(item.createdAt);
                return date.toLocaleString('zh-CN', { 
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit', 
                    minute: '2-digit'
                });
            });

            // 只保留正常数据
            const normalData = data.map(item => 
                item.status === 1 ? item.responseTime : null
            );

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
            const validTimes = data.filter(d => d.status === 1).map(d => d.responseTime);
            let maxTime = 100;
            
            if (validTimes.length > 0) {
                // 计算平均值
                const avgTime = validTimes.reduce((sum, t) => sum + t, 0) / validTimes.length;
                // 计算标准差
                const variance = validTimes.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / validTimes.length;
                const stdDev = Math.sqrt(variance);
                
                // 使用平均值 + 2倍标准差作为上限
                maxTime = avgTime + 2 * stdDev;
                
                // 如果所有数据都很接近（标准差很小），使用最大值
                if (stdDev < avgTime * 0.2) {
                    maxTime = Math.max(...validTimes);
                }
                
                // 添加边距
                const margin = maxTime * 0.1 || 10;
                maxTime = maxTime + margin;
            }

            // 转换为 ECharts markArea 格式
            const markAreaData = markAreas.map(area => {
                const color = area.status === 2 
                    ? 'rgba(245, 158, 11, 0.3)'  // 橙色半透明 - 维护中
                    : 'rgba(239, 68, 68, 0.3)';   // 红色半透明 - 离线
                
                return [
                    { 
                        xAxis: times[area.start],
                        itemStyle: { 
                            color: color,
                            borderWidth: 0
                        }
                    },
                    { 
                        xAxis: times[area.end]
                    }
                ];
            });

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
                    axisLabel: {
                        fontSize: 12,
                        color: '#6b7280',
                        rotate: 0,
                        interval: Math.floor(times.length / 8)
                    },
                    axisLine: {
                        lineStyle: { color: '#e5e7eb' }
                    }
                },
                yAxis: {
                    type: 'value',
                    min: 0,
                    max: Math.round(maxTime),
                    axisLabel: {
                        fontSize: 12,
                        color: '#6b7280'
                    },
                    splitLine: {
                        lineStyle: {
                            color: '#f3f4f6',
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
                            return `${time} - 在线 (${item.responseTime}ms)`;
                        } else if (item.status === 2) {
                            return `${time} - 维护中`;
                        } else {
                            return `${time} - 离线`;
                        }
                    }
                },
                series: [{
                    name: '响应时间',
                    type: 'line',
                    data: normalData,
                    smooth: true,
                    showSymbol: false,
                    lineStyle: {
                        width: 3,
                        color: '#10b981'
                    },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(16, 185, 129, 0.4)' },
                            { offset: 1, color: 'rgba(16, 185, 129, 0.05)' }
                        ])
                    },
                    markArea: {
                        silent: true,
                        data: markAreaData
                    }
                }]
            };

            this.chart.setOption(option);

            // 窗口大小变化时重新渲染
            window.addEventListener('resize', () => {
                if (this.chart) {
                    this.chart.resize();
                }
            });
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
            } else if (item.status === 2) {
                return `${time} - 维护中`;
            } else {
                return `${time} - 离线/丢包`;
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
        }
    }
});

app.mount('#app');
