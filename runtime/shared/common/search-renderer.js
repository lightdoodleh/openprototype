/**
 * SearchRenderer 模块
 * 统一渲染 PC 列表页搜索条件和搜索区操作按钮
 */

var SearchRenderer = {
    _escape: function(value) {
        if (value === undefined || value === null) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    render: function(containerId, config) {
        var container = document.getElementById(containerId);
        if (!container) return;

        var html = '';
        var fields = config.fields || [];
        var actions = config.actions || [];

        fields.forEach(function(field) {
            html += SearchRenderer.renderField(field);
        });

        if (actions.length) {
            html += SearchRenderer.renderActions(actions);
        }

        container.innerHTML = html;
    },

    renderField: function(field) {
        if (field.type === 'custom') {
            return field.html || '';
        }

        var labelHtml = field.label ? '<label class="form-label">' + this._escape(field.label) + '</label>' : '';
        var controlHtml = '';

        if (field.type === 'select') {
            controlHtml = this.renderSelect(field);
        } else if (field.type === 'checkbox') {
            controlHtml = this.renderCheckbox(field);
        } else {
            controlHtml = this.renderInput(field);
        }

        return '<div class="form-item">' + labelHtml + controlHtml + '</div>';
    },

    renderInput: function(field) {
        var type = field.inputType || 'text';
        var placeholder = field.placeholder ? ' placeholder="' + this._escape(field.placeholder) + '"' : '';
        var value = field.value ? ' value="' + this._escape(field.value) + '"' : '';
        var maxlength = field.maxlength ? ' maxlength="' + this._escape(field.maxlength) + '"' : '';
        var style = field.style ? ' style="' + this._escape(field.style) + '"' : '';
        return '<input type="' + this._escape(type) + '" class="form-input" id="' + this._escape(field.id) + '"' + placeholder + value + maxlength + style + '>';
    },

    renderSelect: function(field) {
        var optionsHtml = '';
        (field.options || []).forEach(function(option) {
            var selected = field.value === option.value ? ' selected' : '';
            optionsHtml += '<option value="' + SearchRenderer._escape(option.value) + '"' + selected + '>' + SearchRenderer._escape(option.label) + '</option>';
        });
        return '<select class="form-input" id="' + this._escape(field.id) + '">' + optionsHtml + '</select>';
    },

    renderCheckbox: function(field) {
        var checked = field.checked ? ' checked' : '';
        return '<label class="search-checkbox"><input type="checkbox" id="' + this._escape(field.id) + '"' + checked + '> ' + this._escape(field.text || field.label || '') + '</label>';
    },

    renderActions: function(actions) {
        var html = '<div class="search-actions">';
        actions.forEach(function(action) {
            if (action.type === 'divider') {
                html += '<span class="search-actions-divider"></span>';
                return;
            }
            if (action.html) {
                html += action.html;
                return;
            }
            var cls = action.className || 'btn';
            var iconHtml = action.icon ? icon(action.icon) + ' ' : '';
            html += '<button type="button" class="' + SearchRenderer._escape(cls) + '" id="' + SearchRenderer._escape(action.id) + '">' + iconHtml + SearchRenderer._escape(action.label) + '</button>';
        });
        html += '</div>';
        return html;
    }
};
