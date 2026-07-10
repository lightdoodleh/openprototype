/**
 * ModalManager 模块
 * 模态框管理器，统一管理模态框的打开、关闭和保存操作
 */

var ModalManager = {
    modals: {},
    
    register: function(modalId, config) {
        this.modals[modalId] = {
            element: document.getElementById(modalId),
            config: config || {}
        };
    },
    
    open: function(modalId, options) {
        options = options || {};
        var modal = this.modals[modalId];
        if (!modal || !modal.element) {
            modal = {
                element: document.getElementById(modalId),
                config: {}
            };
            this.modals[modalId] = modal;
        }
        
        var config = modal.config;
        
        if (config.titleId && options.title) {
            var titleEl = document.getElementById(config.titleId);
            if (titleEl) titleEl.textContent = options.title;
        }
        
        if (config.onOpen) {
            config.onOpen(options);
        }
        
        modal.element.classList.add('active');
    },
    
    close: function(modalId) {
        var modal = this.modals[modalId];
        if (!modal) {
            var element = document.getElementById(modalId);
            if (element) {
                element.classList.remove('active');
            }
            return;
        }
        
        if (modal.config.onClose) {
            modal.config.onClose();
        }
        
        modal.element.classList.remove('active');
    },
    
    save: function(modalId, callback) {
        var modal = this.modals[modalId];
        if (!modal) return;
        
        if (modal.config.onSave) {
            modal.config.onSave(callback);
        } else if (callback) {
            callback();
        }
    },
    
    clearForm: function(formId) {
        var form = document.getElementById(formId);
        if (!form) return;
        
        var inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(function(input) {
            if (input.type === 'checkbox' || input.type === 'radio') {
                input.checked = false;
            } else {
                input.value = '';
            }
        });
    }
};
