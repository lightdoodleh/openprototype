/**
 * prd-popup.js — 独立弹窗页面的 PRD 浮动按钮
 *
 * 用法：在弹窗 HTML 中添加以下两行即可：
 *   <script src="../../../shared/libs/marked.min.js" defer></script>
 *   <script src="../../../shared/common/prd-popup.js"></script>
 *
 * 自动根据 HTML 文件名（如 新增_商务餐.html）查找同目录下的 .md 文件（如 新增_商务餐.md）
 */

(function() {
    // 防止在已有 PRD 面板的页面上重复创建
    if (document.getElementById('prdFloatBtn')) return;

    // 优先复用 common/prd-panel.js 的完整面板，避免弹窗页缺少复制/编辑/更新按钮
    if (typeof initPrdPanel === 'function') {
        initPrdPanel();
        return;
    }

    // 通知 prd-panel.js 跳过初始化（弹窗页面的 PRD 由本脚本管理）
    window.__prdPopupReady = true;

    var htmlName = window.location.pathname.split('/').pop();
    var mdName = htmlName.replace(/\.html$/i, '.md');
    var panelWidth = null;
    var defaultPanelWidth = 680;
    var minPanelWidth = 360;
    var maxPanelRatio = 0.86;

    // PRD 浮动按钮
    var btn = document.createElement('div');
    btn.id = 'prdFloatBtn';
    btn.className = 'prd-float-btn';
    btn.textContent = 'PRD';
    document.body.appendChild(btn);

    // PRD 侧滑面板
    var panel = document.createElement('div');
    panel.id = 'prdPanel';
    panel.className = 'prd-slide-panel';
    panel.innerHTML =
        '<div class="prd-panel-resizer"></div>' +
        '<div class="prd-panel-header">' +
        '    <div class="prd-panel-header-left">' +
        '        <h3>PRD文档</h3>' +
        '    </div>' +
        '    <button class="prd-panel-close" id="prdPanelCloseBtn">&times;</button>' +
        '</div>' +
        '<div class="prd-panel-content" id="prdPanelContent"></div>';
    document.body.appendChild(panel);

    var contentEl = document.getElementById('prdPanelContent');

    // 切换面板
    btn.addEventListener('click', function() {
        if (panel.classList.contains('open')) {
            panel.classList.remove('open');
        } else {
            applyPanelWidth(panelWidth || getSavedPanelWidth() || defaultPanelWidth);
            panel.classList.add('open');
            loadPrd();
        }
    });

    // 关闭按钮
    document.getElementById('prdPanelCloseBtn').addEventListener('click', function() {
        panel.classList.remove('open');
    });

    // 点击面板外部关闭
    document.addEventListener('click', function(e) {
        if (!panel.classList.contains('open')) return;
        if (!panel.contains(e.target) && e.target !== btn) {
            panel.classList.remove('open');
        }
    });

    var resizeHandle = panel.querySelector('.prd-panel-resizer');
    if (resizeHandle) {
        var isResizing = false;
        resizeHandle.addEventListener('mousedown', function(e) {
            isResizing = true;
            resizeHandle.classList.add('resizing');
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
        document.addEventListener('mousemove', function(e) {
            if (!isResizing) return;
            applyPanelWidth(window.innerWidth - e.clientX);
        });
        document.addEventListener('mouseup', function() {
            if (!isResizing) return;
            isResizing = false;
            resizeHandle.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            if (panelWidth) {
                localStorage.setItem('prdPanelWidth', panelWidth);
            }
        });
    }

    function getMaxPanelWidth() {
        return Math.floor(window.innerWidth * maxPanelRatio);
    }

    function clampPanelWidth(width) {
        width = parseInt(width, 10);
        if (!isFinite(width)) {
            width = defaultPanelWidth;
        }
        return Math.max(minPanelWidth, Math.min(getMaxPanelWidth(), width));
    }

    function applyPanelWidth(width) {
        panelWidth = clampPanelWidth(width);
        panel.style.width = panelWidth + 'px';
        panel.style.minWidth = panelWidth + 'px';
        panel.style.maxWidth = 'none';
    }

    function getSavedPanelWidth() {
        var savedWidth = localStorage.getItem('prdPanelWidth');
        return savedWidth ? parseInt(savedWidth, 10) : null;
    }

    function loadPrd() {
        if (!contentEl) return;
        contentEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--rx-text-3);">加载中...</div>';

        var xhr = new XMLHttpRequest();
        xhr.open('GET', './' + mdName, true);
        xhr.onload = function() {
            if (xhr.status === 200 || xhr.status === 0) {
                if (typeof marked !== 'undefined') {
                    contentEl.innerHTML = marked.parse(xhr.responseText);
                    // 给表格包 wrapper
                    var tables = contentEl.querySelectorAll('table');
                    tables.forEach(function(t) {
                        if (!t.parentElement.classList.contains('table-wrapper')) {
                            var w = document.createElement('div');
                            w.className = 'table-wrapper';
                            t.parentNode.insertBefore(w, t);
                            w.appendChild(t);
                        }
                    });
                } else {
                    contentEl.innerHTML = '<pre style="padding:12px;white-space:pre-wrap;">' + escapeHtml(xhr.responseText) + '</pre>';
                }
            } else {
                contentEl.innerHTML = '<div style="padding:20px;color:var(--rx-danger);">PRD文档加载失败</div>';
            }
        };
        xhr.onerror = function() {
            contentEl.innerHTML = '<div style="padding:20px;color:var(--rx-danger);">PRD文档加载失败（请通过 file:// 协议打开页面）</div>';
        };
        xhr.send();
    }

    function escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, function(ch) {
            var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return map[ch] || ch;
        });
    }
})();
