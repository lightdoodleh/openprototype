/**
 * ComponentRenderer 模块
 * 组件渲染器，统一渲染常用 UI 组件
 *
 * 事件委托：按钮不再使用内联 onclick，改用 data-action 属性。
 * 全局委托监听器在 document 上，通过 data-action 值在全局作用域解析回调函数。
 * 注册自定义回调：ComponentRenderer.registerAction('name', fn)
 */

var ComponentRenderer = {
    _actionCallbacks: {},

    registerAction: function(name, fn) {
        this._actionCallbacks[name] = fn;
    },

    _resolveAction: function(name) {
        return this._actionCallbacks[name] || (typeof window !== 'undefined' ? window[name] : null);
    },

    _attr: function(s) { return (s || '').replace(/"/g, '&quot;'); },

    renderTableActions: function(id, status, config) {
        config = config || {};
        var showEdit = config.showEdit !== false;
        var showToggle = config.showToggle !== false;
        var showDelete = config.showDelete === true;
        var editCallback = config.editCallback || 'editItem';
        var toggleCallback = config.toggleCallback || 'toggleStatus';
        var deleteCallback = config.deleteCallback || 'deleteItem';
        var customButtons = config.customButtons || [];

        var html = '<div class="action-btns">';

        if (showEdit) {
            html += '<button class="action-icon-btn" data-action="' + this._attr(editCallback) + '" data-action-id="' + id + '" data-tooltip="编辑">' +
                ICON_MAP.edit +
                '</button>';
        }

        if (showToggle) {
            var isActive = status === ENABLED_STATUS.enabled || status === ENABLED_STATUS.active;
            var tooltip = isActive ? ENABLED_STATUS.inactive : ENABLED_STATUS.active;
            var icon = isActive ? ICON_MAP.ban : ICON_MAP.power;
            html += '<button class="action-icon-btn" data-action="' + this._attr(toggleCallback) + '" data-action-id="' + id + '" data-tooltip="' + tooltip + '">' +
                icon +
                '</button>';
        }

        if (showDelete) {
            html += '<button class="action-icon-btn delete" data-action="' + this._attr(deleteCallback) + '" data-action-id="' + id + '" data-tooltip="删除">' +
                ICON_MAP.delete +
                '</button>';
        }

        customButtons.forEach(function(btn) {
            html += '<button class="action-icon-btn' + (btn.className ? ' ' + btn.className : '') + '" data-action="' + ComponentRenderer._attr(btn.callback) + '" data-action-id="' + id + '" data-tooltip="' + btn.tooltip + '">' +
                btn.icon +
                '</button>';
        });

        html += '</div>';
        return html;
    },

    renderStatusTag: function(status, defaultText) {
        var statusClass = STATUS_STYLE_MAP[status] || 'status-inactive';
        var displayText = status || defaultText || '-';
        return '<span class="' + statusClass + '">' + displayText + '</span>';
    },

    renderButton: function(iconKey, text, className, actionName) {
        var icon = ICON_MAP[iconKey] || '';
        return '<button class="' + className + '" data-action="' + this._attr(actionName) + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">' + icon + '</svg>' +
            text +
            '</button>';
    },
    
    renderUploader: function(containerId, options) {
        options = options || {};
        var container = document.getElementById(containerId);
        if (!container) return null;

        var accept = options.accept || '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.png';
        var maxFiles = options.maxFiles || 5;
        var maxSizeMB = options.maxSizeMB || 10;
        var label = options.label || '上传附件';
        var uploaderId = containerId + '-uploader';

        container.innerHTML = '<div class="upload-area" id="' + uploaderId + '">' +
            '<button type="button" class="btn btn-default upload-btn">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
            label + '</button>' +
            '<input type="file" class="upload-input" multiple accept="' + accept + '" style="display:none">' +
            '<span class="upload-hint">支持 ' + accept + ' 格式，单个文件不超过 ' + maxSizeMB + 'MB，最多 ' + maxFiles + ' 个文件</span>' +
            '</div><div class="upload-file-list"></div>';

        var instance = {
            container: container,
            files: [],
            addFile: function(file) {
                if (this.files.length >= maxFiles) { Toast.warning('最多上传 ' + maxFiles + ' 个文件'); return; }
                if (file.size > maxSizeMB * 1024 * 1024) { Toast.warning('文件大小不能超过 ' + maxSizeMB + 'MB'); return; }
                this.files.push({ name: file.name, size: file.size, type: file.type, file: file });
                this.render();
            },
            removeFile: function(index) { this.files.splice(index, 1); this.render(); },
            render: function() {
                var listEl = container.querySelector('.upload-file-list');
                var html = '';
                for (var i = 0; i < this.files.length; i++) {
                    var f = this.files[i];
                    html += '<div class="upload-file-item">' +
                        '<svg class="upload-file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
                        '<span class="upload-file-name">' + f.name + '</span>' +
                        '<span class="upload-file-size">' + (f.size / 1024).toFixed(1) + 'KB</span>' +
                        '<span class="upload-file-remove" data-index="' + i + '">&times;</span></div>';
                }
                listEl.innerHTML = html;
                var self = this;
                listEl.querySelectorAll('.upload-file-remove').forEach(function(btn) {
                    btn.addEventListener('click', function() { self.removeFile(parseInt(this.dataset.index)); });
                });
            },
            getFiles: function() { return this.files; },
            setFiles: function(files) { this.files = files || []; this.render(); }
        };

        var btn = container.querySelector('.upload-btn');
        var input = container.querySelector('.upload-input');
        btn.addEventListener('click', function() { input.click(); });
        input.addEventListener('change', function(e) {
            Array.from(e.target.files).forEach(function(f) { instance.addFile(f); });
            input.value = '';
        });

        container._uploaderInstance = instance;
        return instance;
    },

    renderImageUploader: function(containerId, options) {
        options = options || {};
        var container = document.getElementById(containerId);
        if (!container) return null;

        var maxSizeMB = options.maxSizeMB || 2;
        var uploaderId = containerId + '-img-uploader';

        container.innerHTML = '<div class="icon-upload-container" id="' + uploaderId + '">' +
            '<div class="icon-upload-box"><span class="upload-icon">+</span><span class="upload-hint">上传图片</span>' +
            '<img src="" alt="" style="display:none"><button type="button" class="delete-btn">&times;</button>' +
            '<input type="file" accept="image/*" style="display:none"></div></div>';

        var instance = {
            container: container,
            imageData: null,
            setImage: function(src) {
                this.imageData = src;
                var box = container.querySelector('.icon-upload-box');
                var img = box.querySelector('img');
                if (src) { img.src = src; img.style.display = 'block'; box.classList.add('has-image'); }
                else { img.src = ''; img.style.display = 'none'; box.classList.remove('has-image'); }
            },
            getImage: function() { return this.imageData; }
        };

        var box = container.querySelector('.icon-upload-box');
        var input = box.querySelector('input[type="file"]');
        var deleteBtn = box.querySelector('.delete-btn');

        box.addEventListener('click', function(e) { if (!e.target.closest('.delete-btn')) input.click(); });
        input.addEventListener('change', function(e) {
            var file = e.target.files[0];
            if (!file) return;
            if (file.size > maxSizeMB * 1024 * 1024) { Toast.warning('图片大小不能超过 ' + maxSizeMB + 'MB'); return; }
            var reader = new FileReader();
            reader.onload = function(ev) { instance.setImage(ev.target.result); };
            reader.readAsDataURL(file);
        });
        deleteBtn.addEventListener('click', function(e) { e.stopPropagation(); instance.setImage(null); input.value = ''; });

        container._imageUploaderInstance = instance;
        return instance;
    },

    renderYearQuarterPicker: function(containerId, options) {
        options = options || {};
        var container = document.getElementById(containerId);
        if (!container) return null;

        var showQuarter = options.showQuarter !== false;
        var currentYear = new Date().getFullYear();
        var years = [];
        for (var i = currentYear - 2; i <= currentYear + 3; i++) years.push(i);

        var yearOptions = years.map(function(y) { return '<option value="' + y + '"' + (y === currentYear ? ' selected' : '') + '>' + y + '年</option>'; }).join('');
        var quarterHtml = showQuarter ? '<select class="form-select quarter-select"><option value="Q1">Q1</option><option value="Q2">Q2</option><option value="Q3">Q3</option><option value="Q4">Q4</option></select>' : '';

        container.innerHTML = '<div class="year-quarter-picker" style="display:flex;gap:8px;align-items:center;">' +
            '<select class="form-select year-select">' + yearOptions + '</select>' + quarterHtml + '</div>';

        var instance = {
            container: container,
            getValue: function() {
                var year = container.querySelector('.year-select').value;
                var quarterEl = container.querySelector('.quarter-select');
                return { year: year, quarter: quarterEl ? quarterEl.value : null };
            },
            setValue: function(year, quarter) {
                container.querySelector('.year-select').value = year;
                var quarterEl = container.querySelector('.quarter-select');
                if (quarterEl && quarter) quarterEl.value = quarter;
            }
        };

        container._yearQuarterPickerInstance = instance;
        return instance;
    },

    renderYearMonthPicker: function(containerId, options) {
        options = options || {};
        
        if (typeof YearMonthPicker !== 'undefined' && YearMonthPicker.render) {
            return YearMonthPicker.render(containerId, options);
        }
        
        var container = document.getElementById(containerId);
        if (!container) return null;

        var currentYear = new Date().getFullYear();
        var currentMonth = new Date().getMonth() + 1;
        var years = [];
        for (var i = currentYear - 5; i <= currentYear + 1; i++) years.push(i);

        var yearOptions = years.map(function(y) { return '<option value="' + y + '"' + (y === currentYear ? ' selected' : '') + '>' + y + '年</option>'; }).join('');
        var monthOptions = '';
        for (var m = 1; m <= 12; m++) {
            monthOptions += '<option value="' + m + '"' + (m === currentMonth ? ' selected' : '') + '>' + m + '月</option>';
        }

        container.innerHTML = '<div class="year-month-picker" style="display:flex;gap:8px;align-items:center;">' +
            '<select class="form-select year-select">' + yearOptions + '</select>' +
            '<select class="form-select month-select">' + monthOptions + '</select></div>';

        var yearSelect = container.querySelector('.year-select');
        var monthSelect = container.querySelector('.month-select');

        var instance = {
            container: container,
            yearSelect: yearSelect,
            monthSelect: monthSelect,
            _onChange: options.onChange || null,

            getValue: function() {
                var year = yearSelect.value;
                var month = monthSelect.value;
                return year + '-' + String(month).padStart(2, '0');
            },

            getValueObject: function() {
                var year = yearSelect.value;
                var month = monthSelect.value;
                return {
                    year: year ? parseInt(year) : null,
                    month: month ? parseInt(month) : null,
                    formatted: this.getValue()
                };
            },

            setValue: function(value) {
                if (!value) return;
                var parts = value.split('-');
                if (parts[0]) yearSelect.value = parts[0];
                if (parts[1]) monthSelect.value = parseInt(parts[1]);
            },

            clear: function() {
                yearSelect.selectedIndex = 0;
                monthSelect.selectedIndex = 0;
            },

            destroy: function() {
                yearSelect.removeEventListener('change', this._handleChange);
                monthSelect.removeEventListener('change', this._handleChange);
                container.innerHTML = '';
            },

            _handleChange: function() {
                if (this._onChange) {
                    this._onChange(this.getValue(), this.getValueObject());
                }
            }
        };

        instance._handleChange = instance._handleChange.bind(instance);

        yearSelect.addEventListener('change', function() {
            instance._handleChange();
        });
        monthSelect.addEventListener('change', function() {
            instance._handleChange();
        });

        container._yearMonthPickerInstance = instance;
        return instance;
    },

    renderDateRangePicker: function(containerId, options) {
        options = options || {};
        
        if (typeof DateRangePicker !== 'undefined' && DateRangePicker.render) {
            return DateRangePicker.render(containerId, options);
        }
        
        var container = document.getElementById(containerId);
        if (!container) return null;

        container.innerHTML = '<div class="date-range-picker" style="display:flex;gap:8px;align-items:center;">' +
            '<input type="date" class="form-input date-start" style="width:140px;">' +
            '<span style="color:var(--text-secondary);">至</span>' +
            '<input type="date" class="form-input date-end" style="width:140px;"></div>';

        if (options.defaultStartDate) {
            container.querySelector('.date-start').value = options.defaultStartDate;
        }
        if (options.defaultEndDate) {
            container.querySelector('.date-end').value = options.defaultEndDate;
        }

        var instance = {
            container: container,
            getValue: function() {
                return {
                    startDate: container.querySelector('.date-start').value || null,
                    endDate: container.querySelector('.date-end').value || null
                };
            },
            setValue: function(startDate, endDate) {
                container.querySelector('.date-start').value = startDate || '';
                container.querySelector('.date-end').value = endDate || '';
            }
        };

        container._dateRangePickerInstance = instance;
        return instance;
    },

    renderProductGroupPicker: function(containerId, options) {
        options = options || {};
        
        if (!options.items || options.items.length === 0) {
            if (typeof financeManager !== 'undefined' && financeManager.getProductGroupOptions) {
                options.items = financeManager.getProductGroupOptions();
            }
        }
        
        if (typeof ProductGroupPicker !== 'undefined' && ProductGroupPicker.render) {
            return ProductGroupPicker.render(containerId, options);
        }
        console.warn('ProductGroupPicker 组件未加载');
        return null;
    },

    renderOrgSelect: function(callback, options) {
        options = options || {};
        
        if (!options.orgData) {
            if (typeof financeManager !== 'undefined' && financeManager.getOrganizationTreeData) {
                options.orgData = financeManager.getOrganizationTreeData();
            }
        }
        
        if (typeof OrgSelect !== 'undefined' && OrgSelect.openOrg) {
            OrgSelect.openOrg(callback, options);
        } else {
            console.warn('OrgSelect 组件未加载');
        }
    },

    renderUserSelect: function(callback, options) {
        options = options || {};
        
        if (!options.orgData) {
            if (typeof financeManager !== 'undefined' && financeManager.getOrganizationTreeData) {
                options.orgData = financeManager.getOrganizationTreeData();
            }
        }
        if (!options.users) {
            if (typeof MockData !== 'undefined' && MockData.users) {
                options.users = MockData.users;
            }
        }
        
        if (typeof OrgSelect !== 'undefined' && OrgSelect.openUser) {
            OrgSelect.openUser(callback, options);
        } else {
            console.warn('OrgSelect 组件未加载');
        }
    },

    renderDoctorSelect: function(callback, options) {
        options = options || {};
        
        if (!options.doctors) {
            if (typeof doctorManager !== 'undefined' && doctorManager.getData) {
                options.doctors = doctorManager.getData();
            }
        }
        
        if (typeof DoctorSelect !== 'undefined' && DoctorSelect.open) {
            DoctorSelect.open(callback, options);
        } else {
            console.warn('DoctorSelect 组件未加载');
        }
    },

    renderPersonPicker: function(containerId, options) {
        options = options || {};
        var container = document.getElementById(containerId);
        if (!container) return null;

        var placeholder = options.placeholder || '请选择人员';
        container.innerHTML = '<div class="person-picker-wrapper" style="position:relative;">' +
            '<input type="text" class="form-input person-picker-input" placeholder="' + placeholder + '" readonly>' +
            '<div class="person-picker-dropdown" style="display:none;position:absolute;top:100%;left:0;z-index:1000;background:#fff;border:1px solid var(--border-color);border-radius:2px;box-shadow:0 2px 8px rgba(0,0,0,0.15);min-width:200px;margin-top:4px;max-height:200px;overflow-y:auto;"></div></div>';

        var instance = {
            container: container,
            selectedPerson: null,
            getValue: function() { return this.selectedPerson; },
            setValue: function(person) { this.selectedPerson = person; container.querySelector('.person-picker-input').value = person ? person.name : ''; }
        };

        var input = container.querySelector('.person-picker-input');
        var dropdown = container.querySelector('.person-picker-dropdown');

        input.addEventListener('focus', function() {
            dropdown.style.display = 'block';
            var persons = [{ id: 'U001', name: '张三' }, { id: 'U002', name: '李四' }, { id: 'U003', name: '王五' }];
            dropdown.innerHTML = persons.map(function(p) {
                return '<div class="person-picker-item" data-id="' + p.id + '" data-name="' + p.name + '" style="padding:8px 12px;cursor:pointer;font-size:14px;">' + p.name + '</div>';
            }).join('');
            dropdown.querySelectorAll('.person-picker-item').forEach(function(item) {
                item.addEventListener('click', function() { instance.setValue({ id: this.dataset.id, name: this.dataset.name }); dropdown.style.display = 'none'; });
            });
        });
        input.addEventListener('blur', function() { setTimeout(function() { dropdown.style.display = 'none'; }, 200); });

        container._personPickerInstance = instance;
        return instance;
    },

    renderPagination: function(containerId, totalCount, currentPage, pageSize, onChange) {
        var container = document.getElementById(containerId);
        if (!container) return null;

        var totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        var html = '<span class="pagination-info">共 ' + totalCount + ' 条</span>';
        html += '<select class="pagination-select" data-action="changePageSize">' +
            '<option value="10"' + (pageSize === 10 ? ' selected' : '') + '>10条/页</option>' +
            '<option value="20"' + (pageSize === 20 ? ' selected' : '') + '>20条/页</option>' +
            '<option value="50"' + (pageSize === 50 ? ' selected' : '') + '>50条/页</option></select>';
        html += '<div class="pagination-btns">';
        html += '<button class="pagination-btn" data-action="changePage" data-page="' + (currentPage - 1) + '"' + (currentPage === 1 ? ' disabled' : '') + '>&lt;</button>';

        if (totalPages <= 7) {
            for (var i = 1; i <= totalPages; i++) {
                html += '<button class="pagination-btn' + (i === currentPage ? ' active' : '') + '" data-action="changePage" data-page="' + i + '">' + i + '</button>';
            }
        } else if (currentPage <= 4) {
            for (var i = 1; i <= 5; i++) { html += '<button class="pagination-btn' + (i === currentPage ? ' active' : '') + '" data-action="changePage" data-page="' + i + '">' + i + '</button>'; }
            html += '<span class="pagination-ellipsis">...</span>';
            html += '<button class="pagination-btn" data-action="changePage" data-page="' + totalPages + '">' + totalPages + '</button>';
        } else if (currentPage >= totalPages - 3) {
            html += '<button class="pagination-btn" data-action="changePage" data-page="1">1</button><span class="pagination-ellipsis">...</span>';
            for (var i = totalPages - 4; i <= totalPages; i++) { html += '<button class="pagination-btn' + (i === currentPage ? ' active' : '') + '" data-action="changePage" data-page="' + i + '">' + i + '</button>'; }
        } else {
            html += '<button class="pagination-btn" data-action="changePage" data-page="1">1</button><span class="pagination-ellipsis">...</span>';
            for (var i = currentPage - 1; i <= currentPage + 1; i++) { html += '<button class="pagination-btn' + (i === currentPage ? ' active' : '') + '" data-action="changePage" data-page="' + i + '">' + i + '</button>'; }
            html += '<span class="pagination-ellipsis">...</span><button class="pagination-btn" data-action="changePage" data-page="' + totalPages + '">' + totalPages + '</button>';
        }

        html += '<button class="pagination-btn" data-action="changePage" data-page="' + (currentPage + 1) + '"' + (currentPage === totalPages ? ' disabled' : '') + '>&gt;</button></div>';
        html += '<div class="pagination-jump"><span>跳至</span><input type="number" class="form-input" min="1" data-action="handleJumpPage"><span>页</span></div>';

        container.innerHTML = html;

        var jumpInput = container.querySelector('[data-action="handleJumpPage"]');
        if (jumpInput) {
            jumpInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    var page = parseInt(this.value);
                    if (page >= 1 && page <= totalPages) {
                        var fn = ComponentRenderer._resolveAction('changePage');
                        if (typeof fn === 'function') fn(page);
                    }
                }
            });
        }

        return container;
    },

    renderExportModal: function(containerId, config) {
        config = config || {};
        var container = document.getElementById(containerId);
        if (!container) return null;

        var title = config.title || '导出数据';
        var fields = config.fields || [];
        var defaultFields = config.defaultFields || [];
        var exportKey = config.exportKey;

        var exportViews = exportKey ? UIPreferenceManager.getExportViews(exportKey) : [];
        var currentFields = defaultFields;
        var currentViewId = null;

        function renderFields(selectedFields) {
            var fieldsHtml = fields.map(function(f) {
                return '<label class="checkbox-item"><input type="checkbox" value="' + f.key + '"' + (selectedFields.includes(f.key) ? ' checked' : '') + '><label>' + f.label + '</label></label>';
            }).join('');
            container.querySelector('.export-fields-grid').innerHTML = fieldsHtml;
        }

        function renderViewOptions() {
            var optionsHtml = '<option value="">-- 选择视图 --</option>';
            exportViews.forEach(function(view) {
                optionsHtml += '<option value="' + view.id + '">' + view.name + '</option>';
            });
            return optionsHtml;
        }

        container.innerHTML = '<div class="modal-overlay export-modal-overlay">' +
            '<div class="modal modal-lg"><div class="modal-header"><h3>' + title + '</h3>' +
            '<button class="modal-close export-modal-close">&times;</button></div>' +
            '<div class="modal-body"><div class="export-fields-section">' +
            '<div class="export-view-controls">' +
            '<select class="form-select export-view-select">' + renderViewOptions() + '</select>' +
            '<div class="export-view-buttons">' +
            '<button type="button" class="btn btn-default btn-sm export-save-view">保存视图</button>' +
            '<button type="button" class="btn btn-default btn-sm export-save-as-view">另存为视图</button>' +
            '<button type="button" class="btn btn-danger btn-sm export-delete-view" style="display:none;">删除视图</button>' +
            '</div>' +
            '</div>' +
            '<div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">' +
            '<span style="font-size:14px;font-weight:500;">选择导出字段</span>' +
            '<div style="display:flex;gap:8px;"><button type="button" class="btn btn-default btn-sm export-select-all">全选</button>' +
            '<button type="button" class="btn btn-default btn-sm export-deselect-all">取消全选</button></div></div>' +
            '<div class="export-fields-grid"></div></div></div>' +
            '<div class="modal-footer"><button type="button" class="btn btn-default export-cancel-btn">取消</button>' +
            '<button type="button" class="btn btn-primary export-confirm-btn">确认导出</button></div></div></div>';

        renderFields(currentFields);

        var instance = {
            container: container,
            getSelectedFields: function() {
                return Array.from(container.querySelectorAll('.export-fields-grid input[type="checkbox"]:checked')).map(function(cb) { return cb.value; });
            },
            show: function() { container.querySelector('.export-modal-overlay').classList.add('active'); },
            hide: function() { container.querySelector('.export-modal-overlay').classList.remove('active'); },
            onExport: null
        };

        container.querySelector('.export-modal-close').addEventListener('click', function() { instance.hide(); });
        container.querySelector('.export-cancel-btn').addEventListener('click', function() { instance.hide(); });
        container.querySelector('.export-select-all').addEventListener('click', function() {
            container.querySelectorAll('.export-fields-grid input[type="checkbox"]').forEach(function(cb) { cb.checked = true; });
        });
        container.querySelector('.export-deselect-all').addEventListener('click', function() {
            container.querySelectorAll('.export-fields-grid input[type="checkbox"]').forEach(function(cb) { cb.checked = false; });
        });
        container.querySelector('.export-confirm-btn').addEventListener('click', function() {
            var selectedFields = instance.getSelectedFields();
            if (selectedFields.length === 0) { Toast.warning('请至少选择一个导出字段'); return; }
            if (instance.onExport) instance.onExport(selectedFields);
            instance.hide();
        });

        container.querySelector('.export-view-select').addEventListener('change', function(e) {
            var viewId = e.target.value;
            currentViewId = viewId;
            var deleteBtn = container.querySelector('.export-delete-view');
            
            if (viewId) {
                var view = exportViews.find(function(v) { return v.id === viewId; });
                if (view) {
                    currentFields = view.fields;
                    renderFields(currentFields);
                    deleteBtn.style.display = 'inline-block';
                }
            } else {
                currentFields = defaultFields;
                renderFields(currentFields);
                deleteBtn.style.display = 'none';
            }
        });

        container.querySelector('.export-save-view').addEventListener('click', function() {
            if (!exportKey) return;
            var selectedFields = instance.getSelectedFields();
            if (selectedFields.length === 0) { Toast.warning('请至少选择一个导出字段'); return; }
            
            if (currentViewId) {
                var view = exportViews.find(function(v) { return v.id === currentViewId; });
                if (view) {
                    view.fields = selectedFields;
                    UIPreferenceManager.saveExportViews(exportKey, exportViews);
                    Toast.success('视图保存成功');
                }
            } else {
                var name = prompt('请输入视图名称：');
                if (!name) return;
                
                var id = 'view_' + Date.now();
                exportViews.push({ id: id, name: name, fields: selectedFields });
                UIPreferenceManager.saveExportViews(exportKey, exportViews);
                
                var select = container.querySelector('.export-view-select');
                var option = document.createElement('option');
                option.value = id;
                option.textContent = name;
                select.appendChild(option);
                select.value = id;
                currentViewId = id;
                container.querySelector('.export-delete-view').style.display = 'inline-block';
                Toast.success('视图保存成功');
            }
        });

        container.querySelector('.export-save-as-view').addEventListener('click', function() {
            if (!exportKey) return;
            var selectedFields = instance.getSelectedFields();
            if (selectedFields.length === 0) { Toast.warning('请至少选择一个导出字段'); return; }
            
            var name = prompt('请输入视图名称：');
            if (!name) return;
            
            var id = 'view_' + Date.now();
            exportViews.push({ id: id, name: name, fields: selectedFields });
            UIPreferenceManager.saveExportViews(exportKey, exportViews);
            
            var select = container.querySelector('.export-view-select');
            var option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            select.appendChild(option);
            select.value = id;
            currentViewId = id;
            container.querySelector('.export-delete-view').style.display = 'inline-block';
            Toast.success('视图保存成功');
        });

        container.querySelector('.export-delete-view').addEventListener('click', function() {
            if (!exportKey || !currentViewId) return;
            
            if (confirm('确定要删除此视图吗？')) {
                exportViews = exportViews.filter(function(v) { return v.id !== currentViewId; });
                UIPreferenceManager.saveExportViews(exportKey, exportViews);
                
                var select = container.querySelector('.export-view-select');
                select.removeChild(select.querySelector('option[value="' + currentViewId + '"]'));
                select.value = '';
                currentViewId = null;
                container.querySelector('.export-delete-view').style.display = 'none';
                currentFields = defaultFields;
                renderFields(currentFields);
                Toast.success('视图删除成功');
            }
        });

        container._exportModalInstance = instance;
        return instance;
    },

    renderApprovalModal: function(containerId, options) {
        options = options || {};
        var container = document.getElementById(containerId);
        if (!container) return null;

        var title = options.title || '审批操作';
        var quickReplies = options.quickReplies || ['同意', '已确认', '请修改后重新提交'];
        var action = options.action || 'approve';
        var actionConfig = {
            approve: { label: '同意', className: 'btn-primary', callback: 'onApprove' },
            return: { label: '打回', className: 'btn-warning', callback: 'onReturn' },
            reject: { label: '否决', className: 'btn-danger', callback: 'onReject' }
        };
        var currentAction = actionConfig[action] || actionConfig.approve;

        var quickRepliesHtml = quickReplies.map(function(r) { return '<button type="button" class="quick-reply-btn">' + r + '</button>'; }).join('');

        container.innerHTML = '<div class="approval-drawer-overlay">' +
            '<section class="approval-drawer" role="dialog" aria-modal="true" aria-label="' + title + '"><div class="approval-drawer-header">' +
            '<h3 class="approval-drawer-title">' + title + '</h3>' +
            '<button type="button" class="approval-drawer-close" aria-label="关闭">&times;</button></div>' +
            '<div class="approval-drawer-body"><div class="approval-comment-section">' +
            '<label class="approval-comment-label">审批意见</label>' +
            '<div class="approval-comment-textarea-wrapper">' +
            '<textarea class="approval-comment-textarea" placeholder="请输入审批意见..." maxlength="500"></textarea>' +
            '<div class="approval-comment-footer"><span class="approval-comment-count">0/500</span>' +
            '<button type="button" class="ai-polish-btn-large">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> AI润色</button></div></div></div>' +
            '<div class="quick-reply-section"><div class="quick-reply-header"><span class="quick-reply-title">快捷回复</span></div>' +
            '<div class="quick-reply-buttons">' + quickRepliesHtml + '</div></div></div>' +
            '<div class="approval-drawer-footer"><button type="button" class="btn btn-default approval-cancel-btn">取消</button>' +
            '<button type="button" class="btn ' + currentAction.className + ' approval-confirm-btn">确认' + currentAction.label + '</button></div></section></div>';

        var instance = {
            container: container,
            comment: '',
            onApprove: null,
            onReject: null,
            onReturn: null,
            show: function() {
                container.querySelector('.approval-drawer-overlay').classList.add('active');
                textarea.focus();
            },
            hide: function() { container.querySelector('.approval-drawer-overlay').classList.remove('active'); },
            getComment: function() { return container.querySelector('.approval-comment-textarea').value; }
        };

        var textarea = container.querySelector('.approval-comment-textarea');
        var countEl = container.querySelector('.approval-comment-count');

        textarea.addEventListener('input', function() { countEl.textContent = textarea.value.length + '/500'; });
        container.querySelector('.approval-drawer-close').addEventListener('click', function() { instance.hide(); });
        container.querySelector('.approval-cancel-btn').addEventListener('click', function() { instance.hide(); });
        container.querySelector('.approval-confirm-btn').addEventListener('click', function() {
            if (instance[currentAction.callback]) instance[currentAction.callback](instance.getComment());
            instance.hide();
        });

        container.querySelectorAll('.quick-reply-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                textarea.value = btn.textContent;
                countEl.textContent = textarea.value.length + '/500';
            });
        });

        container._approvalModalInstance = instance;
        return instance;
    },

    renderPaginationInstance: function(containerId, options) {
        options = options || {};
        var container = document.getElementById(containerId);
        if (!container) return null;

        var pageSize = options.pageSize || 10;
        var pageSizeOptions = options.pageSizeOptions || [10, 20, 50, 100];

        container.innerHTML = '<div class="pagination"><span class="pagination-info">共 <span class="total-count">0</span> 条</span>' +
            '<div class="pagination-btns"></div><div class="pagination-jump">' +
            '<select class="pagination-select page-size-select">' +
            pageSizeOptions.map(function(s) { return '<option value="' + s + '"' + (s === pageSize ? ' selected' : '') + '>' + s + '条/页</option>'; }).join('') +
            '</select><span style="font-size:14px;color:var(--text-secondary);">跳至</span>' +
            '<input type="number" class="form-input jump-input" min="1" style="width:60px;text-align:center;">' +
            '<span style="font-size:14px;color:var(--text-secondary);">页</span></div></div>';

        var instance = {
            container: container,
            currentPage: 1,
            pageSize: pageSize,
            totalCount: 0,
            onChange: null,
            setTotalCount: function(count) {
                this.totalCount = count;
                container.querySelector('.total-count').textContent = count;
                this._renderPages();
            },
            _renderPages: function() {
                var totalPages = Math.max(1, Math.ceil(this.totalCount / this.pageSize));
                if (this.currentPage > totalPages) this.currentPage = totalPages;
                var btnsEl = container.querySelector('.pagination-btns');
                var html = '<button class="pagination-btn" data-page="prev" ' + (this.currentPage <= 1 ? 'disabled' : '') + '>&lt;</button>';
                for (var i = 1; i <= totalPages; i++) {
                    if (totalPages <= 7 || i === 1 || i === totalPages || Math.abs(i - this.currentPage) <= 1) {
                        html += '<button class="pagination-btn ' + (i === this.currentPage ? 'active' : '') + '" data-page="' + i + '">' + i + '</button>';
                    } else if (i === this.currentPage - 2 || i === this.currentPage + 2) {
                        html += '<span class="pagination-ellipsis">...</span>';
                    }
                }
                html += '<button class="pagination-btn" data-page="next" ' + (this.currentPage >= totalPages ? 'disabled' : '') + '>&gt;</button>';
                btnsEl.innerHTML = html;
                this._bindPageEvents();
            },
            _bindPageEvents: function() {
                var self = this;
                container.querySelectorAll('.pagination-btn[data-page]').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var page = btn.dataset.page;
                        var totalPages = Math.max(1, Math.ceil(self.totalCount / self.pageSize));
                        if (page === 'prev' && self.currentPage > 1) self.currentPage--;
                        else if (page === 'next' && self.currentPage < totalPages) self.currentPage++;
                        else if (page !== 'prev' && page !== 'next') self.currentPage = parseInt(page);
                        self._renderPages();
                        if (self.onChange) self.onChange(self.currentPage, self.pageSize);
                    });
                });
            }
        };

        container.querySelector('.page-size-select').addEventListener('change', function(e) {
            instance.pageSize = parseInt(e.target.value);
            instance.currentPage = 1;
            instance._renderPages();
            if (instance.onChange) instance.onChange(instance.currentPage, instance.pageSize);
        });

        container.querySelector('.jump-input').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                var totalPages = Math.max(1, Math.ceil(instance.totalCount / instance.pageSize));
                var page = parseInt(e.target.value);
                if (page >= 1 && page <= totalPages) {
                    instance.currentPage = page;
                    instance._renderPages();
                    if (instance.onChange) instance.onChange(instance.currentPage, instance.pageSize);
                }
                e.target.value = '';
            }
        });

        container._paginationInstance = instance;
        return instance;
    },

    renderApprovalButtons: function(containerId, options) {
        options = options || {};
        var container = document.getElementById(containerId);
        if (!container) return null;

        var approveBtnId = options.approveBtnId || 'approveBtn';
        var rejectBtnId = options.rejectBtnId || 'rejectBtn';
        var returnBtnId = options.returnBtnId || 'returnBtn';
        var withdrawBtnId = options.withdrawBtnId || 'withdrawBtn';
        var deprecateBtnId = options.deprecateBtnId || 'deprecateBtn';
        var showIcons = options.showIcons !== false;
        var showWithdraw = options.showWithdraw !== false;
        var showDeprecate = options.showDeprecate !== false;

        var onApprove = options.onApprove || null;
        var onReject = options.onReject || null;
        var onReturn = options.onReturn || null;
        var onWithdraw = options.onWithdraw || null;
        var onDeprecate = options.onDeprecate || null;

        var checkIcon = showIcons ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' : '';
        var closeIcon = showIcons ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' : '';
        var returnIcon = showIcons ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>' : '';
        var withdrawIcon = showIcons ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>' : '';
        var deprecateIcon = showIcons ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' : '';

        var html = '<div class="form-actions form-actions-fixed" style="justify-content:center;">';
        if (showWithdraw) {
            html += '<button type="button" class="btn btn-warning" id="' + withdrawBtnId + '">' + withdrawIcon + ' 撤回</button>';
        }
        if (showDeprecate) {
            html += '<button type="button" class="btn btn-danger" id="' + deprecateBtnId + '">' + deprecateIcon + ' 废弃</button>';
        }
        html += '<button type="button" class="btn btn-primary" id="' + approveBtnId + '">' + checkIcon + ' 同意</button>' +
            '<button type="button" class="btn btn-danger" id="' + rejectBtnId + '">' + closeIcon + ' 不同意</button>' +
            '<button type="button" class="btn btn-warning" id="' + returnBtnId + '">' + returnIcon + ' 打回</button>' +
            '</div>';

        container.innerHTML = html;

        if (onApprove) container.querySelector('#' + approveBtnId).addEventListener('click', onApprove);
        if (onReject) container.querySelector('#' + rejectBtnId).addEventListener('click', onReject);
        if (onReturn) container.querySelector('#' + returnBtnId).addEventListener('click', onReturn);
        if (onWithdraw && showWithdraw) container.querySelector('#' + withdrawBtnId).addEventListener('click', onWithdraw);
        if (onDeprecate && showDeprecate) container.querySelector('#' + deprecateBtnId).addEventListener('click', onDeprecate);

        var instance = {
            container: container,
            getApproveBtn: function() { return container.querySelector('#' + approveBtnId); },
            getRejectBtn: function() { return container.querySelector('#' + rejectBtnId); },
            getReturnBtn: function() { return container.querySelector('#' + returnBtnId); },
            getWithdrawBtn: function() { return showWithdraw ? container.querySelector('#' + withdrawBtnId) : null; },
            getDeprecateBtn: function() { return showDeprecate ? container.querySelector('#' + deprecateBtnId) : null; }
        };

        container._approvalButtonsInstance = instance;
        return instance;
    }
};

// 全局事件委托：替代内联 onclick / onchange
// 通过 data-action 属性查找回调函数，优先查 ComponentRenderer._actionCallbacks，其次全局作用域
(function() {
    if (ComponentRenderer._delegationBound) return;
    ComponentRenderer._delegationBound = true;

    document.addEventListener('click', function(e) {
        var el = e.target.closest('[data-action]');
        if (!el) return;
        var action = el.dataset.action;
        if (!action) return;
        var fn = ComponentRenderer._resolveAction(action);
        if (typeof fn === 'function') {
            var id = el.dataset.actionId || el.dataset.id;
            var page = el.dataset.page;
            fn(id !== undefined ? id : page);
        }
    });

    document.addEventListener('change', function(e) {
        var el = e.target.closest('select[data-action]');
        if (!el) return;
        var action = el.dataset.action;
        if (!action) return;
        var fn = ComponentRenderer._resolveAction(action);
        if (typeof fn === 'function') fn(el.value);
    });
})();
