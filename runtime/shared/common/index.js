/**
 * common 模块入口文件
 * 按顺序加载所有拆分后的模块文件
 * 
 * 加载顺序：
 * 1. prd-panel.js - PRD 面板相关
 * 2. table.js - CommonTable 对象
 * 3. form.js - CommonForm 对象
 * 4. formatter.js - Formatter 对象和 icon 函数
 * 5. component-renderer.js - ComponentRenderer 对象
 * 6. modal-manager.js - ModalManager 对象
 * 7. form-renderer.js - FormRenderer 对象
 * 8. table-renderer.js - TableRenderer 对象
 */

(function() {
    var currentScript = document.currentScript;
    var sharedBasePath = currentScript && currentScript.getAttribute('src')
        ? currentScript.getAttribute('src').replace(/common\/index\.js(?:\?.*)?$/, '')
        : 'shared/';
    var basePath = sharedBasePath + 'common/';
    var files = [
        'prd-panel.js',
        'table.js',
        'form.js',
        'formatter.js',
        'component-renderer.js',
        'line-chart.js',
        'modal-manager.js',
        'form-renderer.js',
        'table-renderer.js'
    ];
    
    files.forEach(function(file) {
        document.write('<script src="' + basePath + file + '"><\/script>');
    });
})();
