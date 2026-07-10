/**
 * 审批列表 · 视图控制（合规版）
 *
 * 红线：零内联、事件委托、不直接操作 localStorage。
 *
 * 布局（重要）：
 *   - 视图栏 rx-view-controls（rx-list-control-row 内）：视图下拉 + 筛选字段 + 视图另存为
 *   - 查询区下方的「查询/重置/新增」按钮行最右侧：展示字段（操作表格列）
 *   「展示字段」按钮不在视图栏里，因此本组件用事件委托覆盖整个列表面板。
 *
 * 用法：
 *   1. HTML 在 common.js 之后引入：<script src="../shared/view-controls.js"></script>
 *   2. 容器结构见 templates/approval_list_page_template.html
 *   3. 页面 JS 初始化：
 *        ViewControls.init({
 *            root: 'rx-page-content',                    // 可选，默认 document；需覆盖视图栏与查询按钮行
 *            onViewChange: function(viewKey) { ... },     // 切换视图
 *            onApplyFields: function(type, values) {...}, // type: 'filter' | 'display'
 *            onSaveView: function(viewName) { ... }       // 视图另存为
 *        });
 *
 * 通过 data-action / data-view 事件委托：
 *   - data-action="toggle-view-menu"   视图下拉触发器（.rx-view-select 内）
 *   - data-view="default|my|pending"   视图菜单项（.rx-view-menu 内）
 *   - data-action="toggle-filter"      筛选字段按钮（.rx-view-field 内，控制查询区）
 *   - data-action="toggle-display"     展示字段按钮（.rx-view-field 内，控制表格列）
 *   - data-action="save-view"          视图另存为按钮
 */
(function (global) {
    'use strict';

    function closeAllDropdowns() {
        document.querySelectorAll('.rx-view-menu.active, .rx-view-dropdown.active').forEach(function (d) {
            d.classList.remove('active');
        });
    }

    function toggleDropdown(dropdown) {
        if (!dropdown) return;
        var willOpen = !dropdown.classList.contains('active');
        closeAllDropdowns();
        if (willOpen) dropdown.classList.add('active');
    }

    function readChecked(dropdown) {
        var values = [];
        dropdown.querySelectorAll('input[type="checkbox"]:checked').forEach(function (cb) {
            values.push(cb.value);
        });
        return values;
    }

    var ViewControls = {
        init: function (opts) {
            opts = opts || {};
            var root = opts.root
                ? (typeof opts.root === 'string' ? document.getElementById(opts.root) : opts.root)
                : document;
            if (!root) return;

            root.addEventListener('click', function (e) {
                var menuItem = e.target.closest('.rx-view-menu-item[data-view]');
                if (menuItem) {
                    var menu = menuItem.closest('.rx-view-menu');
                    menu.querySelectorAll('.rx-view-menu-item').forEach(function (it) {
                        it.classList.toggle('active', it === menuItem);
                    });
                    var select = menuItem.closest('.rx-view-select');
                    var text = select && select.querySelector('.rx-view-select-text');
                    if (text) text.textContent = menuItem.textContent.trim();
                    closeAllDropdowns();
                    if (typeof opts.onViewChange === 'function') {
                        opts.onViewChange(menuItem.getAttribute('data-view'));
                    }
                    return;
                }

                var actionEl = e.target.closest('[data-action]');
                if (!actionEl) return;
                var action = actionEl.getAttribute('data-action');

                if (action === 'toggle-view-menu') {
                    toggleDropdown(actionEl.closest('.rx-view-select').querySelector('.rx-view-menu'));
                } else if (action === 'toggle-filter' || action === 'toggle-display') {
                    toggleDropdown(actionEl.closest('.rx-view-field').querySelector('.rx-view-dropdown'));
                } else if (action === 'save-view') {
                    closeAllDropdowns();
                    ViewControls.openSaveDialog(opts.onSaveView);
                }
            });

            root.addEventListener('change', function (e) {
                var cb = e.target;
                if (cb.type !== 'checkbox') return;
                var dropdown = cb.closest('.rx-view-dropdown');
                if (!dropdown) return;
                var type = dropdown.getAttribute('data-field-type') || 'filter';
                if (typeof opts.onApplyFields === 'function') {
                    opts.onApplyFields(type, readChecked(dropdown));
                }
            });

            document.addEventListener('click', function (e) {
                if (!e.target.closest('.rx-view-select') && !e.target.closest('.rx-view-field')) {
                    closeAllDropdowns();
                }
            });
        },

        openSaveDialog: function (onSave) {
            var holder = document.getElementById('modalContainer') || document.body;
            holder.insertAdjacentHTML('beforeend',
                '<div class="modal-overlay" id="rxSaveViewModal" style="display:flex;">' +
                '<div class="modal" style="width:420px;max-width:90%;">' +
                '<div class="modal-header"><h3>视图另存为</h3>' +
                '<button type="button" class="modal-close" data-action="save-view-close">&times;</button></div>' +
                '<div class="modal-body">' +
                '<div class="form-item"><label class="form-label">视图名称</label>' +
                '<input type="text" class="form-input" id="rxViewNameInput" maxlength="50" placeholder="please enter a view name"></div>' +
                '</div>' +
                '<div class="modal-footer" style="display:flex;justify-content:flex-end;gap:8px;">' +
                '<button type="button" class="btn" data-action="save-view-close">取消</button>' +
                '<button type="button" class="btn btn-primary" data-action="save-view-confirm">保存</button>' +
                '</div></div></div>');

            var modal = document.getElementById('rxSaveViewModal');
            var input = document.getElementById('rxViewNameInput');
            if (input) input.focus();

            modal.addEventListener('click', function (e) {
                var t = e.target.closest('[data-action]');
                if (t && t.getAttribute('data-action') === 'save-view-confirm') {
                    var name = (input && input.value || '').trim();
                    if (!name) {
                        if (global.UI && global.UI.toast) global.UI.toast('请输入视图名称', 'error');
                        return;
                    }
                    if (typeof onSave === 'function') onSave(name);
                    modal.remove();
                } else if (t || e.target === modal) {
                    modal.remove();
                }
            });
        }
    };

    global.ViewControls = ViewControls;
})(window);
