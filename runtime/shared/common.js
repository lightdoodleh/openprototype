/**
 * common.js - 入口文件
 * 加载所有拆分后的模块文件
 * 
 * 原始文件已拆分为以下模块：
 * - prd-panel.js - PRD 面板相关
 * - table.js - CommonTable 对象
 * - form.js - CommonForm 对象
 * - formatter.js - Formatter 对象和 icon 函数
 * - component-renderer.js - ComponentRenderer 对象
 * - modal-manager.js - ModalManager 对象
 * - form-renderer.js - FormRenderer 对象
 * - table-renderer.js - TableRenderer 对象
 */

(function() {
    var currentScript = document.currentScript;
    var sharedBasePath = currentScript && currentScript.getAttribute('src')
        ? currentScript.getAttribute('src').replace(/common\.js(?:\?.*)?$/, '')
        : 'shared/';
    var basePath = sharedBasePath + 'common/';
    var files = [
        'ui-preference-manager.js',
        'prd-panel.js',
        'toast.js',
        'data-bridge.js',
        'copy-manager.js',
        'table.js',
        'form.js',
        'formatter.js',
        'component-renderer.js',
        'line-chart.js',
        'modal-manager.js',
        'form-renderer.js',
        'search-renderer.js',
        'table-renderer.js',
        'view-mode.js'
    ];
    
    files.forEach(function(file) {
        document.write('<script src="' + basePath + file + '"><\/script>');
    });
})();
