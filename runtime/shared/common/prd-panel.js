/**
 * PRD 面板模块
 * 管理 PRD 文档的加载、渲染和交互
 */

// 页面可在引入本模块前声明这些全局以覆盖默认行为；未声明时使用默认值。
// PRD_OVERVIEW_VERSION 启用“当前版本”虚拟页签，PRD_WORKSPACE_MAP 配置多文档工作区。
var PRD_BASE_PATH = typeof PRD_BASE_PATH !== 'undefined' ? PRD_BASE_PATH : './';
var PRD_FILE_MAP = typeof PRD_FILE_MAP !== 'undefined' ? PRD_FILE_MAP : {};
var PRD_CACHE = typeof PRD_CACHE !== 'undefined' ? PRD_CACHE : {};

var prdPanelInitialized = false;
var prdPanelWidth = null;
var PRD_PANEL_DEFAULT_WIDTH = 680;
var PRD_PANEL_MIN_WIDTH = 360;
var PRD_PANEL_MAX_RATIO = 0.86;

// 记录本文件自身的 <script src>，用于定位同目录的 prd-panel.css 并自动注入
var PRD_PANEL_SCRIPT_SRC = document.currentScript ? document.currentScript.getAttribute('src') : '';

function arePrdPanelStylesReady() {
    var link = document.getElementById('prdPanelStyles');
    return !!(link && link.sheet);
}

function revealPrdPanelDom() {
    ['prdFloatBtn', 'prdPanel'].forEach(function(id) {
        var element = document.getElementById(id);
        if (element && element.dataset.prdPanelPending === 'true') {
            element.style.visibility = '';
            delete element.dataset.prdPanelPending;
        }
    });
}

function hidePrdPanelUntilStylesReady(element) {
    if (!element || arePrdPanelStylesReady()) return;
    element.dataset.prdPanelPending = 'true';
    element.style.visibility = 'hidden';
}

function ensurePrdPanelStyles() {
    var existingLink = document.getElementById('prdPanelStyles');
    if (existingLink) return existingLink;
    var href = PRD_PANEL_SCRIPT_SRC
        ? PRD_PANEL_SCRIPT_SRC.replace(/prd-panel\.js(?:\?.*)?$/, 'prd-panel.css')
        : 'common/prd-panel.css';
    var link = document.createElement('link');
    link.id = 'prdPanelStyles';
    link.rel = 'stylesheet';
    link.href = href;
    link.addEventListener('load', revealPrdPanelDom);
    document.head.appendChild(link);
    return link;
}

function getPrdPanelMaxWidth() {
    return Math.floor(window.innerWidth * PRD_PANEL_MAX_RATIO);
}

function clampPrdPanelWidth(width) {
    width = parseInt(width, 10);
    if (!isFinite(width)) {
        width = PRD_PANEL_DEFAULT_WIDTH;
    }
    return Math.max(PRD_PANEL_MIN_WIDTH, Math.min(getPrdPanelMaxWidth(), width));
}

function applyPrdPanelWidth(prdPanel, width) {
    prdPanelWidth = clampPrdPanelWidth(width);
    prdPanel.style.width = prdPanelWidth + 'px';
    prdPanel.style.minWidth = prdPanelWidth + 'px';
    prdPanel.style.maxWidth = 'none';
}

function ensurePrdPanelStructure(prdPanel) {
    if (!prdPanel) return null;

    prdPanel.id = 'prdPanel';
    if (!prdPanel.classList.contains('prd-slide-panel')) {
        prdPanel.classList.add('prd-slide-panel');
    }

    if (!prdPanel.querySelector('.prd-panel-resizer') ||
        !prdPanel.querySelector('#prdPanelTitle') ||
        !prdPanel.querySelector('#prdPanelFileName') ||
        !prdPanel.querySelector('#prdPanelCopyBtn') ||
        !prdPanel.querySelector('#prdPanelEditBtn') ||
        !prdPanel.querySelector('#prdPanelCloseBtn') ||
        !prdPanel.querySelector('#prdPanelTabs') ||
        !prdPanel.querySelector('#prdPanelContent') ||
        !prdPanel.querySelector('#prdPanelEditorWrap')) {
        prdPanel.innerHTML = [
            '<div class="prd-panel-resizer"></div>',
            '<div class="prd-panel-header">',
            '    <div class="prd-panel-header-left">',
            '        <h3 id="prdPanelTitle">PRD文档</h3>',
            '        <span class="prd-panel-file-name" id="prdPanelFileName"></span>',
            '        <button class="prd-panel-copy-btn" id="prdPanelCopyBtn" title="复制 MD 原文">',
            '            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
            '                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>',
            '                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>',
            '            </svg>',
            '        </button>',
            '        <button class="prd-panel-edit-btn" id="prdPanelEditBtn" title="编辑 PRD">✎ 编辑</button>',
            '        <span class="prd-panel-toast" id="prdPanelToast"></span>',
            '    </div>',
            '    <button class="prd-panel-close" id="prdPanelCloseBtn">×</button>',
            '</div>',
            '<div class="prd-panel-tabs" id="prdPanelTabs"></div>',
            '<div class="prd-panel-content" id="prdPanelContent"></div>',
            '<div class="prd-panel-editor-wrap" id="prdPanelEditorWrap" style="display:none;">',
            '    <div class="prd-panel-editor-toolbar">',
            '        <button type="button" class="prd-panel-editor-btn" id="prdPanelRedBtn">标红</button>',
            '        <button type="button" class="prd-panel-editor-btn" id="prdPanelUnredBtn">取消标红</button>',
            '        <button type="button" class="prd-panel-editor-btn" id="prdPanelUnredAllBtn">全部取消标红</button>',
            '        <span class="prd-panel-editor-msg" id="prdPanelEditorMsg"></span>',
            '        <span class="prd-panel-editor-spacer"></span>',
            '        <button type="button" class="prd-panel-editor-btn prd-panel-editor-cancel" id="prdPanelCancelBtn">取消</button>',
            '        <button type="button" class="prd-panel-editor-btn prd-panel-editor-save" id="prdPanelSaveBtn">保存</button>',
            '    </div>',
            '    <textarea class="prd-panel-editor-textarea" id="prdPanelEditorTextarea" spellcheck="false"></textarea>',
            '</div>'
        ].join('');
    }

    return prdPanel;
}

function ensurePrdPanelDom() {
    if (!document.body) return null;

    ensurePrdPanelStyles();

    var prdFloatBtn = document.getElementById('prdFloatBtn');
    if (!prdFloatBtn) {
        prdFloatBtn = document.createElement('div');
        prdFloatBtn.id = 'prdFloatBtn';
        prdFloatBtn.className = 'prd-float-btn';
        prdFloatBtn.textContent = 'PRD';
        hidePrdPanelUntilStylesReady(prdFloatBtn);
        document.body.appendChild(prdFloatBtn);
    }

    var prdPanel = document.getElementById('prdPanel');
    if (!prdPanel) {
        prdPanel = document.createElement('div');
        hidePrdPanelUntilStylesReady(prdPanel);
        document.body.appendChild(prdPanel);
    }

    return ensurePrdPanelStructure(prdPanel);
}

function initPrdPanel() {
    if (prdPanelInitialized) return;
    // 弹窗页面（prd-popup.js 已接管）跳过，避免覆盖其面板结构
    if (window.__prdPopupReady) return;

    var prdPanel = ensurePrdPanelDom();
    if (!prdPanel) return;

    prdPanelInitialized = true;

    var prdFloatBtn = document.getElementById('prdFloatBtn');
    if (prdFloatBtn) {
        prdFloatBtn.addEventListener('click', togglePrdPanel);
    }
    
    var prdPanelCloseBtn = document.getElementById('prdPanelCloseBtn');
    if (prdPanelCloseBtn) {
        prdPanelCloseBtn.addEventListener('click', function() {
            prdPanel.classList.remove('open');
        });
    }
    
    var prdPanelCopyBtn = document.getElementById('prdPanelCopyBtn');
    if (prdPanelCopyBtn) {
        prdPanelCopyBtn.addEventListener('click', copyPrdRawContent);
    }

    var prdPanelEditBtn = document.getElementById('prdPanelEditBtn');
    if (prdPanelEditBtn) {
        prdPanelEditBtn.addEventListener('click', enterPrdEditMode);
    }

    var prdPanelRedBtn = document.getElementById('prdPanelRedBtn');
    if (prdPanelRedBtn) {
        prdPanelRedBtn.addEventListener('click', applyPrdRedColor);
    }

    var prdPanelUnredBtn = document.getElementById('prdPanelUnredBtn');
    if (prdPanelUnredBtn) {
        prdPanelUnredBtn.addEventListener('click', removePrdRedColor);
    }

    var prdPanelUnredAllBtn = document.getElementById('prdPanelUnredAllBtn');
    if (prdPanelUnredAllBtn) {
        prdPanelUnredAllBtn.addEventListener('click', removeAllPrdRedColor);
    }

    var prdPanelCancelBtn = document.getElementById('prdPanelCancelBtn');
    if (prdPanelCancelBtn) {
        prdPanelCancelBtn.addEventListener('click', exitPrdEditMode);
    }

    var prdPanelSaveBtn = document.getElementById('prdPanelSaveBtn');
    if (prdPanelSaveBtn) {
        prdPanelSaveBtn.addEventListener('click', savePrdEdits);
    }

    var savedWidth = localStorage.getItem('prdPanelWidth');
    if (savedWidth) {
        applyPrdPanelWidth(prdPanel, parseInt(savedWidth, 10));
    }
    
    var resizeHandle = prdPanel.querySelector('.prd-panel-resizer');
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
            var newWidth = window.innerWidth - e.clientX;
            applyPrdPanelWidth(prdPanel, newWidth);
        });
        document.addEventListener('mouseup', function() {
            if (isResizing) {
                isResizing = false;
                resizeHandle.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                if (prdPanelWidth) {
                    localStorage.setItem('prdPanelWidth', prdPanelWidth);
                }
            }
        });
    }
    
    document.addEventListener('click', function(e) {
        if (!prdPanel.classList.contains('open')) return;
        if (prdEditMode) return;
        
        var target = e.target;
        var eventPath = typeof e.composedPath === 'function' ? e.composedPath() : [];
        var isInsidePanel = eventPath.indexOf(prdPanel) !== -1 || target.closest('#prdPanel');
        var isFloatBtn = eventPath.indexOf(prdFloatBtn) !== -1 || target.closest('.prd-float-btn');
        
        if (!isInsidePanel && !isFloatBtn) {
            prdPanel.classList.remove('open');
        }
    });
    
    updatePrdContent();
}

function togglePrdPanel() {
    var prdPanel = document.getElementById('prdPanel');
    if (!prdPanel) return;
    
    if (prdPanel.classList.contains('open')) {
        prdPanel.classList.remove('open');
    } else {
        if (prdPanelWidth) {
            applyPrdPanelWidth(prdPanel, prdPanelWidth);
        } else {
            applyPrdPanelWidth(prdPanel, PRD_PANEL_DEFAULT_WIDTH);
        }
        prdPanel.classList.add('open');
        updatePrdContent();
    }
}

var prdCurrentFileName = '';
var prdCurrentPath = '';
var prdCurrentRawContent = '';
var prdWorkspaceTabs = [];
var prdEditMode = false;
var prdWorkspaceRootPath = '';
var prdOverviewMarkdown = '';
var prdOverviewBuildToken = 0;
var PRD_OVERVIEW_PATH = './__openprototype_current_version__.md';

function notifyNavigatorPrdContext() {
    if (window.parent === window) return;
    var targetOrigin = window.location.origin === 'null' ? '*' : window.location.origin;
    var prdPath = '';
    var contextPath = isPrdOverviewPath(prdCurrentPath) ? prdWorkspaceRootPath : prdCurrentPath;
    if (contextPath) {
        prdPath = decodeURIComponent(new URL(contextPath, window.location.href).pathname);
    }
    window.parent.postMessage({
        type: 'pak-prd-context',
        htmlPath: decodeURIComponent(window.location.pathname || ''),
        prdPath: prdPath,
        title: prdCurrentFileName || ''
    }, targetOrigin);
}

function getDefaultPrdFileName(currentPage) {
    return currentPage.replace(/\.html$/i, '.md');
}

function getPrdFileCandidates(currentPage, mode) {
    var mappedFileName = PRD_FILE_MAP[currentPage];
    var defaultFileName = getDefaultPrdFileName(currentPage);
    var candidates = [];

    if (mode === 'view' || mode === 'approval') {
        var viewModeMap = {
            'annual_budget_form.html': 'annual_budget_approval.md',
            'quarterly_budget_form.html': 'quarterly_budget_approval.md',
            'monthly_budget_form.html': 'monthly_budget_approval.md',
            'resource_price_form.html': 'resource_price_approval.md',
            'kol_form.html': 'kol_list.md'
        };
        if (viewModeMap[currentPage]) {
            mappedFileName = viewModeMap[currentPage];
        }
    }

    [mappedFileName, defaultFileName].forEach(function(fileName) {
        if (fileName && candidates.indexOf(fileName) === -1) {
            candidates.push(fileName);
        }
    });

    return candidates;
}

function loadPrdCandidates(fileNames) {
    var paths = [];
    fileNames.forEach(function(fileName) {
        var localPath = './' + fileName;
        var configuredPath = PRD_BASE_PATH + fileName;
        if (paths.indexOf(localPath) === -1) {
            paths.push(localPath);
        }
        if (paths.indexOf(configuredPath) === -1) {
            paths.push(configuredPath);
        }
    });

    function loadNext(index) {
        if (index >= paths.length) {
            return Promise.resolve(null);
        }
        return loadMarkdownFile(paths[index]).then(function(content) {
            if (content) {
                return {
                    path: paths[index],
                    fileName: paths[index].split('/').pop(),
                    content: content
                };
            }
            return loadNext(index + 1);
        });
    }

    return loadNext(0);
}

function getPrdWorkspaceConfig(currentPage) {
    if (typeof PRD_WORKSPACE_MAP === 'undefined') {
        return null;
    }
    return PRD_WORKSPACE_MAP[currentPage] || null;
}

function getPrdDisplayName(filePath) {
    return (filePath || '').split('/').pop().replace(/\.md(?:#.*)?$/i, '').replace(/_/g, ' ');
}

function getPrdOverviewVersion() {
    if (typeof PRD_OVERVIEW_VERSION === 'undefined') return '';
    return String(PRD_OVERVIEW_VERSION || '').trim();
}

function isPrdOverviewPath(filePath) {
    return normalizePrdPath(filePath) === normalizePrdPath(PRD_OVERVIEW_PATH);
}

function escapePrdRegExp(text) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsPrdVersion(text, version) {
    var normalizedVersion = String(version || '').replace(/^v/i, '');
    if (!normalizedVersion) return false;
    var pattern = '(^|[^0-9.])v?' + escapePrdRegExp(normalizedVersion) + '(?=$|[^0-9.])';
    return new RegExp(pattern, 'i').test(String(text || ''));
}

function getPrdHeadingBefore(lines, index) {
    for (var lineIndex = index - 1; lineIndex >= 0; lineIndex -= 1) {
        var match = String(lines[lineIndex] || '').match(/^#{1,6}\s+(.+)$/);
        if (match) return match[1].replace(/<[^>]+>/g, '').trim();
    }
    return '';
}

function isPrdTableDivider(line) {
    return /^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(String(line || ''));
}

function collectPrdVersionSections(content, version) {
    var lines = String(content || '').split(/\r?\n/);
    var sections = [];

    for (var index = 0; index < lines.length; index += 1) {
        var line = lines[index];
        if (/^\s*\|.*\|\s*$/.test(line)) {
            var tableStart = index;
            var tableLines = [];
            while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
                tableLines.push(lines[index]);
                index += 1;
            }
            index -= 1;

            if (tableLines.length >= 3 && isPrdTableDivider(tableLines[1])) {
                var matchedRows = tableLines.slice(2).filter(function(row) {
                    return containsPrdVersion(row, version);
                });
                if (matchedRows.length) {
                    sections.push({
                        heading: getPrdHeadingBefore(lines, tableStart),
                        markdown: [tableLines[0], tableLines[1]].concat(matchedRows).join('\n')
                    });
                }
            }
            continue;
        }

        var headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch && containsPrdVersion(line, version)) {
            var headingLevel = headingMatch[1].length;
            var sectionLines = [line];
            var nextIndex = index + 1;
            while (nextIndex < lines.length) {
                var nextHeading = lines[nextIndex].match(/^(#{1,6})\s+/);
                if (nextHeading && nextHeading[1].length <= headingLevel) break;
                sectionLines.push(lines[nextIndex]);
                nextIndex += 1;
            }
            sections.push({ heading: '', markdown: sectionLines.join('\n').trim() });
            index = nextIndex - 1;
            continue;
        }

        if (containsPrdVersion(line, version)) {
            sections.push({
                heading: getPrdHeadingBefore(lines, index),
                markdown: line
            });
        }
    }

    return sections;
}

function buildPrdOverviewMarkdown(tabs, contents, version) {
    var documentSections = [];

    tabs.forEach(function(tab, index) {
        var sections = collectPrdVersionSections(contents[index], version);
        if (sections.length) documentSections.push({ tab: tab, sections: sections });
    });

    if (!documentSections.length) return '';

    var markdown = [
        '# ' + version + ' 更新总览',
        '',
        '> 自动汇总当前页面工作区内各 PRD 中标注为 ' + version + ' 的修订说明与详细规则。',
        ''
    ];

    documentSections.forEach(function(documentItem) {
        var tab = documentItem.tab;
        var documentTitle = tab.title === '主文档' ? getPrdDisplayName(tab.path) : tab.title;
        markdown.push('## ' + documentTitle, '', '来源：`' + tab.path.split('/').pop() + '`', '');

        documentItem.sections.forEach(function(section) {
            if (section.heading) markdown.push('### ' + section.heading, '');
            markdown.push(section.markdown, '');
        });
    });

    return markdown.join('\n').trim();
}

function renderPrdOverview() {
    var version = getPrdOverviewVersion();
    var contentEl = document.getElementById('prdPanelContent');
    var titleEl = document.getElementById('prdPanelTitle');
    var fileNameEl = document.getElementById('prdPanelFileName');
    var editBtn = document.getElementById('prdPanelEditBtn');
    if (!contentEl || !prdOverviewMarkdown) return;

    prdCurrentFileName = version + ' 当前版本';
    prdCurrentPath = PRD_OVERVIEW_PATH;
    prdCurrentRawContent = prdOverviewMarkdown;
    if (titleEl) titleEl.textContent = version + ' 更新总览 - PRD';
    if (fileNameEl) fileNameEl.textContent = '';
    if (editBtn) editBtn.style.display = 'none';

    contentEl.innerHTML = renderMarkdownToHtml(prdOverviewMarkdown);
    wrapPrdTables(contentEl);
    renderPrdTabs(PRD_OVERVIEW_PATH);
    bindPrdTabs();
    notifyNavigatorPrdContext();
}

function preparePrdOverview(rootPath, options) {
    options = options || {};
    var version = getPrdOverviewVersion();
    var realTabs = prdWorkspaceTabs.filter(function(tab) {
        return !isPrdOverviewPath(tab.path);
    });
    var contentOverrides = options.contentOverrides || {};
    var buildToken = ++prdOverviewBuildToken;
    var normalizedRootPath = normalizePrdPath(rootPath);

    if (!version || !realTabs.length) {
        prdOverviewMarkdown = '';
        prdWorkspaceTabs = realTabs;
        return Promise.resolve('');
    }

    return Promise.all(realTabs.map(function(tab) {
        var normalizedPath = normalizePrdPath(tab.path);
        if (Object.prototype.hasOwnProperty.call(contentOverrides, normalizedPath)) {
            return Promise.resolve(contentOverrides[normalizedPath]);
        }
        return loadMarkdownFile(tab.path);
    })).then(function(contents) {
        if (buildToken !== prdOverviewBuildToken) return '';

        prdOverviewMarkdown = buildPrdOverviewMarkdown(realTabs, contents, version);
        prdWorkspaceTabs = prdOverviewMarkdown ? [{
            title: '当前版本',
            path: PRD_OVERVIEW_PATH
        }].concat(realTabs) : realTabs;

        if (prdOverviewMarkdown && options.activateWhenReady && normalizePrdPath(prdCurrentPath) === normalizedRootPath) {
            renderPrdOverview();
        } else {
            renderPrdTabs(prdCurrentPath);
            bindPrdTabs();
        }
        return prdOverviewMarkdown;
    });
}

function normalizePrdPath(filePath) {
    var path = decodeURIComponent(String(filePath || '')).split('#')[0].split('?')[0];
    var hasDotPrefix = path.indexOf('./') === 0;
    path = path.replace(/\\/g, '/').replace(/^\.\/+/, '');
    var parts = [];
    path.split('/').forEach(function(part) {
        if (!part || part === '.') return;
        if (part === '..') {
            parts.pop();
        } else {
            parts.push(part);
        }
    });
    return (hasDotPrefix ? './' : './') + parts.join('/');
}

function resolvePrdPath(href, basePath) {
    var cleanHref = String(href || '').split('#')[0].split('?')[0];
    if (!cleanHref || /^[a-z]+:/i.test(cleanHref) || cleanHref.charAt(0) === '#') {
        return '';
    }
    if (cleanHref.indexOf('/') === 0) {
        return normalizePrdPath(cleanHref);
    }
    var base = normalizePrdPath(basePath || prdCurrentPath || './');
    var baseDir = base.substring(0, base.lastIndexOf('/') + 1);
    return normalizePrdPath(baseDir + cleanHref);
}

function isInternalPrdHref(href) {
    var cleanHref = String(href || '').split('#')[0].split('?')[0];
    return /\.md$/i.test(cleanHref) && !/^[a-z]+:/i.test(cleanHref);
}

function dedupePrdTabs(tabs) {
    var seen = {};
    return tabs.filter(function(tab) {
        var key = normalizePrdPath(tab.path);
        if (seen[key]) return false;
        seen[key] = true;
        tab.path = key;
        return true;
    });
}

function buildWorkspaceTabsFromConfig(config, rootPath) {
    if (!config || !Array.isArray(config.tabs)) {
        return [];
    }
    return dedupePrdTabs(config.tabs.map(function(tab) {
        return {
            title: tab.title || getPrdDisplayName(tab.file || tab.path),
            path: resolvePrdPath(tab.file || tab.path, rootPath)
        };
    }));
}

function buildWorkspaceTabsFromContent(contentEl, rootPath) {
    var tabs = [{
        title: '主文档',
        path: rootPath
    }];
    if (!contentEl) {
        return tabs;
    }
    contentEl.querySelectorAll('a[href]').forEach(function(link) {
        var href = link.getAttribute('href');
        if (!isInternalPrdHref(href)) return;
        tabs.push({
            title: link.textContent.trim() || getPrdDisplayName(href),
            path: resolvePrdPath(href, rootPath)
        });
    });
    return dedupePrdTabs(tabs);
}

function renderPrdTabs(activePath) {
    var tabsEl = document.getElementById('prdPanelTabs');
    if (!tabsEl) return;

    if (!prdWorkspaceTabs || prdWorkspaceTabs.length <= 1) {
        tabsEl.innerHTML = '';
        tabsEl.style.display = 'none';
        return;
    }

    tabsEl.style.display = '';
    tabsEl.innerHTML = prdWorkspaceTabs.map(function(tab) {
        var isActive = normalizePrdPath(tab.path) === normalizePrdPath(activePath);
        return '<button type="button" class="prd-panel-tab' + (isActive ? ' active' : '') + '" data-prd-path="' + escapeHtmlAttr(tab.path) + '">' + escapeHtml(tab.title) + '</button>';
    }).join('');
}

function wrapPrdTables(contentEl) {
    if (!contentEl) return;
    var tables = contentEl.querySelectorAll('table');
    tables.forEach(function(table) {
        if (!table.parentElement.classList.contains('table-wrapper')) {
            var wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });
}

function bindPrdContentLinks(contentEl) {
    if (!contentEl) return;
    contentEl.querySelectorAll('a[href]').forEach(function(link) {
        var href = link.getAttribute('href');
        if (!isInternalPrdHref(href)) return;
        link.classList.add('prd-doc-link');
        link.addEventListener('click', function(e) {
            e.preventDefault();
            var targetPath = resolvePrdPath(href, prdCurrentPath);
            openPrdPath(targetPath, { title: link.textContent.trim() });
        });
    });
}

function bindPrdTabs() {
    var tabsEl = document.getElementById('prdPanelTabs');
    if (!tabsEl) return;
    tabsEl.querySelectorAll('.prd-panel-tab').forEach(function(tabEl) {
        tabEl.addEventListener('click', function() {
            openPrdPath(tabEl.getAttribute('data-prd-path'), {
                title: tabEl.textContent.trim()
            });
        });
    });
}

function setPrdHeader(filePath, title) {
    var prdTitleEl = document.getElementById('prdPanelTitle');
    var prdFileNameEl = document.getElementById('prdPanelFileName');
    var fileName = (filePath || '').split('/').pop();

    prdCurrentFileName = fileName;
    prdCurrentPath = normalizePrdPath(filePath || fileName);

    if (prdTitleEl) {
        prdTitleEl.textContent = (title || getPrdDisplayName(fileName)) + ' - PRD';
    }
    if (prdFileNameEl) {
        prdFileNameEl.textContent = '';
    }
}

function renderLoadedPrd(result, options) {
    var prdContentEl = document.getElementById('prdPanelContent');
    if (!prdContentEl || !result || !result.content) return;

    var currentPath = normalizePrdPath(result.path || result.fileName);
    setPrdHeader(currentPath, options && options.title);
    prdCurrentRawContent = result.content;
    var editBtn = document.getElementById('prdPanelEditBtn');
    if (editBtn && !prdEditMode) editBtn.style.display = '';
    prdContentEl.innerHTML = renderMarkdownToHtml(result.content);
    wrapPrdTables(prdContentEl);

    if (options && options.resetWorkspace) {
        var configuredTabs = buildWorkspaceTabsFromConfig(options.workspaceConfig, currentPath);
        prdWorkspaceTabs = configuredTabs.length ? configuredTabs : buildWorkspaceTabsFromContent(prdContentEl, currentPath);
        prdWorkspaceRootPath = currentPath;
        prdOverviewMarkdown = '';
        var contentOverrides = {};
        contentOverrides[currentPath] = result.content;
        preparePrdOverview(currentPath, {
            activateWhenReady: true,
            contentOverrides: contentOverrides
        });
    } else if (options && options.title) {
        var targetPath = normalizePrdPath(currentPath);
        var exists = prdWorkspaceTabs.some(function(tab) {
            return normalizePrdPath(tab.path) === targetPath;
        });
        if (!exists) {
            prdWorkspaceTabs.push({
                title: options.title,
                path: targetPath
            });
        }
    }

    renderPrdTabs(currentPath);
    bindPrdTabs();
    bindPrdContentLinks(prdContentEl);
    notifyNavigatorPrdContext();
}

function openPrdPath(filePath, options) {
    var prdContentEl = document.getElementById('prdPanelContent');
    var normalizedPath = normalizePrdPath(filePath);
    if (!prdContentEl || !normalizedPath) return Promise.resolve(null);

    if (isPrdOverviewPath(normalizedPath)) {
        renderPrdOverview();
        return Promise.resolve({ path: PRD_OVERVIEW_PATH, content: prdOverviewMarkdown });
    }

    prdContentEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary);">加载中...</div>';

    return loadMarkdownFile(normalizedPath).then(function(content) {
        if (content) {
            var result = {
                path: normalizedPath,
                fileName: normalizedPath.split('/').pop(),
                content: content
            };
            renderLoadedPrd(result, options || {});
            return result;
        }
        prdContentEl.innerHTML = '<div class="error" style="padding:20px;color:var(--danger);">PRD文档加载失败，请检查文件路径：' + normalizedPath + '</div>';
        return null;
    }).catch(function(err) {
        prdContentEl.innerHTML = '<div class="error" style="padding:20px;color:var(--danger);">PRD文档加载失败：' + err.message + '</div>';
        return null;
    });
}

function updatePrdContent() {
    var prdContentEl = document.getElementById('prdPanelContent');
    var prdTitleEl = document.getElementById('prdPanelTitle');
    var prdFileNameEl = document.getElementById('prdPanelFileName');
    if (!prdContentEl) return;
    
    var currentPage = decodeURIComponent(window.location.pathname.split('/').pop()) || 'index.html';
    var urlParams = new URLSearchParams(window.location.search);
    var mode = urlParams.get('mode');
    
    var prdFileCandidates = getPrdFileCandidates(currentPage, mode);
    var prdFileName = prdFileCandidates[0];
    var workspaceConfig = getPrdWorkspaceConfig(currentPage);
    prdOverviewBuildToken += 1;
    prdWorkspaceRootPath = '';
    prdOverviewMarkdown = '';
    
    if (!prdFileName) {
        prdContentEl.innerHTML = '<div class="error" style="padding:20px;color:var(--text-secondary);">当前页面暂无对应的PRD文档</div>';
        prdCurrentPath = '';
        notifyNavigatorPrdContext();
        return;
    }
    
    prdCurrentFileName = prdFileName;
    var displayName = prdFileName.replace(/\.md$/, '').replace(/_/g, ' ');
    
    if (prdTitleEl) {
        prdTitleEl.textContent = displayName + ' - PRD';
    }
    
    if (prdFileNameEl) {
        prdFileNameEl.textContent = '';
    }
    
    prdContentEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary);">加载中...</div>';
    
    loadPrdCandidates(prdFileCandidates).then(function(result) {
        if (result && result.content) {
            renderLoadedPrd(result, {
                resetWorkspace: true,
                workspaceConfig: workspaceConfig
            });
        } else {
            prdContentEl.innerHTML = '<div class="error" style="padding:20px;color:var(--danger);">PRD文档加载失败，请检查文件路径：' + prdFileCandidates.join(' / ') + '</div>';
            prdCurrentPath = '';
            notifyNavigatorPrdContext();
        }
    }).catch(function(err) {
        prdContentEl.innerHTML = '<div class="error" style="padding:20px;color:var(--danger);">PRD文档加载失败：' + err.message + '</div>';
        prdCurrentPath = '';
        notifyNavigatorPrdContext();
    });
}

function showPrdMessage(elId, text, isError) {
    var msgEl = document.getElementById(elId);
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.classList.toggle('is-error', !!isError);
    if (text) {
        setTimeout(function() {
            if (msgEl.textContent === text) {
                msgEl.textContent = '';
                msgEl.classList.remove('is-error');
            }
        }, 2000);
    }
}

function showPrdToast(text, isError) {
    showPrdMessage('prdPanelToast', text, isError);
}

function showPrdEditorMsg(text, isError) {
    showPrdMessage('prdPanelEditorMsg', text, isError);
}

function enterPrdEditMode() {
    if (isPrdOverviewPath(prdCurrentPath)) {
        showPrdToast('“当前版本”由关联 PRD 自动汇总，请在原文页签中编辑', true);
        return;
    }
    if (isLocalFileProtocol()) {
        showPrdToast('请通过本地服务器（npm run serve）打开原型后再编辑', true);
        return;
    }

    var contentEl = document.getElementById('prdPanelContent');
    var editorWrap = document.getElementById('prdPanelEditorWrap');
    var tabsEl = document.getElementById('prdPanelTabs');
    var textarea = document.getElementById('prdPanelEditorTextarea');
    var editBtn = document.getElementById('prdPanelEditBtn');
    if (!contentEl || !editorWrap || !textarea) return;

    prdEditMode = true;
    textarea.value = prdCurrentRawContent;
    contentEl.style.display = 'none';
    if (tabsEl) tabsEl.style.display = 'none';
    if (editBtn) editBtn.style.display = 'none';
    editorWrap.style.display = '';
    textarea.focus();
}

function exitPrdEditMode() {
    var contentEl = document.getElementById('prdPanelContent');
    var editorWrap = document.getElementById('prdPanelEditorWrap');
    var editBtn = document.getElementById('prdPanelEditBtn');

    prdEditMode = false;
    if (editorWrap) editorWrap.style.display = 'none';
    if (contentEl) contentEl.style.display = '';
    if (editBtn) editBtn.style.display = '';
    renderPrdTabs(prdCurrentPath);
    bindPrdTabs();
}

function applyPrdRedColor() {
    var textarea = document.getElementById('prdPanelEditorTextarea');
    if (!textarea) return;

    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    if (start === end) {
        showPrdEditorMsg('请先选中要标红的文字', true);
        return;
    }

    var value = textarea.value;
    var selected = value.slice(start, end);
    var wrapped = wrapPrdSelectionWithRed(selected);
    var scrollTop = textarea.scrollTop;
    textarea.value = value.slice(0, start) + wrapped + value.slice(end);
    textarea.focus();
    textarea.setSelectionRange(start, start + wrapped.length);
    restorePrdEditorScroll(textarea, scrollTop);
}

function wrapPrdSelectionWithRed(text) {
    if (!isPrdMarkdownTableSelection(text)) {
        return '<span style="color:#e53935">' + text + '</span>';
    }

    return text.split('\n').map(function(line) {
        if (!isPrdMarkdownTableRow(line) || isPrdMarkdownTableDivider(line)) {
            return line;
        }
        return wrapPrdMarkdownTableRowCells(line);
    }).join('\n');
}

function isPrdMarkdownTableSelection(text) {
    return text.split('\n').some(function(line) {
        return isPrdMarkdownTableRow(line) && !isPrdMarkdownTableDivider(line);
    });
}

function isPrdMarkdownTableRow(line) {
    return /^\s*\|.*\|\s*$/.test(line);
}

function isPrdMarkdownTableDivider(line) {
    return /^\s*\|[\s:|-]+\|\s*$/.test(line);
}

function wrapPrdMarkdownTableRowCells(line) {
    var leading = line.match(/^\s*/)[0];
    var trailing = line.match(/\s*$/)[0];
    var body = line.trim();
    var cells = body.slice(1, -1).split('|');

    return leading + '|' + cells.map(function(cell) {
        var left = cell.match(/^\s*/)[0];
        var right = cell.match(/\s*$/)[0];
        var content = cell.trim();
        if (!content || /<span\b[^>]*\bstyle\s*=\s*["'][^"']*\bcolor\s*:\s*(?:#e53935|red)\b[^"']*["'][^>]*>[\s\S]*<\/span>/i.test(content)) {
            return cell;
        }
        return left + '<span style="color:#e53935">' + content + '</span>' + right;
    }).join('|') + '|' + trailing;
}

function removePrdRedColor() {
    var textarea = document.getElementById('prdPanelEditorTextarea');
    if (!textarea) return;

    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var value = textarea.value;
    var spanRegex = /<span\b[^>]*\bstyle\s*=\s*["'][^"']*\bcolor\s*:\s*(?:#e53935|red)\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi;
    var match;
    var matches = [];

    while ((match = spanRegex.exec(value)) !== null) {
        var spanStart = match.index;
        var spanEnd = match.index + match[0].length;
        if (start <= spanEnd && end >= spanStart) {
            matches.push({
                start: spanStart,
                end: spanEnd,
                full: match[0],
                inner: match[1]
            });
        }
    }

    if (!matches.length) {
        showPrdEditorMsg('请先选中或将光标放在已标红的文字上', true);
        return;
    }

    var nextValue = value;
    var scrollTop = textarea.scrollTop;
    var nextCaret = matches[0].start;
    matches.reverse().forEach(function(item) {
        nextValue = nextValue.slice(0, item.start) + item.inner + nextValue.slice(item.end);
    });
    textarea.value = nextValue;
    textarea.focus();
    textarea.setSelectionRange(nextCaret, nextCaret);
    restorePrdEditorScroll(textarea, scrollTop);
}

function removeAllPrdRedColor() {
    var textarea = document.getElementById('prdPanelEditorTextarea');
    if (!textarea) return;

    var value = textarea.value;
    var nextValue = removePrdRedSpans(value);
    if (nextValue === value) {
        showPrdEditorMsg('当前文档没有标红内容', true);
        return;
    }

    var scrollTop = textarea.scrollTop;
    var caret = textarea.selectionStart;
    textarea.value = nextValue;
    textarea.focus();
    textarea.setSelectionRange(Math.min(caret, nextValue.length), Math.min(caret, nextValue.length));
    restorePrdEditorScroll(textarea, scrollTop);
}

function removePrdRedSpans(text) {
    return text.replace(/<span\b[^>]*\bstyle\s*=\s*["'][^"']*\bcolor\s*:\s*(?:#e53935|red)\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi, '$1');
}

function restorePrdEditorScroll(textarea, scrollTop) {
    textarea.scrollTop = scrollTop;
    var restore = function() {
        textarea.scrollTop = scrollTop;
    };
    if (window.requestAnimationFrame) {
        window.requestAnimationFrame(restore);
    } else {
        setTimeout(restore, 0);
    }
}

function savePrdEdits() {
    var textarea = document.getElementById('prdPanelEditorTextarea');
    var contentEl = document.getElementById('prdPanelContent');
    if (!textarea || !contentEl || !prdCurrentPath) {
        return Promise.reject(new Error('当前没有可保存的 PRD'));
    }

    var newContent = textarea.value;
    var absolutePath = decodeURIComponent(new URL(prdCurrentPath, window.location.href).pathname);

    return fetch('/api/save-prd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: absolutePath, content: newContent })
    }).then(function(response) {
        return response.text().then(function(text) {
            var data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error('当前地址不支持保存，请通过本地服务器（npm run serve，默认 http://127.0.0.1:8082）打开原型后再编辑');
            }
            if (!response.ok || !data.ok) {
                throw new Error(data.error || ('保存失败: ' + response.status));
            }
            return data;
        });
    }).then(function() {
        PRD_CACHE[prdCurrentPath] = newContent;
        prdCurrentRawContent = newContent;
        contentEl.innerHTML = renderMarkdownToHtml(newContent);
        wrapPrdTables(contentEl);
        bindPrdContentLinks(contentEl);
        exitPrdEditMode();
        var contentOverrides = {};
        contentOverrides[normalizePrdPath(prdCurrentPath)] = newContent;
        return preparePrdOverview(prdWorkspaceRootPath || prdCurrentPath, {
            activateWhenReady: false,
            contentOverrides: contentOverrides
        }).then(function() {
            showPrdToast('已保存', false);
            return true;
        });
    }).catch(function(err) {
        showPrdEditorMsg('保存失败：' + err.message, true);
        throw err;
    });
}

function copyPrdRawContent() {
    var editorTextarea = document.getElementById('prdPanelEditorTextarea');
    var copyText = prdEditMode && editorTextarea ? editorTextarea.value : prdCurrentRawContent;
    if (!copyText && prdCurrentPath) {
        loadMarkdownFile(prdCurrentPath).then(function(content) {
            copyTextToClipboard(content || '');
        });
        return;
    }

    copyTextToClipboard(copyText || '');
}

function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
            showCopySuccess();
        }).catch(function(err) {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showCopySuccess();
    } catch (err) {
        console.error('复制失败:', err);
    }
    document.body.removeChild(textarea);
}

function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function(ch) {
        var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return map[ch] || ch;
    });
}

function escapeHtmlAttr(str) {
    return escapeHtml(str).replace(/`/g, '&#96;');
}

function showCopySuccess() {
    var copyBtn = document.getElementById('prdPanelCopyBtn');
    if (!copyBtn) return;
    
    var originalHTML = copyBtn.innerHTML;
    copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    copyBtn.style.color = '#52c41a';
    
    setTimeout(function() {
        copyBtn.innerHTML = originalHTML;
        copyBtn.style.color = '';
    }, 2000);
}

function isLocalFileProtocol() {
    return window.location.protocol === 'file:';
}

function loadMarkdownFile(filePath) {
    var inlineKey = filePath.replace(PRD_BASE_PATH, '').replace(/^\.\//, '');
    if (typeof INLINE_PRD_CONTENT !== 'undefined' && INLINE_PRD_CONTENT[inlineKey]) {
        var content = INLINE_PRD_CONTENT[inlineKey];
        PRD_CACHE[filePath] = content;
        return Promise.resolve(content);
    }
    
    return new Promise(function(resolve, reject) {
        if (isLocalFileProtocol()) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', filePath, true);
            xhr.onload = function() {
                if (xhr.status === 200 || xhr.status === 0) {
                    PRD_CACHE[filePath] = xhr.responseText;
                    resolve(xhr.responseText);
                } else {
                    resolve(null);
                }
            };
            xhr.onerror = function() {
                console.error('XHR加载失败:', filePath);
                resolve(null);
            };
            xhr.send();
        } else {
            fetch(filePath, { cache: 'no-store' })
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error('文件加载失败: ' + response.status);
                    }
                    return response.text();
                })
                .then(function(text) {
                    PRD_CACHE[filePath] = text;
                    resolve(text);
                })
                .catch(function(error) {
                    console.error('加载 Markdown 文件失败:', error);
                    resolve(null);
                });
        }
    });
}

function renderMarkdownToHtml(markdown) {
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true,
            tables: true
        });
        var html = marked.parse(markdown);
        
        if (html.indexOf('<div class="table-wrapper">') === -1) {
            html = html.replace(/<table>/g, '<div class="table-wrapper"><table>');
            html = html.replace(/<\/table>/g, '</table></div>');
        }
        
        return html;
    }
    
    var html = markdown;
    
    html = html.replace(/^###### (.*$)/gim, '<h6>$1</h6>');
    html = html.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    
    var tableRegex = /\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)+)/g;
    html = html.replace(tableRegex, function(match, header, body) {
        var headers = header.split('|').slice(1, -1);
        var rows = body.trim().split('\n');
        
        var tableHtml = '<div class="table-wrapper"><table><thead><tr>';
        headers.forEach(function(h) {
            tableHtml += '<th>' + h.trim() + '</th>';
        });
        tableHtml += '</tr></thead><tbody>';
        
        rows.forEach(function(row) {
            var cells = row.split('|').slice(1, -1);
            tableHtml += '<tr>';
            cells.forEach(function(c) {
                tableHtml += '<td>' + c.trim() + '</td>';
            });
            tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table></div>';
        return tableHtml;
    });
    
    html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    
    html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
    
    html = html.replace(/---/g, '<hr>');
    
    html = html.replace(/\n/g, '<br>');
    
    return html;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        if (!prdPanelInitialized) {
            initPrdPanel();
        }
    });
} else {
    setTimeout(function() {
        if (!prdPanelInitialized) {
            initPrdPanel();
        }
    }, 0);
}
