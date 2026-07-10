/**
 * 项目通用工具类 (Utils)
 * 修订人：张晶晶
 */
const CommonUtils = {
    /**
     * 金额格式化 (千分位，保留2位小数)
     */
    formatCurrency(num) {
        if (num === null || num === undefined || isNaN(num)) return '0.00';
        return parseFloat(num).toLocaleString('zh-CN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    },

    /**
     * 获取 URL 参数
     */
    getUrlParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    },

    /**
     * 简单的日期格式化 (YYYY-MM-DD)
     */
    formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    },

    /**
     * 今天的日期 (YYYY-MM-DD)
     */
    today() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },

    /**
     * 当前月份 (YYYY-MM)
     */
    currentMonth() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    },

    /**
     * 初始化表格列宽调整功能
     * @param {string} tableId - 表格元素 ID
     * @param {string} storageKey - localStorage 存储键名
     */
    initColumnResizer(tableId, storageKey) {
        var table = document.getElementById(tableId);
        if (!table) return;

        var savedWidths = {};
        try {
            savedWidths = JSON.parse(localStorage.getItem(storageKey) || '{}');
        } catch (e) {
            savedWidths = {};
        }

        var ths = table.querySelectorAll('th');
        ths.forEach(function(th) {
            var column = th.getAttribute('data-column');
            if (column && savedWidths[column]) {
                th.style.width = savedWidths[column] + 'px';
            }
        });

        var currentTh = null;
        var startX = 0;
        var startWidth = 0;

        table.addEventListener('mousedown', function(e) {
            if (e.target.classList.contains('resizer')) {
                currentTh = e.target.closest('th');
                startX = e.pageX;
                startWidth = currentTh.offsetWidth;
                currentTh.classList.add('resizing');
                e.preventDefault();
            }
        });

        document.addEventListener('mousemove', function(e) {
            if (!currentTh) return;
            var diff = e.pageX - startX;
            var newWidth = Math.max(50, startWidth + diff);
            currentTh.style.width = newWidth + 'px';
        });

        document.addEventListener('mouseup', function() {
            if (!currentTh) return;
            var column = currentTh.getAttribute('data-column');
            var newWidth = currentTh.offsetWidth;
            if (column) {
                savedWidths[column] = newWidth;
                localStorage.setItem(storageKey, JSON.stringify(savedWidths));
            }
            currentTh.classList.remove('resizing');
            currentTh = null;
        });
    }
};

// 确保全局可用
window.CommonUtils = CommonUtils;