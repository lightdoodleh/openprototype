/**
 * view-mode.js — 只读视图统一物理隐藏（红线 §2.3.4）
 *
 * URL 带 ?mode=view 时，物理隐藏所有可编辑控件（input/textarea/select）
 * 与增删改/保存/提交/上传类操作按钮，避免各页面重复实现且漏判。
 * 仅在 mode=view 时生效，对其它模式零影响。
 */
(function () {
    function applyViewMode() {
        var params = new URLSearchParams(window.location.search);
        if (params.get('mode') !== 'view') return;

        document.querySelectorAll('input, textarea, select').forEach(function (el) {
            if (el.type === 'hidden') return;
            el.style.display = 'none';
        });

        document.querySelectorAll('button, a.btn, .btn').forEach(function (el) {
            var text = (el.textContent || '').trim();
            if (/新增|删除|编辑|保存|提交|上传/.test(text)) el.style.display = 'none';
        });
    }

    // 表单/详情可能在 load 后才异步渲染控件，补两拍兜底
    window.addEventListener('load', function () {
        applyViewMode();
        setTimeout(applyViewMode, 50);
        setTimeout(applyViewMode, 300);
    });
})();
