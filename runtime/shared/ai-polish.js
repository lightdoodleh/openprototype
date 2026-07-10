/**
 * AI 润色组件
 * 为多行文本框提供 AI 润色、扩写、缩写、总结功能
 *
 * API:
 * - initAIPolish() - 初始化页面上所有 AI 润色文本框
 * - handleAIAction(action, textarea) - 处理 AI 操作
 *
 * action 可选值: polish（润色）、expand（扩写）、shorten（缩写）、summary（总结）
 *
 * 依赖: shared/styles.css（提供 .textarea-wrapper、.ai-polish-btn、.ai-polish-menu 样式）
 */

var AIPolish = (function() {
    'use strict';

    var ACTION_LABELS = {
        polish: 'AI 润色',
        expand: '扩写',
        shorten: '缩写',
        summary: '总结'
    };

    var ACTION_ICONS = {
        polish: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M12 3l1.912 3.874L18 8l-4.088 1.126L12 13l-1.912-3.874L6 8l4.088-1.126L12 3z"></path></svg>',
        expand: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>',
        shorten: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>',
        summary: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>'
    };

    /**
     * 模拟 AI 处理（前端原型无真实后端，模拟延迟后返回结果）
     */
    function simulateAI(action, text, callback) {
        var result;
        switch (action) {
            case 'polish':
                result = text.replace(/\s+/g, ' ').trim();
                break;
            case 'expand':
                result = text + '\n（扩写内容：以上描述可进一步细化，包含更多背景信息和具体细节。）';
                break;
            case 'shorten':
                result = text.length > 50 ? text.substring(0, Math.floor(text.length / 2)) + '…' : text;
                break;
            case 'summary':
                result = '摘要：' + (text.length > 30 ? text.substring(0, 30) + '…' : text);
                break;
            default:
                result = text;
        }

        setTimeout(function() {
            callback(result);
        }, 800);
    }

    /**
     * 处理 AI 操作
     * @param {string} action - 操作类型: polish | expand | shorten | summary
     * @param {HTMLTextAreaElement} textarea - 目标文本框
     */
    function handleAIAction(action, textarea) {
        var originalText = textarea.value.trim();
        if (!originalText) {
            if (typeof UI !== 'undefined' && UI.toast) {
                UI.toast('请先输入内容', 'warning');
            }
            return;
        }

        var label = ACTION_LABELS[action] || action;
        textarea.disabled = true;
        textarea.style.opacity = '0.6';

        simulateAI(action, originalText, function(result) {
            textarea.value = result;
            textarea.disabled = false;
            textarea.style.opacity = '1';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            if (typeof UI !== 'undefined' && UI.toast) {
                UI.toast(label + '完成', 'success');
            }
        });
    }

    /**
     * 创建 AI 按钮和菜单
     */
    function createAIButton(textarea) {
        var wrapper = document.createElement('div');
        wrapper.className = 'textarea-wrapper';
        textarea.parentNode.insertBefore(wrapper, textarea);
        wrapper.appendChild(textarea);
        textarea.classList.add('ai-textarea');

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ai-polish-btn';
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#9254de" stroke-width="2" style="width:18px;height:18px;"><path d="M12 3l1.912 3.874L18 8l-4.088 1.126L12 13l-1.912-3.874L6 8l4.088-1.126L12 3z"></path><path d="M5 15l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5.5-1z"></path><path d="M19 11l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5.5-1z"></path><path d="M17 17l.3 1 1 .3-1 .3-.3 1-.3-1-1-.3 1-.3.3-1z"></path></svg>';
        wrapper.appendChild(btn);

        var menu = document.createElement('div');
        menu.className = 'ai-polish-menu';
        var actions = ['polish', 'expand', 'shorten', 'summary'];
        actions.forEach(function(action) {
            var item = document.createElement('div');
            item.className = 'ai-polish-menu-item';
            item.dataset.action = action;
            item.innerHTML = ACTION_ICONS[action] + ' ' + ACTION_LABELS[action];
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                menu.classList.remove('active');
                handleAIAction(action, textarea);
            });
            menu.appendChild(item);
        });
        wrapper.appendChild(menu);

        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            menu.classList.toggle('active');
        });

        document.addEventListener('click', function(e) {
            if (!wrapper.contains(e.target)) {
                menu.classList.remove('active');
            }
        });
    }

    /**
     * 初始化页面上所有 AI 润色文本框
     * 自动查找所有带 .ai-textarea 类的 textarea，为其添加 AI 润色按钮
     */
    function initAIPolish() {
        var textareas = document.querySelectorAll('textarea.ai-textarea');
        textareas.forEach(function(textarea) {
            if (!textarea.parentNode.classList.contains('textarea-wrapper')) {
                createAIButton(textarea);
            }
        });
    }

    return {
        init: initAIPolish,
        handleAction: handleAIAction,
        ACTION_LABELS: ACTION_LABELS
    };
})();

function initAIPolish() {
    AIPolish.init();
}

function handleAIAction(action, textarea) {
    AIPolish.handleAction(action, textarea);
}
