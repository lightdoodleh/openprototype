/**
 * CommonForm 模块
 * 通用表单管理器，处理表单渲染和数据提交
 */

var CommonForm = {
    config: null,
    mode: 'add',
    currentId: null,
    
    init: function(config) {
        this.config = config;
        var params = new URLSearchParams(window.location.search);
        this.currentId = params.get('id');
        var copyMode = params.get('copy') === 'true' || params.get('mode') === 'copy';
        
        if (copyMode) {
            this.mode = 'copy';
            this.loadCopyData();
        } else if (this.currentId) {
            this.mode = 'edit';
            this.loadEditData();
        } else {
            this.mode = 'add';
            this.renderForm();
        }
    },
    
    renderForm: function(data) {
        var container = document.querySelector(this.config.formSelector);
        if (!container) return;
        
        var html = '';
        var self = this;
        this.config.sections.forEach(function(section) {
            var sectionVisibleStyle = section.visible === false ? 'style="display:none;"' : '';
            var sectionId = section.id ? 'id="' + section.id + '"' : '';
            
            html += '<div class="rx-form-section" ' + sectionId + ' ' + sectionVisibleStyle + '>';
            html += '<h2 class="rx-section-title">' + section.title + '</h2>';
            html += '<div class="rx-form-grid">';
            
            section.fields.forEach(function(field) {
                var value = data ? (data[field.id] || '') : (field.value || '');
                var requiredMark = field.required ? '<span style="color: var(--danger); margin-right: 4px;">*</span>' : '';
                var visibleStyle = field.visible === false ? 'style="display:none;"' : '';

                if (field.type === 'custom' && field.render) {
                    html += '<div class="form-item" id="' + field.id + 'Item" ' + visibleStyle + '>';
                    if (field.label) {
                        html += '<label class="form-label">' + requiredMark + field.label + '</label>';
                    }
                    html += field.render.call(self, value, data || {});
                    html += '</div>';
                    return;
                }

                html += '<div class="form-item" id="' + field.id + 'Item" ' + visibleStyle + '>';
                html += '<label class="form-label">' + requiredMark + field.label + '</label>';
                
                if (field.type === 'select') {
                    html += '<select class="form-select" id="' + field.id + '" name="' + field.id + '"';
                    if (field.onChange) html += ' data-change-handler="' + field.onChange + '"';
                    html += '>';
                    if (field.options) {
                        field.options.forEach(function(opt) {
                            var selected = value === opt.value ? ' selected' : '';
                            html += '<option value="' + opt.value + '"' + selected + '>' + opt.label + '</option>';
                        });
                    }
                    html += '</select>';
                } else if (field.type === 'textarea') {
                    html += '<textarea class="form-textarea" id="' + field.id + '" name="' + field.id + '" placeholder="' + (field.placeholder || '') + '"';
                    if (field.onChange) html += ' data-change-handler="' + field.onChange + '"';
                    html += '>' + value + '</textarea>';
                } else if (field.type === 'radio') {
    html += '<div class="radio-group">';
    if (field.options) {
        field.options.forEach(function(opt) {
            var checked = value === opt.value ? ' checked' : '';
            html += '<label class="radio-item"><input type="radio" name="' + field.id + '" value="' + opt.value + '"' + checked;
            if (field.onChange) html += ' data-change-handler="' + field.onChange + '"';
            html += '> ' + opt.label + '</label>';
        });
    }
    html += '</div>';
} else if (field.type === 'number') {
                    html += '<input type="number" class="form-input" id="' + field.id + '" name="' + field.id + '" value="' + value + '" placeholder="' + (field.placeholder || '') + '"';
                    if (field.min !== undefined) html += ' min="' + field.min + '"';
                    if (field.max !== undefined) html += ' max="' + field.max + '"';
                    if (field.step) html += ' step="' + field.step + '"';
                    if (field.onChange) html += ' data-change-handler="' + field.onChange + '"';
                    html += '>';
                } else if (field.type === 'display') {
                    html += '<span class="form-value" id="' + field.id + '">' + value + '</span>';
                } else if (field.type === 'custom') {
                    html += '<div class="field-value" id="' + field.id + 'Container" data-field="' + field.id + '" data-custom-type="' + (field.customType || '') + '"></div>';
                    html += '<input type="hidden" id="' + field.id + '" name="' + field.id + '" value="' + value + '">';
                } else if (field.type === 'yearMonth') {
                    html += '<div id="' + field.id + 'Container"></div>';
                    html += '<input type="hidden" id="' + field.id + '" name="' + field.id + '" value="' + value + '">';
                } else if (field.type === 'yearQuarter') {
                    html += '<div id="' + field.id + 'Container"></div>';
                    html += '<input type="hidden" id="' + field.id + '" name="' + field.id + '" value="' + value + '">';
                } else if (field.type === 'dateRange') {
                    html += '<div id="' + field.id + 'Container"></div>';
                    html += '<input type="hidden" id="' + field.id + 'Start" name="' + field.id + 'Start" value="">';
                    html += '<input type="hidden" id="' + field.id + 'End" name="' + field.id + 'End" value="">';
                } else {
                    html += '<input type="text" class="form-input" id="' + field.id + '" name="' + field.id + '" value="' + value + '" placeholder="' + (field.placeholder || '') + '"';
                    if (field.readonly) html += ' readonly';
                    if (field.onChange) html += ' data-change-handler="' + field.onChange + '"';
                    html += '>';
                }
                
                html += '</div>';
            });
            
            html += '</div></div>';
        });
        
        container.innerHTML = html;
        this._bindFieldChangeHandlers(container);
        
        this._initPickerComponents(data);
        
        if (this.config.onLoad) {
            this.config.onLoad(data || {}, this.mode);
        }
    },

    _bindFieldChangeHandlers: function(container) {
        container.querySelectorAll('[data-change-handler]').forEach(function(el) {
            el.addEventListener('change', function(event) {
                var handlerName = el.getAttribute('data-change-handler');
                var normalizedName = handlerName ? handlerName.replace(/\(.*\)$/, '') : '';
                var handler = window[normalizedName];
                if (typeof handler === 'function') {
                    handler(event);
                }
            });
        });
    },
    
    _initPickerComponents: function(data) {
        var self = this;
        this.config.sections.forEach(function(section) {
            section.fields.forEach(function(field) {
                var value = data ? (data[field.id] || '') : (field.value || '');
                
                if (field.type === 'yearMonth') {
                    var container = document.getElementById(field.id + 'Container');
                    if (container && typeof YearMonthPicker !== 'undefined') {
                        var instance = YearMonthPicker.render(field.id + 'Container', {
                            defaultValue: value || null,
                            onChange: function(val) {
                                var hiddenInput = document.getElementById(field.id);
                                if (hiddenInput) hiddenInput.value = val;
                                if (field.onChange) {
                                    var fn = window[field.onChange];
                                    if (typeof fn === 'function') fn(val);
                                }
                            }
                        });
                        container._yearMonthPickerInstance = instance;
                    }
                } else if (field.type === 'yearQuarter') {
                    var container = document.getElementById(field.id + 'Container');
                    if (container && typeof YearQuarterPicker !== 'undefined') {
                        var parts = value ? value.split('-') : [];
                        var year = parts[0] ? parseInt(parts[0]) : null;
                        var quarter = parts[1] || null;
                        var instance = YearQuarterPicker.render(field.id + 'Container', {
                            defaultYear: year,
                            defaultQuarter: quarter,
                            onChange: function(val) {
                                var hiddenInput = document.getElementById(field.id);
                                if (hiddenInput) {
                                    hiddenInput.value = val.year + (val.quarter ? '-' + val.quarter : '');
                                }
                                if (field.onChange) {
                                    var fn = window[field.onChange];
                                    if (typeof fn === 'function') fn(val);
                                }
                            }
                        });
                        container._yearQuarterPickerInstance = instance;
                        var hiddenInput = document.getElementById(field.id);
                        if (hiddenInput && year && quarter) {
                            hiddenInput.value = year + '-' + quarter;
                        }
                    }
                } else if (field.type === 'dateRange') {
                    var container = document.getElementById(field.id + 'Container');
                    if (container && typeof DateRangePicker !== 'undefined') {
                        var startValue = data ? (data[field.id + 'Start'] || '') : '';
                        var endValue = data ? (data[field.id + 'End'] || '') : '';
                        var instance = DateRangePicker.render(field.id + 'Container', {
                            defaultStartDate: startValue || null,
                            defaultEndDate: endValue || null,
                            onChange: function(val) {
                                var startInput = document.getElementById(field.id + 'Start');
                                var endInput = document.getElementById(field.id + 'End');
                                if (startInput) startInput.value = val.startDate || '';
                                if (endInput) endInput.value = val.endDate || '';
                                if (field.onChange) {
                                    var fn = window[field.onChange];
                                    if (typeof fn === 'function') fn(val);
                                }
                            }
                        });
                        container._dateRangePickerInstance = instance;
                    }
                }
            });
        });
    },
    
    loadEditData: function() {
        var self = this;
        var data = this.config.dataManager.getItemById ? 
            this.config.dataManager.getItemById(this.currentId) : 
            this.config.dataManager.getItem(this.currentId);
        
        if (data) {
            this.renderForm(data);
        } else {
            Toast.error('未找到数据');
            window.location.href = this.config.listPage;
        }
    },
    
    loadCopyData: function() {
        var copyData = DataBridge.getData('kol_copy_data', true);
        if (copyData) {
            delete copyData.id;
            delete copyData.kolId;
            delete copyData.status;
            delete copyData.createTime;
            delete copyData.creator;
            this.renderForm(copyData);
        } else {
            this.renderForm();
        }
    },
    
    getFormData: function() {
        var data = {};
        if (this.currentId) data.id = this.currentId;
        
        var self = this;
        this.config.sections.forEach(function(section) {
            section.fields.forEach(function(field) {
                if (field.type === 'yearMonth') {
                    var container = document.getElementById(field.id + 'Container');
                    if (container && container._yearMonthPickerInstance) {
                        data[field.id] = container._yearMonthPickerInstance.getValue();
                    } else {
                        var el = document.getElementById(field.id);
                        if (el) data[field.id] = el.value;
                    }
                } else if (field.type === 'yearQuarter') {
                    var container = document.getElementById(field.id + 'Container');
                    if (container && container._yearQuarterPickerInstance) {
                        var val = container._yearQuarterPickerInstance.getValue();
                        data[field.id] = val.year + (val.quarter ? '-' + val.quarter : '');
                    } else {
                        var el = document.getElementById(field.id);
                        if (el) data[field.id] = el.value;
                    }
                } else if (field.type === 'dateRange') {
                    var container = document.getElementById(field.id + 'Container');
                    if (container && container._dateRangePickerInstance) {
                        var val = container._dateRangePickerInstance.getValue();
                        data[field.id + 'Start'] = val.startDate || '';
                        data[field.id + 'End'] = val.endDate || '';
                    } else {
                        var startEl = document.getElementById(field.id + 'Start');
                        var endEl = document.getElementById(field.id + 'End');
                        if (startEl) data[field.id + 'Start'] = startEl.value;
                        if (endEl) data[field.id + 'End'] = endEl.value;
                    }
                } else if (field.type === 'radio') {
                    var checked = document.querySelector('input[name="' + field.id + '"]:checked');
                    data[field.id] = checked ? checked.value : '';
                } else {
                    var el = document.getElementById(field.id);
                    if (el) {
                        data[field.id] = el.value;
                    }
                }
            });
        });
        
        return data;
    },
    
    saveForm: function() {
        var data = this.getFormData();
        
        if (this.config.onSave) {
            data = this.config.onSave(data);
        }
        
        if (!data) {
            return;
        }
        
        var existingItem = data.id ? this.config.dataManager.getItem(data.id) : null;
        
        if (existingItem) {
            this.config.dataManager.saveItem(data);
        } else {
            if (!data.id) {
                data.id = Date.now().toString();
            }
            if (this.config.dataManager.addItem) {
                this.config.dataManager.addItem(data);
            } else {
                this.config.dataManager.saveItem(data);
            }
        }
        
        Toast.success('保存成功');
        window.location.href = this.config.listPage;
    },
    
    submitForm: function() {
        var data = this.getFormData();
        
        if (this.config.onSubmit) {
            data = this.config.onSubmit(data);
        }
        
        if (!data) {
            return;
        }
        
        var existingItem = data.id ? this.config.dataManager.getItem(data.id) : null;
        
        if (existingItem) {
            this.config.dataManager.saveItem(data);
        } else {
            if (!data.id) {
                data.id = Date.now().toString();
            }
            if (this.config.dataManager.addItem) {
                this.config.dataManager.addItem(data);
            } else {
                this.config.dataManager.saveItem(data);
            }
        }
        
        Toast.success('提交成功');
        window.location.href = this.config.listPage;
    }
};
