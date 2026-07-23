(function() {
  const KIT = window.PROTO_KIT || {};
  const NS = (KIT.productId || 'proto') + '-navigator';
  const SESSION_KEY = NS + '-agent-session';
  const WIDTH_KEY = NS + '-agent-width';
  const COLLAPSED_KEY = NS + '-agent-collapsed';
  const DEFAULT_WIDTH = 380;
  const MIN_WIDTH = 320;
  const MAX_WIDTH = 600;
  const HISTORY_REFRESH_DELAY = 180;
  const agentStorage = window['localStorage'];

  const state = {
    sessionId: agentStorage.getItem(SESSION_KEY) || '',
    currentContext: { htmlPath: '', prdPath: '', title: '' },
    taskContext: null,
    eventSource: null,
    messages: [],
    pending: { permissions: [], questions: [] },
    diff: [],
    running: false,
    connected: false,
    statusText: '正在连接 OpenCode…',
    refreshTimer: null,
    statusPollTimer: null,
    taskStartedAt: 0,
    optimisticMessage: ''
  };

  let refs = {};

  function api(path, options) {
    return fetch(path, options).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || `请求失败: ${response.status}`);
      }
      return data;
    });
  }

  function basename(filePath) {
    const cleanPath = String(filePath || '').split('?')[0].split('#')[0];
    return decodeURIComponent(cleanPath.split('/').pop() || '');
  }

  function buildPanel() {
    const panel = document.getElementById('agentPanel');
    panel.innerHTML = [
      '<button class="agent-resizer" id="agentResizer" type="button" aria-label="拖动调整 Agent 栏宽度"></button>',
      '<div class="agent-header">',
      '  <div class="agent-header-main">',
      '    <div class="agent-title-row"><span class="agent-status-dot" id="agentStatusDot"></span><span>Agent · OpenCode</span></div>',
      '    <div class="agent-subtitle" id="agentStatusText">正在连接 OpenCode…</div>',
      '  </div>',
      '  <button class="agent-header-btn agent-new-chat" id="agentNewChatBtn" type="button">新对话</button>',
      '  <button class="agent-header-btn agent-toggle" id="agentToggleBtn" type="button">收起</button>',
      '</div>',
      '<div class="agent-context">',
      '  <div class="agent-context-label">本条消息将携带</div>',
      '  <div class="agent-context-chip"><span class="agent-context-kind">页面</span><span class="agent-context-value" id="agentHtmlContext">请先从左侧选择页面</span></div>',
      '  <div class="agent-context-chip"><span class="agent-context-kind">PRD</span><span class="agent-context-value" id="agentPrdContext">未选择</span></div>',
      '  <button class="agent-quick-action" id="agentPrdUpdateBtn" type="button" disabled>按当前 PRD 标红内容更新页面</button>',
      '</div>',
      '<div class="agent-messages" id="agentMessages"></div>',
      '<div class="agent-composer">',
      '  <div class="agent-input-wrap">',
      '    <textarea class="agent-input" id="agentInput" placeholder="选择页面后，描述要修改的内容…" disabled></textarea>',
      '    <div class="agent-composer-actions">',
      '      <span class="agent-composer-hint">Enter 发送 · Shift+Enter 换行</span>',
      '      <button class="agent-send-btn" id="agentSendBtn" type="button" disabled>发送</button>',
      '      <button class="agent-stop-btn" id="agentStopBtn" type="button" hidden>停止</button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');

    refs = {
      panel,
      resizer: document.getElementById('agentResizer'),
      statusDot: document.getElementById('agentStatusDot'),
      statusText: document.getElementById('agentStatusText'),
      newChat: document.getElementById('agentNewChatBtn'),
      toggle: document.getElementById('agentToggleBtn'),
      htmlContext: document.getElementById('agentHtmlContext'),
      prdContext: document.getElementById('agentPrdContext'),
      quickAction: document.getElementById('agentPrdUpdateBtn'),
      messages: document.getElementById('agentMessages'),
      input: document.getElementById('agentInput'),
      send: document.getElementById('agentSendBtn'),
      stop: document.getElementById('agentStopBtn')
    };
  }

  function setStatus(kind, text) {
    state.statusText = text;
    refs.statusDot.className = 'agent-status-dot' + (kind ? ` is-${kind}` : '');
    refs.statusText.textContent = text;
  }

  function applyPanelWidth(width, persist) {
    const viewportLimit = Math.max(MIN_WIDTH, window.innerWidth - 290 - 560);
    const nextWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, viewportLimit, Number(width) || DEFAULT_WIDTH));
    refs.panel.style.width = `${nextWidth}px`;
    if (persist) agentStorage.setItem(WIDTH_KEY, String(nextWidth));
  }

  function setCollapsed(collapsed, persist) {
    refs.panel.classList.toggle('is-collapsed', collapsed);
    refs.toggle.textContent = collapsed ? 'Agent' : '收起';
    refs.toggle.setAttribute('aria-label', collapsed ? '展开 Agent' : '收起 Agent');
    if (!collapsed) applyPanelWidth(agentStorage.getItem(WIDTH_KEY) || DEFAULT_WIDTH, false);
    if (persist) agentStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  }

  function bindResize() {
    let resizing = false;
    refs.resizer.addEventListener('mousedown', event => {
      if (refs.panel.classList.contains('is-collapsed')) return;
      resizing = true;
      refs.resizer.classList.add('is-resizing');
      document.body.classList.add('is-resizing-agent');
      event.preventDefault();
    });
    document.addEventListener('mousemove', event => {
      if (!resizing) return;
      applyPanelWidth(window.innerWidth - event.clientX, false);
    });
    document.addEventListener('mouseup', () => {
      if (!resizing) return;
      resizing = false;
      refs.resizer.classList.remove('is-resizing');
      document.body.classList.remove('is-resizing-agent');
      applyPanelWidth(parseInt(refs.panel.style.width, 10), true);
    });
    window.addEventListener('resize', () => {
      if (!refs.panel.classList.contains('is-collapsed')) {
        applyPanelWidth(parseInt(refs.panel.style.width, 10), false);
      }
    });
  }

  function updateContextDisplay() {
    const context = state.currentContext;
    refs.htmlContext.textContent = context.htmlPath ? basename(context.htmlPath) : '请先从左侧选择页面';
    refs.htmlContext.title = context.htmlPath || '';
    refs.prdContext.textContent = context.prdPath ? basename(context.prdPath) : '未识别当前 PRD';
    refs.prdContext.title = context.prdPath || '';
    refs.input.disabled = !context.htmlPath || !state.connected || state.running;
    refs.send.disabled = refs.input.disabled || !refs.input.value.trim();
    refs.quickAction.disabled = !context.htmlPath || !context.prdPath || !state.connected || state.running;
  }

  function parseContextualText(text) {
    const value = String(text || '');
    const match = value.match(/^\[导航器上下文\]\n页面：([^\n]*)\nPRD：([^\n]*)\n\n([\s\S]*)$/);
    if (!match) return { text: value, htmlPath: '', prdPath: '' };
    return {
      htmlPath: match[1],
      prdPath: match[2] === '未识别' ? '' : match[2],
      text: match[3]
    };
  }

  function appendText(parent, className, text) {
    const element = document.createElement('div');
    element.className = className;
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  function renderMessage(item) {
    const info = item.info || item;
    const role = info.role || 'assistant';
    const parts = Array.isArray(item.parts) ? item.parts : [];
    const text = parts.filter(part => part.type === 'text').map(part => part.text || '').join('');
    const toolParts = parts.filter(part => part.type === 'tool');
    if (!text && !toolParts.length) return null;

    const wrapper = document.createElement('div');
    wrapper.className = `agent-message is-${role}`;
    appendText(wrapper, 'agent-message-role', role === 'user' ? '你' : 'OpenCode');

    const parsed = role === 'user' ? parseContextualText(text) : { text };
    if (role === 'user' && (parsed.htmlPath || parsed.prdPath)) {
      const context = document.createElement('div');
      context.className = 'agent-message-context';
      if (parsed.htmlPath) appendText(context, '', `页面 · ${basename(parsed.htmlPath)}`);
      if (parsed.prdPath) appendText(context, '', `PRD · ${basename(parsed.prdPath)}`);
      wrapper.appendChild(context);
    }
    if (parsed.text) appendText(wrapper, 'agent-message-body', parsed.text);

    toolParts.forEach(part => {
      const status = part.state && part.state.status ? part.state.status : 'pending';
      const tool = document.createElement('div');
      const statusClass = status === 'completed' ? 'complete' : status === 'error' ? 'error' : 'running';
      tool.className = `agent-tool is-${statusClass}`;
      const dot = document.createElement('span');
      dot.className = 'agent-tool-status';
      tool.appendChild(dot);
      const fallbackTitle = part.tool === 'question'
        ? (status === 'completed' ? '已收到回答' : status === 'error' ? '提问失败' : '等待你的回答')
        : (part.tool || '执行工具');
      appendText(tool, '', (part.state && part.state.title) || fallbackTitle);
      wrapper.appendChild(tool);
    });
    return wrapper;
  }

  function renderPermission(item) {
    const card = document.createElement('div');
    card.className = 'agent-request-card';
    appendText(card, 'agent-request-title', 'OpenCode 请求权限');
    const detail = item.permission || item.action || item.title || '执行受保护操作';
    appendText(card, 'agent-request-desc', detail);
    const actions = document.createElement('div');
    actions.className = 'agent-request-actions';
    [['once', '允许一次', true], ['always', '始终允许', false], ['reject', '拒绝', false]].forEach(([reply, label, primary]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'agent-request-btn' + (primary ? ' is-primary' : '');
      button.textContent = label;
      button.addEventListener('click', () => replyPermission(item.id, reply));
      actions.appendChild(button);
    });
    card.appendChild(actions);
    return card;
  }

  function renderQuestion(item) {
    const card = document.createElement('div');
    card.className = 'agent-request-card';
    appendText(card, 'agent-request-title', 'OpenCode 正在等待你的回答');
    const questions = Array.isArray(item.questions) ? item.questions : [];
    questions.forEach((question, index) => {
      const block = document.createElement('div');
      block.className = 'agent-question';
      block.dataset.questionIndex = String(index);
      if (question.header) appendText(block, 'agent-question-header', question.header);
      appendText(block, 'agent-request-desc', question.question || question.header || `问题 ${index + 1}`);

      const options = Array.isArray(question.options) ? question.options : [];
      if (options.length) {
        const optionList = document.createElement('div');
        optionList.className = 'agent-question-options';
        options.forEach(option => {
          const label = document.createElement('label');
          label.className = 'agent-question-option';
          const input = document.createElement('input');
          input.type = question.multiple ? 'checkbox' : 'radio';
          input.name = `agent-question-${item.id}-${index}`;
          input.value = option.label || option.value || String(option);
          input.className = 'agent-question-choice';
          label.appendChild(input);
          const content = document.createElement('span');
          appendText(content, 'agent-question-option-label', input.value);
          if (option.description) appendText(content, 'agent-question-option-desc', option.description);
          label.appendChild(content);
          optionList.appendChild(label);
        });
        block.appendChild(optionList);
      }

      if (question.custom !== false) {
        const custom = document.createElement('input');
        custom.type = 'text';
        custom.className = 'agent-question-field';
        custom.placeholder = options.length ? '其他，请输入' : '输入回答';
        if (!question.multiple) {
          custom.addEventListener('input', () => {
            if (!custom.value.trim()) return;
            block.querySelectorAll('.agent-question-choice').forEach(choice => { choice.checked = false; });
          });
          block.querySelectorAll('.agent-question-choice').forEach(choice => {
            choice.addEventListener('change', () => { if (choice.checked) custom.value = ''; });
          });
        }
        block.appendChild(custom);
      }
      card.appendChild(block);
    });
    const error = appendText(card, 'agent-question-error', '');
    const actions = document.createElement('div');
    actions.className = 'agent-request-actions';
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'agent-request-btn is-primary';
    submit.textContent = '提交回答';
    submit.addEventListener('click', () => {
      const answers = Array.from(card.querySelectorAll('.agent-question')).map(block => {
        const selected = Array.from(block.querySelectorAll('.agent-question-choice:checked')).map(choice => choice.value);
        const custom = block.querySelector('.agent-question-field');
        if (custom && custom.value.trim()) selected.push(custom.value.trim());
        return selected;
      });
      if (answers.some(answer => !answer.length)) {
        error.textContent = '请回答全部问题后再提交';
        return;
      }
      replyQuestion(item.id, answers);
    });
    actions.appendChild(submit);
    card.appendChild(actions);
    return card;
  }

  function renderDiff() {
    if (!state.diff.length) return null;
    const card = document.createElement('div');
    card.className = 'agent-diff-card';
    appendText(card, 'agent-diff-title', `本次会话涉及 ${state.diff.length} 个文件`);
    state.diff.slice(0, 8).forEach(item => {
      const fileName = item.file || item.path || item.filename || '';
      const additions = Number(item.additions || 0);
      const deletions = Number(item.deletions || 0);
      appendText(card, 'agent-diff-file', `${fileName}${additions || deletions ? `  +${additions} / -${deletions}` : ''}`);
    });
    return card;
  }

  function renderMessages() {
    refs.messages.replaceChildren();
    const diffCard = renderDiff();
    if (diffCard) refs.messages.appendChild(diffCard);

    state.messages.forEach(item => {
      const message = renderMessage(item);
      if (message) refs.messages.appendChild(message);
    });

    if (state.optimisticMessage) {
      const message = renderMessage({
        info: { role: 'user' },
        parts: [{ type: 'text', text: state.optimisticMessage }]
      });
      if (message) refs.messages.appendChild(message);
    }

    state.pending.permissions.forEach(item => refs.messages.appendChild(renderPermission(item)));
    state.pending.questions.forEach(item => refs.messages.appendChild(renderQuestion(item)));

    if (!refs.messages.children.length) {
      const empty = document.createElement('div');
      empty.className = 'agent-empty';
      appendText(empty, 'agent-empty-title', '直接修改当前原型');
      appendText(empty, '', '从左侧选择页面，然后描述需要调整的字段、交互或 PRD。OpenCode 会在这里持续显示过程和结果。');
      refs.messages.appendChild(empty);
    }
    refs.messages.scrollTop = refs.messages.scrollHeight;
  }

  function setRunning(running) {
    if (running && !state.running) state.taskStartedAt = Date.now();
    state.running = running;
    refs.stop.hidden = !running;
    refs.send.hidden = running;
    refs.newChat.disabled = running;
    if (running) {
      setStatus('running', 'OpenCode 正在处理…');
      scheduleStatusPoll();
    }
    else if (state.connected) setStatus('ready', state.statusText.includes('失败') ? state.statusText : 'OpenCode 已连接');
    updateContextDisplay();
  }

  function scheduleStatusPoll() {
    if (state.statusPollTimer || !state.running || !state.sessionId) return;
    state.statusPollTimer = setTimeout(async () => {
      state.statusPollTimer = null;
      if (!state.running) return;
      try {
        const data = await api(`/api/agent/sessions/${state.sessionId}/status`);
        const elapsed = Date.now() - state.taskStartedAt;
        if (data.status && data.status.type === 'idle' && elapsed > 750) {
          await finishTask();
          return;
        }
      } catch (err) {
        // SSE remains the primary signal when polling is temporarily unavailable.
      }
      scheduleStatusPoll();
    }, 800);
  }

  function scheduleHistoryRefresh() {
    clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(() => {
      refreshHistory();
      refreshPending();
    }, HISTORY_REFRESH_DELAY);
  }

  async function refreshHistory() {
    if (!state.sessionId) return;
    try {
      const data = await api(`/api/agent/sessions/${state.sessionId}/messages`);
      state.messages = data.messages || [];
      if (state.optimisticMessage && state.messages.some(item => {
        const info = item.info || item;
        const text = (item.parts || []).filter(part => part.type === 'text').map(part => part.text || '').join('');
        return info.role === 'user' && text === state.optimisticMessage;
      })) {
        state.optimisticMessage = '';
      }
      renderMessages();
      return true;
    } catch (err) {
      if (!state.running) setStatus('error', `历史加载失败：${err.message}`);
      return false;
    }
  }

  async function refreshPending() {
    if (!state.sessionId) return;
    try {
      const data = await api(`/api/agent/sessions/${state.sessionId}/pending`);
      state.pending = {
        permissions: data.permissions || [],
        questions: data.questions || []
      };
      renderMessages();
    } catch (err) {
      // Pending prompts are best-effort; message streaming remains usable.
    }
  }

  async function refreshDiff() {
    if (!state.sessionId) return;
    try {
      const data = await api(`/api/agent/sessions/${state.sessionId}/diff`);
      state.diff = Array.isArray(data.diff) ? data.diff : [];
      renderMessages();
    } catch (err) {
      state.diff = [];
    }
  }

  function reloadTaskPreview() {
    if (!state.taskContext || state.currentContext.htmlPath !== state.taskContext.htmlPath) return;
    const frame = document.getElementById('previewFrame');
    if (!frame) return;
    const baseUrl = state.taskContext.htmlPath;
    frame.src = baseUrl + (baseUrl.includes('?') ? '&' : '?') + `_agentReload=${Date.now()}`;
  }

  async function finishTask() {
    if (!state.running) return;
    clearTimeout(state.statusPollTimer);
    state.statusPollTimer = null;
    setRunning(false);
    await Promise.all([refreshHistory(), refreshPending(), refreshDiff()]);
    reloadTaskPreview();
    setStatus('ready', '已完成，预览已刷新');
  }

  function handleEvent(event) {
    const type = event.type || '';
    const properties = event.properties || {};
    if (type === 'proxy.ready') return;
    scheduleHistoryRefresh();
    if (type.includes('permission') || type.includes('question')) refreshPending();
    if (type === 'session.idle' || (type === 'session.status' && properties.status && properties.status.type === 'idle')) {
      finishTask();
      return;
    }
    if (type === 'session.error' || type === 'proxy.error') {
      setRunning(false);
      setStatus('error', properties.message || 'OpenCode 执行失败');
      return;
    }
    if (state.running || type.includes('message') || type.includes('tool')) setRunning(true);
  }

  function connectEvents() {
    if (state.eventSource) state.eventSource.close();
    if (!state.sessionId) return;
    state.eventSource = new EventSource(`/api/agent/sessions/${state.sessionId}/events`);
    state.eventSource.onmessage = message => {
      try {
        handleEvent(JSON.parse(message.data));
      } catch (err) {
        // Ignore malformed proxy messages; EventSource will continue.
      }
    };
    state.eventSource.onerror = () => {
      if (!state.connected) setStatus('error', 'OpenCode 事件流连接失败');
    };
  }

  async function createSession() {
    const data = await api('/api/agent/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: (KIT.productTitle || '原型') + ' Agent' })
    });
    state.sessionId = data.session.id;
    agentStorage.setItem(SESSION_KEY, state.sessionId);
    state.messages = [];
    state.pending = { permissions: [], questions: [] };
    state.diff = [];
    state.optimisticMessage = '';
    connectEvents();
    renderMessages();
  }

  async function ensureSession() {
    if (!state.sessionId) {
      await createSession();
      return;
    }
    const restored = await refreshHistory();
    if (!restored) {
      await createSession();
      return;
    }
    connectEvents();
    const data = await api(`/api/agent/sessions/${state.sessionId}/status`);
    setRunning(data.status && data.status.type !== 'idle');
  }

  async function sendMessage(message) {
    const text = String(message || '').trim();
    if (!text || !state.currentContext.htmlPath || state.running) return;
    try {
      if (!state.sessionId) await createSession();
      state.taskContext = { ...state.currentContext };
      state.optimisticMessage = [
        '[导航器上下文]',
        `页面：${state.taskContext.htmlPath}`,
        `PRD：${state.taskContext.prdPath || '未识别'}`,
        '',
        text
      ].join('\n');
      refs.input.value = '';
      renderMessages();
      setRunning(true);
      await api(`/api/agent/sessions/${state.sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: state.optimisticMessage,
          htmlPath: state.taskContext.htmlPath,
          prdPath: state.taskContext.prdPath
        })
      });
      scheduleHistoryRefresh();
    } catch (err) {
      state.optimisticMessage = '';
      setRunning(false);
      setStatus('error', `发送失败：${err.message}`);
      renderMessages();
    }
  }

  async function abortTask() {
    if (!state.sessionId || !state.running) return;
    try {
      await api(`/api/agent/sessions/${state.sessionId}/abort`, { method: 'POST' });
      setRunning(false);
      setStatus('ready', '任务已停止');
      await refreshHistory();
    } catch (err) {
      setStatus('error', `停止失败：${err.message}`);
    }
  }

  async function replyPermission(requestId, reply) {
    try {
      await api(`/api/agent/sessions/${state.sessionId}/permissions/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply })
      });
      await refreshPending();
    } catch (err) {
      setStatus('error', `权限回复失败：${err.message}`);
    }
  }

  async function replyQuestion(requestId, answers) {
    try {
      await api(`/api/agent/sessions/${state.sessionId}/questions/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      });
      await refreshPending();
    } catch (err) {
      setStatus('error', `回答失败：${err.message}`);
    }
  }

  function bindEvents() {
    refs.toggle.addEventListener('click', () => {
      setCollapsed(!refs.panel.classList.contains('is-collapsed'), true);
    });
    refs.newChat.addEventListener('click', async () => {
      try {
        await createSession();
        setStatus('ready', '已开始新对话');
      } catch (err) {
        setStatus('error', `新建对话失败：${err.message}`);
      }
    });
    refs.send.addEventListener('click', () => sendMessage(refs.input.value));
    refs.stop.addEventListener('click', abortTask);
    refs.quickAction.addEventListener('click', () => sendMessage('请只根据当前 PRD 中所有红色标记的内容更新当前 HTML/JS 原型及必要的 mock/constants；不要修改 PRD 本身，也不要处理未标红的历史内容。'));
    refs.input.addEventListener('input', () => {
      refs.send.disabled = refs.input.disabled || !refs.input.value.trim();
      refs.input.style.height = 'auto';
      refs.input.style.height = `${Math.min(refs.input.scrollHeight, 160)}px`;
    });
    refs.input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage(refs.input.value);
      }
    });

    window.addEventListener('pak-page-change', event => {
      const detail = event.detail || {};
      const htmlPath = detail.htmlPath || '';
      state.currentContext = {
        htmlPath,
        prdPath: htmlPath ? htmlPath.replace(/\.html(?:\?.*)?$/i, '.md') : '',
        title: detail.title || basename(htmlPath)
      };
      updateContextDisplay();
    });

    window.addEventListener('message', event => {
      const frame = document.getElementById('previewFrame');
      if (!frame || event.source !== frame.contentWindow) return;
      if (!event.data || event.data.type !== 'pak-prd-context') return;
      if (event.data.htmlPath && event.data.htmlPath !== state.currentContext.htmlPath) return;
      state.currentContext.prdPath = event.data.prdPath || '';
      updateContextDisplay();
    });
  }

  async function init() {
    buildPanel();
    bindResize();
    bindEvents();
    applyPanelWidth(agentStorage.getItem(WIDTH_KEY) || DEFAULT_WIDTH, false);
    setCollapsed(agentStorage.getItem(COLLAPSED_KEY) === '1', false);
    renderMessages();
    updateContextDisplay();

    try {
      const status = await api('/api/agent/status');
      state.connected = true;
      setStatus('ready', `OpenCode ${status.version} · ${status.model}`);
      updateContextDisplay();
      await ensureSession();
      await refreshPending();
    } catch (err) {
      state.connected = false;
      setStatus('error', `OpenCode 不可用：${err.message}`);
      updateContextDisplay();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
