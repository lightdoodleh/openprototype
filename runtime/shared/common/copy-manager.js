/**
 * CopyManager 模块
 * 通用复制/粘贴功能基础设施
 *
 * 使用方式：
 *
 * 1. 列表页 - 添加复制按钮并实现复制逻辑：
 *
 *    // 在渲染行时添加复制按钮
 *    actionBtns += '<button class="action-icon-btn" data-action="copy" data-id="' + item.id + '" data-tooltip="复制">' + icon('copy') + '</button>';
 *
 *    // 在事件处理中添加
 *    else if (action === 'copy') CopyManager.copyItem(id, {
 *        getItem: function(id) { return yourManager.getItem(id); },
 *        storageKey: 'your_copy_data_key',
 *        url: 'your_form.html?mode=copy',
 *        excludeFields: ['id', 'status', 'creator', 'createTime', 'updater', 'updateTime'],
 *        transform: function(data) { return data; } // 可选，字段转换
 *    });
 *
 * 2. 表单页 - 页面加载时检测并填充复制数据：
 *
 *    var copyData = CopyManager.getPasteData('your_copy_data_key');
 *    if (copyData) {
 *        CopyManager.fillForm(copyData, {
 *            setFieldValue: function(id, value) { [设置表单字段值] },
 *            beforeFill: function() { [填充前处理] },
 *            afterFill: function() { [填充后处理] }
 *        });
 *    }
 *
 *    // 清理粘贴数据（可选，在成功保存后调用）
 *    CopyManager.clearPasteData('your_copy_data_key');
 */

var CopyManager = {
    storageType: 'sessionStorage',

    setStorageType: function(type) {
        this.storageType = type === 'local' ? 'localStorage' : 'sessionStorage';
    },

    getStorage: function() {
        return this.storageType === 'localStorage' ? localStorage : sessionStorage;
    },

    copyItem: function(id, options) {
        var item = options.getItem(id);
        if (!item) {
            Toast.error('未找到要复制的记录');
            return false;
        }

        var copyData = Object.assign({}, item);

        if (options.excludeFields && Array.isArray(options.excludeFields)) {
            options.excludeFields.forEach(function(field) {
                delete copyData[field];
            });
        }

        if (options.transform && typeof options.transform === 'function') {
            copyData = options.transform(copyData);
        }

        var storage = this.getStorage();
        storage.setItem(options.storageKey, JSON.stringify(copyData));

        if (options.url) {
            window.location.href = options.url;
        }

        return true;
    },

    getPasteData: function(storageKey) {
        var storage = this.getStorage();
        var dataStr = storage.getItem(storageKey);
        if (!dataStr) return null;
        try {
            return JSON.parse(dataStr);
        } catch (e) {
            console.error('解析复制数据失败:', e);
            return null;
        }
    },

    clearPasteData: function(storageKey) {
        var storage = this.getStorage();
        storage.removeItem(storageKey);
    },

    fillForm: function(data, options) {
        if (!data) return;

        if (options.beforeFill && typeof options.beforeFill === 'function') {
            options.beforeFill();
        }

        var fields = options.fields || Object.keys(data);
        fields.forEach(function(key) {
            if (data.hasOwnProperty(key)) {
                options.setFieldValue(key, data[key]);
            }
        });

        if (options.afterFill && typeof options.afterFill === 'function') {
            options.afterFill();
        }
    },

    createCopyHandler: function(options) {
        var self = this;
        return function(id) {
            self.copyItem(id, options);
            if (options.onSuccess && typeof options.onSuccess === 'function') {
                options.onSuccess();
            }
        };
    },

    createPasteHandler: function(storageKey, options) {
        var self = this;
        return function() {
            var copyData = self.getPasteData(storageKey);
            if (copyData) {
                self.fillForm(copyData, options);
                if (options.onPasted && typeof options.onPasted === 'function') {
                    options.onPasted();
                }
            }
        };
    }
};
