/**
 * Formatter 模块
 * 全局格式化工具，统一管理常用字段格式化逻辑
 */

var Formatter = {
    fansCount: function(count) {
        if (!count) return '-';
        var num = parseInt(count);
        if (isNaN(num)) return '-';
        if (num >= 10000) {
            return (num / 10000).toFixed(1) + '万';
        }
        return num.toLocaleString();
    },

    tier: function(tier) {
        if (!tier) return '-';
        var tierMap = {
            '头部': '<span class="status-tag" style="background:#fff1f0;color:#cf1322;border-color:#ffa39e;">头部</span>',
            '肩部': '<span class="status-tag" style="background:#fff7e6;color:#d46b08;border-color:#ffd591;">肩部</span>',
            '腰部': '<span class="status-tag" style="background:#e6fffb;color:#08979c;border-color:#87e8de;">腰部</span>',
            '尾部': '<span class="status-tag" style="background:#f9f0ff;color:#531dab;border-color:#d3adf7;">尾部</span>'
        };
        return tierMap[tier] || tier;
    },

    dockingSubject: function(subject) {
        if (!subject) return '-';
        return subject;
    },

    status: function(status) {
        if (!status) return '-';
        var labelMap = Object.assign(
            {},
            typeof STATUS_LABELS !== 'undefined' ? STATUS_LABELS : {},
            typeof ENABLED_STATUS !== 'undefined' ? ENABLED_STATUS : {}
        );
        var classMap = typeof STATUS_STYLE_MAP !== 'undefined' ? STATUS_STYLE_MAP : {};
        var label = labelMap[status] || status;
        var cls = classMap[status] || 'status-tag-default';
        return '<span class="status-tag ' + cls + '">' + label + '</span>';
    }
};

function icon(name) {
    if (typeof ICON_MAP !== 'undefined' && ICON_MAP[name]) {
        return ICON_MAP[name];
    }
    return '';
}

function getIndicatorsByActivityType(typeId) {
    if (typeof INDICATOR_MAP !== 'undefined' && INDICATOR_MAP[typeId]) {
        return INDICATOR_MAP[typeId];
    }
    return ['曝光量', '点击率', '转化率', 'ROI'];
}

function renderIndicatorsCell(detail, activityType, isReadonly) {
    var indicators = getIndicatorsByActivityType(activityType || (detail && detail.activityType) || '');
    var list = (detail && detail.indicators) || [];
    if (isReadonly) {
        if (!list || list.length === 0) return '-';
        return list.map(function(ind) {
            return '<div style="display:flex;align-items:center;gap:8px;"><span style="flex-shrink:0;min-width:72px;">' + (ind.name || '-') + '</span><span style="flex:1;">' + (ind.value || '-') + '</span></div>';
        }).join('');
    }
    if (!activityType && !detail.activityType) return '<span style="color:var(--text-secondary);">请先选择活动类型</span>';
    return indicators.map(function(name) {
        var found = list.find(function(i) { return i.name === name; });
        var val = found ? found.value : '';
        return '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">' +
            '<span style="flex-shrink:0;min-width:72px;">' + name + '</span>' +
            '<input type="text" class="detail-row-input" style="flex:1;" placeholder="请输入指标值" value="' + val + '"></div>';
    }).join('');
}
