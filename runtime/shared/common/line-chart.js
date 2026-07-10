var LineChart = {
    render: function(containerId, options) {
        options = options || {};
        var container = document.getElementById(containerId);
        if (!container) return null;

        var series = options.series || [];
        var title = options.title || '';
        var height = options.height || 260;
        var padding = options.padding || { top: 40, right: 40, bottom: 50, left: 60 };
        var legendConfig = options.legend || {};
        var tooltipConfig = options.tooltip || {};
        var xAxisConfig = options.xAxis || {};
        var yAxisConfig = options.yAxis || {};
        var showLegend = legendConfig.enabled !== false;
        var showTooltip = tooltipConfig.enabled !== false;
        var legendPosition = legendConfig.position || 'top';

        var wrapper = document.createElement('div');
        wrapper.className = 'line-chart-container';

        if (title) {
            var titleEl = document.createElement('div');
            titleEl.className = 'line-chart-title';
            titleEl.textContent = title;
            wrapper.appendChild(titleEl);
        }

        if (showLegend && legendPosition === 'top' && series.length > 0) {
            var legendEl = document.createElement('div');
            legendEl.className = 'line-chart-legend';
            series.forEach(function(s, i) {
                var item = document.createElement('div');
                item.className = 'line-chart-legend-item';
                item.setAttribute('data-index', i);
                var dot = document.createElement('span');
                dot.className = 'line-chart-legend-dot';
                dot.style.backgroundColor = s.color || '#1677ff';
                if (s.dash) {
                    dot.style.backgroundImage = 'repeating-linear-gradient(90deg, ' + (s.color || '#1677ff') + ' 0, ' + (s.color || '#1677ff') + ' 4px, transparent 4px, transparent 8px)';
                    dot.style.backgroundColor = 'transparent';
                }
                var label = document.createElement('span');
                label.className = 'line-chart-legend-label';
                label.textContent = s.name || ('Series ' + (i + 1));
                item.appendChild(dot);
                item.appendChild(label);
                legendEl.appendChild(item);
            });
            wrapper.appendChild(legendEl);
        }

        var canvasWrapper = document.createElement('div');
        canvasWrapper.className = 'line-chart-canvas-wrapper';
        var canvas = document.createElement('canvas');
        canvas.className = 'line-chart-canvas';
        canvas.style.height = height + 'px';
        canvasWrapper.appendChild(canvas);
        wrapper.appendChild(canvasWrapper);

        if (showTooltip) {
            var tooltipEl = document.createElement('div');
            tooltipEl.className = 'line-chart-tooltip';
            tooltipEl.style.display = 'none';
            wrapper.appendChild(tooltipEl);
        }

        container.innerHTML = '';
        container.appendChild(wrapper);

        var instance = {
            container: container,
            canvas: canvas,
            series: series,
            padding: padding,
            height: height,
            xAxisConfig: xAxisConfig,
            yAxisConfig: yAxisConfig,
            showLegend: showLegend,
            showTooltip: showTooltip,
            tooltipEl: tooltipEl,
            hiddenSeries: {},
            _resizeHandler: null,

            draw: function() {
                var ctx = canvas.getContext('2d');
                var rect = canvasWrapper.getBoundingClientRect();
                canvas.width = rect.width * 2;
                canvas.height = rect.height * 2;
                ctx.scale(2, 2);

                var width = rect.width;
                var height = rect.height;
                var p = this.padding;
                var chartWidth = width - p.left - p.right;
                var chartHeight = height - p.top - p.bottom;

                ctx.clearRect(0, 0, width, height);

                var allData = [];
                this.series.forEach(function(s, i) {
                    if (!this.hiddenSeries[i]) {
                        allData = allData.concat(s.data || []);
                    }
                }.bind(this));

                if (allData.length === 0) {
                    ctx.fillStyle = '#999';
                    ctx.font = '14px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('暂无数据', width / 2, height / 2);
                    return;
                }

                var yValues = allData.map(function(d) { return d.y; });
                var maxVal = Math.max.apply(null, yValues.concat([1]));
                var minVal = Math.min.apply(null, yValues.concat([0]));
                var yRange = maxVal - minVal || 1;
                maxVal = maxVal + yRange * 0.1;
                minVal = Math.max(0, minVal - yRange * 0.1);
                yRange = maxVal - minVal;

                ctx.strokeStyle = '#e8e8e8';
                ctx.lineWidth = 1;
                for (var i = 0; i <= 5; i++) {
                    var y = p.top + (chartHeight / 5) * i;
                    ctx.beginPath();
                    ctx.moveTo(p.left, y);
                    ctx.lineTo(width - p.right, y);
                    ctx.stroke();

                    var val = maxVal - (yRange / 5) * i;
                    ctx.fillStyle = '#999';
                    ctx.font = '12px sans-serif';
                    ctx.textAlign = 'right';
                    var yLabel = '';
                    if (yAxisConfig.format === 'currency') {
                        yLabel = val >= 10000 ? (val / 10000).toFixed(1) + '万' : val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0);
                    } else {
                        yLabel = val >= 10000 ? (val / 10000).toFixed(1) + '万' : val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val.toFixed(0);
                    }
                    ctx.fillText(yLabel, p.left - 10, y + 4);
                }

                if (yAxisConfig.label) {
                    ctx.fillStyle = '#333';
                    ctx.font = '12px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.save();
                    ctx.translate(14, p.top + chartHeight / 2);
                    ctx.rotate(-Math.PI / 2);
                    ctx.fillText(yAxisConfig.label, 0, 0);
                    ctx.restore();
                }

                var xLabels = [];
                this.series.forEach(function(s) {
                    if (!this.hiddenSeries[s._index !== undefined ? s._index : 0]) {
                        (s.data || []).forEach(function(d) {
                            if (xLabels.indexOf(d.x) === -1) xLabels.push(d.x);
                        });
                    }
                }.bind(this));
                xLabels.sort();

                var xStep = chartWidth / Math.max(xLabels.length - 1, 1);
                var labelFormat = xAxisConfig.labelFormat || 'month';
                var monthCount = xAxisConfig.monthCount || 12;

                ctx.fillStyle = '#666';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'center';
                var labelStep = Math.max(1, Math.floor(xLabels.length / 12));
                for (var i = 0; i < xLabels.length; i++) {
                    if (i % labelStep === 0 || i === xLabels.length - 1) {
                        var x = p.left + xStep * i;
                        var labelText = '';
                        if (labelFormat === 'month') {
                            labelText = xLabels[i].substring(5, 7) + '月';
                        } else {
                            labelText = xLabels[i].substring(5);
                        }
                        ctx.fillText(labelText, x, height - p.bottom + 20);
                    }
                }

                this.series.forEach(function(s, idx) {
                    if (this.hiddenSeries[idx]) return;
                    var data = s.data || [];
                    if (data.length === 0) return;

                    var color = s.color || '#1677ff';
                    var lineWidth = s.lineWidth || 3;
                    var pointRadius = s.pointRadius || 6;
                    var isDash = s.dash || false;

                    ctx.beginPath();
                    if (isDash) {
                        ctx.setLineDash([8, 4]);
                    } else {
                        ctx.setLineDash([]);
                    }
                    ctx.strokeStyle = color;
                    ctx.lineWidth = lineWidth;

                    var points = [];
                    data.forEach(function(d, di) {
                        var xi = xLabels.indexOf(d.x);
                        if (xi === -1) return;
                        var px = p.left + xStep * xi;
                        var py = p.top + chartHeight - ((d.y - minVal) / yRange) * chartHeight;
                        points.push({ x: px, y: py, data: d });
                        if (di === 0) {
                            ctx.moveTo(px, py);
                        } else {
                            ctx.lineTo(px, py);
                        }
                    });
                    ctx.stroke();
                    ctx.setLineDash([]);

                    if (!isDash) {
                        points.forEach(function(pt) {
                            ctx.beginPath();
                            ctx.arc(pt.x, pt.y, pointRadius, 0, Math.PI * 2);
                            ctx.fillStyle = color;
                            ctx.fill();
                            ctx.strokeStyle = '#fff';
                            ctx.lineWidth = 2;
                            ctx.stroke();
                        });
                    } else {
                        points.forEach(function(pt) {
                            ctx.beginPath();
                            ctx.arc(pt.x, pt.y, Math.max(pointRadius - 2, 3), 0, Math.PI * 2);
                            ctx.fillStyle = color;
                            ctx.fill();
                        });
                    }

                    s._points = points;
                }.bind(this));

                this._xLabels = xLabels;
                this._xStep = xStep;
                this._chartWidth = chartWidth;
                this._chartHeight = chartHeight;
                this._minVal = minVal;
                this._yRange = yRange;
            },

            update: function(newOptions) {
                if (newOptions && newOptions.series) {
                    this.series = newOptions.series;
                }
                this.hiddenSeries = {};
                this.draw();
            },

            resize: function() {
                this.draw();
            },

            destroy: function() {
                if (this._resizeHandler) {
                    window.removeEventListener('resize', this._resizeHandler);
                }
                this.container.innerHTML = '';
            },

            _handleMouseMove: function(e) {
                if (!this.showTooltip || !this.tooltipEl) return;

                var rect = this.canvas.getBoundingClientRect();
                var mouseX = e.clientX - rect.left;
                var mouseY = e.clientY - rect.top;
                var p = this.padding;

                if (mouseX < p.left || mouseX > rect.width - p.right || mouseY < p.top || mouseY > rect.height - p.bottom) {
                    this.tooltipEl.style.display = 'none';
                    return;
                }

                var closestPoint = null;
                var closestDist = Infinity;
                var closestSeries = null;

                this.series.forEach(function(s, idx) {
                    if (this.hiddenSeries[idx]) return;
                    var points = s._points || [];
                    points.forEach(function(pt) {
                        var dist = Math.abs(pt.x - mouseX);
                        if (dist < closestDist) {
                            closestDist = dist;
                            closestPoint = pt;
                            closestSeries = s;
                        }
                    });
                }.bind(this));

                if (closestPoint && closestDist < 30) {
                    var html = '<div class="line-chart-tooltip-date">' + closestPoint.data.x + '</div>';
                    html += '<div class="line-chart-tooltip-series">' + closestSeries.name + '</div>';
                    html += '<div class="line-chart-tooltip-value">' + (yAxisConfig.format === 'currency' ? '¥' : '') + closestPoint.data.y.toLocaleString() + '</div>';

                    this.tooltipEl.innerHTML = html;
                    this.tooltipEl.style.display = 'block';

                    var tooltipRect = this.tooltipEl.getBoundingClientRect();
                    var left = closestPoint.x + 12;
                    if (left + tooltipRect.width > rect.width - p.right) {
                        left = closestPoint.x - tooltipRect.width - 12;
                    }
                    this.tooltipEl.style.left = left + 'px';
                    this.tooltipEl.style.top = (closestPoint.y - 10) + 'px';
                } else {
                    this.tooltipEl.style.display = 'none';
                }
            },

            _handleLegendClick: function(e) {
                var item = e.target.closest('.line-chart-legend-item');
                if (!item) return;
                var idx = parseInt(item.getAttribute('data-index'));
                this.hiddenSeries[idx] = !this.hiddenSeries[idx];
                item.classList.toggle('disabled', this.hiddenSeries[idx]);
                this.draw();
            }
        };

        instance.series.forEach(function(s, i) { s._index = i; });

        instance.draw();

        if (showLegend) {
            var legendEl = wrapper.querySelector('.line-chart-legend');
            if (legendEl) {
                legendEl.addEventListener('click', instance._handleLegendClick.bind(instance));
            }
        }

        if (showTooltip) {
            canvas.addEventListener('mousemove', instance._handleMouseMove.bind(instance));
            canvas.addEventListener('mouseleave', function() {
                if (instance.tooltipEl) instance.tooltipEl.style.display = 'none';
            });
        }

        instance._resizeHandler = function() {
            instance.resize();
        };
        window.addEventListener('resize', instance._resizeHandler);

        container._lineChartInstance = instance;
        return instance;
    }
};
