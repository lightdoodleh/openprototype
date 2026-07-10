/**
 * Toast 消息提示组件
 * 统一管理页面消息提示，替代原生 alert
 */

var Toast = {
    container: null,
    
    init: function() {
        if (this.container) return;
        
        this.container = document.createElement('div');
        this.container.id = 'toastContainer';
        this.container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px;';
        document.body.appendChild(this.container);
    },
    
    show: function(message, type, duration) {
        this.init();
        
        type = type || 'info';
        duration = duration || 3000;
        
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.style.cssText = this._getToastStyle(type);
        toast.innerHTML = this._getToastContent(type, message);
        
        this.container.appendChild(toast);
        
        setTimeout(function() {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(function() {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    },
    
    success: function(message, duration) {
        this.show(message, 'success', duration);
    },
    
    error: function(message, duration) {
        this.show(message, 'error', duration);
    },
    
    warning: function(message, duration) {
        this.show(message, 'warning', duration);
    },
    
    info: function(message, duration) {
        this.show(message, 'info', duration);
    },
    
    _getToastStyle: function(type) {
        var baseStyle = 'padding: 12px 20px; border-radius: 4px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); display: flex; align-items: center; gap: 8px; min-width: 200px; font-size: 14px;';
        var typeStyle = '';
        
        switch(type) {
            case 'success':
                typeStyle = 'background: #f6ffed; border: 1px solid #b7eb8f; color: #52c41a;';
                break;
            case 'error':
                typeStyle = 'background: #fff2f0; border: 1px solid #ffccc7; color: #ff4d4f;';
                break;
            case 'warning':
                typeStyle = 'background: #fffbe6; border: 1px solid #ffe58f; color: #faad14;';
                break;
            default:
                typeStyle = 'background: #edf6ff; border: 1px solid #91d5ff; color: #1677ff;';
        }
        
        return baseStyle + typeStyle;
    },
    
    _getToastContent: function(type, message) {
        var icon = '';
        
        switch(type) {
            case 'success':
                icon = '✓';
                break;
            case 'error':
                icon = '✕';
                break;
            case 'warning':
                icon = '⚠';
                break;
            default:
                icon = 'ℹ';
        }
        
        return '<span style="font-size: 18px; font-weight: bold;">' + icon + '</span><span>' + message + '</span>';
    }
};
