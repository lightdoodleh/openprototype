/**
 * FormRenderer 模块
 * 表单渲染器，统一处理表单渲染逻辑
 */

var FormRenderer = {
    _escape: function(value) {
        if (value === undefined || value === null) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    render: function(containerId, fields) {
        var container = document.getElementById(containerId);
        if (!container) return;
        
        var allFieldsHtml = '';
        var self = this;
        
        fields.forEach(function(field) {
            allFieldsHtml += self.renderField(field);
        });
        
        container.innerHTML = allFieldsHtml;
    },
    
    renderField: function(field) {
        var itemClass = 'form-item';
        var requiredMark = field.required ? '<span class="required-mark">*</span>' : '';
        var labelHtml = '<label class="form-label">' + requiredMark + field.label + '</label>';
        
        var fieldHtml = '';
        
        switch (field.type) {
            case 'text':
                fieldHtml = this.renderTextField(field);
                break;
            case 'number':
                fieldHtml = this.renderNumberField(field);
                break;
            case 'select':
                fieldHtml = this.renderSelectField(field);
                break;
            case 'multi-select':
                fieldHtml = this.renderMultiSelectField(field);
                break;
            case 'date':
                fieldHtml = this.renderDateField(field);
                break;
            case 'month':
                fieldHtml = this.renderMonthField(field);
                break;
            case 'org-select':
                fieldHtml = this.renderOrgSelectField(field);
                break;
            case 'textarea':
                fieldHtml = this.renderTextareaField(field);
                break;
            case 'checkbox':
                fieldHtml = this.renderCheckboxField(field);
                break;
            case 'radio':
                fieldHtml = this.renderRadioField(field);
                break;
            default:
                fieldHtml = this.renderTextField(field);
        }
        
        return '<div class="' + itemClass + '">' +
            labelHtml +
            fieldHtml +
            '</div>';
    },
    
    renderTextField: function(field) {
        var readonlyAttr = field.readonly ? ' readonly' : '';
        var placeholderAttr = field.placeholder ? ' placeholder="' + this._escape(field.placeholder) + '"' : '';
        var valueAttr = field.value !== undefined && field.value !== null ? ' value="' + this._escape(field.value) + '"' : '';
        var maxlengthAttr = field.maxlength ? ' maxlength="' + this._escape(field.maxlength) + '"' : '';
        var patternAttr = field.pattern ? ' pattern="' + this._escape(field.pattern) + '"' : '';
        var inputType = field.inputType || 'text';
        var readonlyClass = field.readonly ? ' readonly-field' : '';
        
        return '<input type="' + this._escape(inputType) + '" class="form-input' + readonlyClass + '" id="' + field.id + '" name="' + field.id + '"' +
            readonlyAttr + placeholderAttr + valueAttr + maxlengthAttr + patternAttr + '>';
    },
    
    renderNumberField: function(field) {
        var readonlyAttr = field.readonly ? ' readonly' : '';
        var placeholderAttr = field.placeholder ? ' placeholder="' + this._escape(field.placeholder) + '"' : '';
        var valueAttr = field.value !== undefined && field.value !== null ? ' value="' + this._escape(field.value) + '"' : '';
        var minAttr = field.min !== undefined ? ' min="' + field.min + '"' : '';
        var maxAttr = field.max !== undefined ? ' max="' + field.max + '"' : '';
        var stepAttr = field.step !== undefined ? ' step="' + field.step + '"' : '';
        var maxlengthAttr = field.maxlength ? ' maxlength="' + this._escape(field.maxlength) + '"' : '';
        var readonlyClass = field.readonly ? ' readonly-field' : '';
        
        return '<input type="number" class="form-input' + readonlyClass + '" id="' + field.id + '" name="' + field.id + '"' +
            readonlyAttr + placeholderAttr + valueAttr + minAttr + maxAttr + stepAttr + maxlengthAttr + '>';
    },
    
    renderSelectField: function(field) {
        var readonlyAttr = field.readonly ? ' disabled' : '';
        var optionsHtml = '<option value="">请选择</option>';
        
        if (field.options) {
            field.options.forEach(function(option) {
                var selectedAttr = field.value === option.value ? ' selected' : '';
                optionsHtml += '<option value="' + FormRenderer._escape(option.value) + '"' + selectedAttr + '>' + FormRenderer._escape(option.label) + '</option>';
            });
        }
        
        return '<select class="form-input form-select" id="' + field.id + '" name="' + field.id + '"' + readonlyAttr + '>' +
            optionsHtml +
            '</select>';
    },
    
    renderMultiSelectField: function(field) {
        var optionsHtml = '';
        
        if (field.options) {
            field.options.forEach(function(option) {
                var checkedAttr = '';
                if (field.value && Array.isArray(field.value) && field.value.indexOf(option.value) > -1) {
                    checkedAttr = ' checked';
                }
                optionsHtml += '<div class="checkbox-item">' +
                    '<label class="checkbox-inline">' +
                    '<input type="checkbox" name="' + field.id + '" value="' + FormRenderer._escape(option.value) + '"' + checkedAttr + '> ' +
                    FormRenderer._escape(option.label) +
                    '</label>' +
                    '</div>';
            });
        }
        
        return '<div class="checkbox-group">' + optionsHtml + '</div>';
    },
    
    renderDateField: function(field) {
        var readonlyAttr = field.readonly ? ' readonly' : '';
        var valueAttr = field.value ? ' value="' + this._escape(field.value) + '"' : '';
        var readonlyClass = field.readonly ? ' readonly-field' : '';
        
        return '<input type="date" class="form-input' + readonlyClass + '" id="' + field.id + '" name="' + field.id + '"' +
            readonlyAttr + valueAttr + '>';
    },
    
    renderMonthField: function(field) {
        var readonlyAttr = field.readonly ? ' readonly' : '';
        var valueAttr = field.value ? ' value="' + this._escape(field.value) + '"' : '';
        var readonlyClass = field.readonly ? ' readonly-field' : '';
        
        return '<input type="month" class="form-input' + readonlyClass + '" id="' + field.id + '" name="' + field.id + '"' +
            readonlyAttr + valueAttr + '>';
    },
    
    renderOrgSelectField: function(field) {
        var placeholder = this._escape(field.placeholder || '请选择...');
        var value = this._escape(field.value || '');
        var text = this._escape(field.text || placeholder);
        var textClass = field.text ? '' : ' class="placeholder"';
        
        return '<input type="hidden" id="' + field.id + '" name="' + field.id + '" value="' + value + '">' +
            '<div class="org-select-trigger" id="' + field.id + 'Trigger">' +
            '<span' + textClass + '>' + text + '</span>' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
            '</div>';
    },
    
    renderTextareaField: function(field) {
        var readonlyAttr = field.readonly ? ' readonly' : '';
        var placeholderAttr = field.placeholder ? ' placeholder="' + this._escape(field.placeholder) + '"' : '';
        var rowsAttr = field.rows ? ' rows="' + field.rows + '"' : ' rows="3"';
        var maxlengthAttr = field.maxlength ? ' maxlength="' + this._escape(field.maxlength) + '"' : '';
        var value = this._escape(field.value || '');
        var readonlyClass = field.readonly ? ' readonly-field' : '';
        
        return '<textarea class="form-input' + readonlyClass + '" id="' + field.id + '" name="' + field.id + '"' +
            readonlyAttr + placeholderAttr + rowsAttr + maxlengthAttr + '>' + value + '</textarea>';
    },
    
    renderCheckboxField: function(field) {
        var checkedAttr = field.checked || field.value ? ' checked' : '';
        
        return '<div class="checkbox-group">' +
            '<label class="checkbox-inline">' +
            '<input type="checkbox" id="' + field.id + '" name="' + field.id + '"' + checkedAttr + '> ' +
            this._escape(field.text || '') +
            '</label>' +
            '</div>';
    },
    
    renderRadioField: function(field) {
        var optionsHtml = '';
        
        if (field.options) {
            field.options.forEach(function(option) {
                var checkedAttr = field.value === option.value ? ' checked' : '';
                optionsHtml += '<label>' +
                    '<input type="radio" name="' + field.id + '" value="' + FormRenderer._escape(option.value) + '"' + checkedAttr + '> ' +
                    FormRenderer._escape(option.label) +
                    '</label>';
            });
        }
        
        return '<div class="radio-group">' + optionsHtml + '</div>';
    }
};
