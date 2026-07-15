'use strict';

/**
 * prototype-agent-kit 本地服务器。
 *
 * 职责：
 *  1. 把项目根目录当静态站点跑（原型页面、nav-tree.json、PRD .md）。
 *  2. 把内置运行时（runtime/）挂在 /_kit/ 下，供各产品壳引用（agent-panel、shared 引擎）。
 *  3. /api/agent/* —— 代理到本机 OpenCode，驱动右侧 Agent 面板。
 *  4. /api/save-prd、/api/build-update-page-prompt、/api/update-page-from-prd。
 *
 * 所有可配置项来自 proto-kit.config.json（见 lib/config.js），此文件不含任何硬编码路径 / 私有信息。
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { loadConfig } = require('../lib/config');

function resolvePortArg(fallback) {
  const i = process.argv.indexOf('--port');
  if (i !== -1 && process.argv[i + 1]) return Number(process.argv[i + 1]);
  return fallback;
}

function resolveHostArg(fallback) {
  const i = process.argv.indexOf('--host');
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

let CONFIG = loadConfig();
// 当前目录没有 proto-kit.config.json 时（例如直接跑本包自带 demo），回退用本包自己的配置
if (!CONFIG.hasConfigFile) {
  const pkgConfig = loadConfig(__dirname);
  if (pkgConfig.hasConfigFile) CONFIG = pkgConfig;
}
const ROOT_DIR = CONFIG.rootDir;
const KIT_RUNTIME_DIR = __dirname;           // 本包 runtime/ 目录（可能位于 node_modules 内）
const PORT = resolvePortArg(CONFIG.port);
const HOST = resolveHostArg(CONFIG.host || '127.0.0.1');
const PRODUCT_ROOT = path.resolve(ROOT_DIR, 'product');
const AGENT_WRITE_ROOTS = CONFIG.productRoots.map((r) => r.dir); // Agent 只能写这些产品目录
const IS_WIN = process.platform === 'win32';

const OC = CONFIG.opencode;

let openCodeProcess = null;
let openCodeReadyPromise = null;
let openCodeOwned = false;
let openCodeStartError = '';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readJsonBodyAsync(req, maxBytes) {
  return new Promise((resolve, reject) => {
    readJsonBody(req, maxBytes, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

function readJsonBody(req, maxBytes, callback) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > maxBytes) req.destroy();
  });
  req.on('end', () => {
    try {
      callback(null, JSON.parse(body || '{}'));
    } catch (err) {
      callback(err);
    }
  });
}

function resolveProductPath(inputPath, expectedExt) {
  const targetPath = String(inputPath || '').split('?')[0].split('#')[0];
  if (!targetPath.toLowerCase().endsWith(expectedExt)) {
    throw new Error(`仅允许 ${expectedExt} 文件`);
  }
  const resolved = path.resolve(ROOT_DIR, '.' + targetPath);
  if (resolved !== PRODUCT_ROOT && !resolved.startsWith(PRODUCT_ROOT + path.sep)) {
    throw new Error('路径超出 product/ 允许范围');
  }
  return resolved;
}

/** Agent 只能改注册在配置里的产品入口目录内的文件 */
function resolveAgentWritablePath(inputPath, expectedExt) {
  const resolved = resolveProductPath(inputPath, expectedExt);
  const ok = AGENT_WRITE_ROOTS.some((root) => resolved === root || resolved.startsWith(root + path.sep));
  if (!ok) throw new Error('Agent 只能操作已注册产品的页面（见 proto-kit.config.json）');
  return resolved;
}

function isLoopbackRequest(req) {
  const remoteAddress = String(req.socket.remoteAddress || '');
  return remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1';
}

/** 写入 / Agent 类接口一律只接受本机请求，即使服务器用 --host 0.0.0.0 对局域网开放预览 */
function requireLoopback(req, res) {
  if (isLoopbackRequest(req)) return true;
  sendJson(res, 403, { ok: false, error: '该接口仅允许从本机访问' });
  return false;
}

// ── PRD 保存 ───────────────────────────────────────────
function handleSavePrd(req, res) {
  readJsonBody(req, 5 * 1024 * 1024, (parseErr, data) => {
    try {
      if (parseErr) throw parseErr;
      const resolved = resolveProductPath(data.path, '.md');
      fs.writeFile(resolved, String(data.content || ''), 'utf8', (err) => {
        if (err) {
          console.log(`[500] POST /api/save-prd -> ${err.message}`);
          return sendJson(res, 500, { ok: false, error: err.message });
        }
        console.log(`[200] POST /api/save-prd -> ${resolved}`);
        sendJson(res, 200, { ok: true });
      });
    } catch (err) {
      console.log(`[400] POST /api/save-prd -> ${err.message}`);
      sendJson(res, 400, { ok: false, error: err.message });
    }
  });
}

// ── PRD 标红提取 ───────────────────────────────────────
function normalizeRedMarkedContent(text) {
  return String(text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractRedMarkedSections(markdown) {
  const sections = [];
  const redSpanRegex = /<span\b[^>]*\bstyle\s*=\s*["'][^"']*\bcolor\s*:\s*(?:#e53935|red)\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi;
  let match;
  while ((match = redSpanRegex.exec(markdown)) !== null) {
    const content = normalizeRedMarkedContent(match[1]);
    if (content) sections.push(content);
  }
  return sections;
}

function buildRedMarkedSummary(sections) {
  return sections.map((section, index) => `${index + 1}. ${section}`).join('\n\n');
}

function isH5Path(file) {
  return file.includes(`${path.sep}h5${path.sep}`);
}

function surfaceRule(file) {
  return isH5Path(file)
    ? '当前页面为移动端 H5 原型：遵守单列、卡片列表、顶部栏、底部操作栏、安全区与 H5 设计系统；不要套用 PC 三栏表单、TableRenderer、SearchRenderer 或侧边栏菜单规则。'
    : '当前页面为 PC 原型：遵守脚本加载顺序、Renderer 渲染、BaseDataManager、STATUS_LABELS、mode=view 物理隐藏、系统字体栈、表单三栏栅格与查询区按钮聚拢规则。';
}

function buildOpenCodePrompt(htmlFile, prdFile, redMarkedSections) {
  return [
    '请根据 PRD Markdown 中标红的部分更新对应的 HTML/JS 原型页面。',
    '',
    `PRD 文件：${prdFile}`,
    `页面 HTML：${htmlFile}`,
    '',
    '本次只处理以下标红内容：',
    buildRedMarkedSummary(redMarkedSections),
    '',
    '工作要求：',
    '1. 先阅读 AGENTS.md 及 rules/ 下相关规范（项目规则、UI 组件、业务逻辑、bug 预防），以及所属产品的 shared/templates 资产。',
    '2. 只识别这份 MD 里 <span style="color:red">...</span> 或 <span style="color:#e53935">...</span> 标红的内容；不要用 git diff 作为更新范围。',
    '3. 只根据标红内容涉及的字段、规则、按钮、文案或数据变化更新对应 HTML/JS/mock/constants；未标红的历史内容一律视为背景，不得据此重写或"优化"页面。',
    '4. 不要修改 PRD 文件本身，不要改 PRD 版本号；不要动与本次标红无关的区域、字段、样式、mock 或交互。',
    surfaceRule(htmlFile),
    '5. 改完后运行 npm run check:changed，修复 ERROR 后再结束。',
    '6. 不要新建后端代码、数据库 schema 或 contracts/data-model 层；不要改无关文件。'
  ].join('\n');
}

function buildAgentSystemPrompt(htmlFile, prdFile) {
  return [
    '你是原型工作台的 AI 协作 Agent，帮用户把 PRD 与 HTML/JS 原型保持一致。',
    `当前页面：${htmlFile}`,
    `当前 PRD：${prdFile || '未识别'}`,
    surfaceRule(htmlFile),
    '',
    '执行规则：',
    '1. 每次先阅读 AGENTS.md，以及任务涉及的 rules 与所属产品的 shared/templates/references 资产。',
    '2. 用户未点名其他范围时，只处理当前页面、当前 PRD 及其直接关联的 JS、mock、constants。',
    '3. 页面、PRD 与 mock 数据必须最终一致；允许按用户指令修改 PRD，但不得填写、修改或推断 PRD 版本号。',
    '4. 不得新增后端业务代码、数据库 schema、contracts 或 data-model 层，不得改无关文件。',
    '5. 修改 HTML/JS 原型后运行 npm run check:changed，修复全部 ERROR 后再结束。',
    '6. 用中文简洁回复结果、修改文件和验证结论。'
  ].join('\n');
}

// ── OpenCode 交互 ──────────────────────────────────────
function getOpenCodeModel() {
  const parts = OC.model.split('/');
  return { providerID: parts.shift(), modelID: parts.join('/') };
}

function getOpenCodeUrl(apiPath, includeDirectory) {
  const url = new URL(apiPath, OC.baseUrl);
  if (includeDirectory !== false) url.searchParams.set('directory', ROOT_DIR);
  return url;
}

function requestOpenCode(method, apiPath, body, options) {
  const requestOptions = options || {};
  const url = getOpenCodeUrl(apiPath, requestOptions.includeDirectory);
  const payload = body === undefined || body === null ? '' : JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        Accept: 'application/json',
        ...(payload ? {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(payload)
        } : {})
      },
      timeout: requestOptions.timeout || 10000
    }, (response) => {
      let responseBody = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { responseBody += chunk; });
      response.on('end', () => {
        let data = null;
        if (responseBody) {
          try { data = JSON.parse(responseBody); } catch (err) { data = responseBody; }
        }
        if (response.statusCode >= 200 && response.statusCode < 300) return resolve(data);
        const message = data && data.error ? data.error : `OpenCode 请求失败: ${response.statusCode}`;
        reject(new Error(message));
      });
    });
    request.on('timeout', () => request.destroy(new Error('OpenCode 请求超时')));
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

async function waitForOpenCode() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < OC.startTimeoutMs) {
    try {
      return await requestOpenCode('GET', '/global/health', null, { includeDirectory: false, timeout: 800 });
    } catch (err) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(openCodeStartError || 'OpenCode 服务启动超时');
}

async function startOrReuseOpenCode() {
  try {
    return await requestOpenCode('GET', '/global/health', null, { includeDirectory: false, timeout: 800 });
  } catch (err) {
    openCodeStartError = '';
  }

  if (!OC.bin) {
    throw new Error('未找到 opencode 可执行文件。请先安装 OpenCode 并在 proto-kit.config.json 的 opencode.bin 指定路径，或运行 npx prototype-agent doctor 查看安装引导。');
  }

  openCodeProcess = spawn(OC.bin, ['serve', '--hostname', OC.host, '--port', String(OC.port)], {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: IS_WIN // Windows 上 opencode 常是 .cmd，需要 shell
  });
  openCodeOwned = true;
  openCodeProcess.stdout.on('data', () => {});
  openCodeProcess.stderr.on('data', (chunk) => {
    openCodeStartError = String(chunk || '').trim() || openCodeStartError;
  });
  openCodeProcess.on('exit', () => {
    openCodeProcess = null;
    openCodeOwned = false;
    openCodeReadyPromise = null;
  });
  openCodeProcess.on('error', (err) => { openCodeStartError = err.message; });

  return waitForOpenCode();
}

function ensureOpenCode() {
  if (!openCodeReadyPromise) {
    openCodeReadyPromise = startOrReuseOpenCode().catch((err) => {
      openCodeReadyPromise = null;
      throw err;
    });
  }
  return openCodeReadyPromise;
}

async function createOpenCodeSession(title) {
  const model = getOpenCodeModel();
  return requestOpenCode('POST', '/session', {
    title: title || '原型 Agent',
    agent: OC.agent,
    model: { id: model.modelID, providerID: model.providerID },
    metadata: { source: 'prototype-agent-kit' }
  });
}

async function sendOpenCodeMessage(sessionID, text, systemPrompt) {
  const model = getOpenCodeModel();
  await requestOpenCode('POST', `/session/${sessionID}/prompt_async`, {
    agent: OC.agent,
    model: { providerID: model.providerID, modelID: model.modelID },
    system: systemPrompt,
    parts: [{ type: 'text', text }]
  });
}

function handleUpdatePageFromPrd(req, res) {
  readJsonBody(req, 2 * 1024 * 1024, async (parseErr, data) => {
    try {
      if (parseErr) throw parseErr;
      const htmlFile = resolveProductPath(data.htmlPath, '.html');
      const prdFile = resolveProductPath(data.prdPath, '.md');
      const prdContent = fs.readFileSync(prdFile, 'utf8');
      const redMarkedSections = extractRedMarkedSections(prdContent);
      if (!redMarkedSections.length) {
        console.log(`[200] POST /api/update-page-from-prd -> no red marks: ${prdFile}`);
        return sendJson(res, 200, { ok: false, code: 'NO_PRD_RED_MARKS', error: 'MD 文件没有标红内容，无需更新' });
      }
      const prompt = String(data.prompt || '').trim() || buildOpenCodePrompt(htmlFile, prdFile, redMarkedSections);
      await ensureOpenCode();
      const session = await createOpenCodeSession(`根据PRD更新 ${path.basename(htmlFile)}`);
      await sendOpenCodeMessage(session.id, prompt, buildAgentSystemPrompt(htmlFile, prdFile));
      console.log(`[202] POST /api/update-page-from-prd -> session ${session.id}`);
      sendJson(res, 202, { ok: true, mode: 'agent', sessionId: session.id });
    } catch (err) {
      console.log(`[400] POST /api/update-page-from-prd -> ${err.message}`);
      sendJson(res, 400, { ok: false, error: err.message });
    }
  });
}

function handleBuildUpdatePagePrompt(req, res) {
  readJsonBody(req, 32 * 1024, (parseErr, data) => {
    try {
      if (parseErr) throw parseErr;
      const htmlFile = resolveProductPath(data.htmlPath, '.html');
      const prdFile = resolveProductPath(data.prdPath, '.md');
      const prdContent = fs.readFileSync(prdFile, 'utf8');
      const redMarkedSections = extractRedMarkedSections(prdContent);
      if (!redMarkedSections.length) {
        console.log(`[200] POST /api/build-update-page-prompt -> no red marks: ${prdFile}`);
        return sendJson(res, 200, { ok: false, code: 'NO_PRD_RED_MARKS', error: 'MD 文件没有标红内容，无需更新' });
      }
      const prompt = buildOpenCodePrompt(htmlFile, prdFile, redMarkedSections);
      console.log(`[200] POST /api/build-update-page-prompt -> ${prdFile}`);
      sendJson(res, 200, { ok: true, prompt });
    } catch (err) {
      console.log(`[400] POST /api/build-update-page-prompt -> ${err.message}`);
      sendJson(res, 400, { ok: false, error: err.message });
    }
  });
}

// ── SSE 事件代理 ───────────────────────────────────────
function eventMatchesSession(event, sessionID) {
  return JSON.stringify(event || {}).includes(`"sessionID":"${sessionID}"`);
}

async function proxyOpenCodeEvents(req, res, sessionID) {
  await ensureOpenCode();
  const url = getOpenCodeUrl('/event');
  const upstream = http.request({
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: 'GET',
    headers: { Accept: 'text/event-stream' }
  }, (upstreamResponse) => {
    if (upstreamResponse.statusCode !== 200) {
      sendJson(res, 502, { ok: false, error: 'OpenCode 事件流连接失败' });
      upstreamResponse.resume();
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    });
    res.write(`data: ${JSON.stringify({ type: 'proxy.ready', properties: { sessionID } })}\n\n`);

    let buffer = '';
    upstreamResponse.setEncoding('utf8');
    upstreamResponse.on('data', (chunk) => {
      buffer += chunk;
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || '';
      blocks.forEach((block) => {
        const dataLines = block.split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim());
        if (!dataLines.length) return;
        try {
          const event = JSON.parse(dataLines.join('\n'));
          if (eventMatchesSession(event, sessionID)) res.write(`data: ${JSON.stringify(event)}\n\n`);
        } catch (err) {
          // 忽略坏事件，保持连接
        }
      });
    });
    upstreamResponse.on('end', () => res.end());
    req.on('close', () => upstreamResponse.destroy());
  });
  upstream.on('error', (err) => {
    if (!res.headersSent) sendJson(res, 502, { ok: false, error: err.message });
    else {
      res.write(`data: ${JSON.stringify({ type: 'proxy.error', properties: { message: err.message } })}\n\n`);
      res.end();
    }
  });
  upstream.end();
}

async function handleAgentApi(req, res, urlPath) {
  if (!urlPath.startsWith('/api/agent/')) return false;
  if (!requireLoopback(req, res)) return true;

  try {
    if (req.method === 'GET' && urlPath === '/api/agent/status') {
      const health = await ensureOpenCode();
      sendJson(res, 200, {
        ok: true,
        healthy: !!(health && health.healthy),
        version: health && health.version,
        agent: OC.agent,
        model: OC.model
      });
      return true;
    }

    if (req.method === 'POST' && urlPath === '/api/agent/sessions') {
      const data = await readJsonBodyAsync(req, 32 * 1024);
      await ensureOpenCode();
      const session = await createOpenCodeSession(String(data.title || '').trim());
      sendJson(res, 201, { ok: true, session });
      return true;
    }

    let match = urlPath.match(/^\/api\/agent\/sessions\/(ses_[A-Za-z0-9]+)\/events$/);
    if (req.method === 'GET' && match) {
      await proxyOpenCodeEvents(req, res, match[1]);
      return true;
    }

    match = urlPath.match(/^\/api\/agent\/sessions\/(ses_[A-Za-z0-9]+)\/messages$/);
    if (match && req.method === 'GET') {
      await ensureOpenCode();
      const messages = await requestOpenCode('GET', `/session/${match[1]}/message`);
      sendJson(res, 200, { ok: true, messages: messages || [] });
      return true;
    }
    if (match && req.method === 'POST') {
      const data = await readJsonBodyAsync(req, 2 * 1024 * 1024);
      const message = String(data.message || '').trim();
      if (!message) throw new Error('消息不能为空');
      const htmlFile = resolveAgentWritablePath(data.htmlPath, '.html');
      const prdFile = data.prdPath ? resolveAgentWritablePath(data.prdPath, '.md') : '';
      await ensureOpenCode();
      await sendOpenCodeMessage(match[1], message, buildAgentSystemPrompt(htmlFile, prdFile));
      sendJson(res, 202, { ok: true });
      return true;
    }

    match = urlPath.match(/^\/api\/agent\/sessions\/(ses_[A-Za-z0-9]+)\/status$/);
    if (req.method === 'GET' && match) {
      await ensureOpenCode();
      const statuses = await requestOpenCode('GET', '/session/status');
      sendJson(res, 200, { ok: true, status: statuses && statuses[match[1]] ? statuses[match[1]] : { type: 'idle' } });
      return true;
    }
    match = urlPath.match(/^\/api\/agent\/sessions\/(ses_[A-Za-z0-9]+)\/abort$/);
    if (req.method === 'POST' && match) {
      await ensureOpenCode();
      await requestOpenCode('POST', `/session/${match[1]}/abort`, {});
      sendJson(res, 200, { ok: true });
      return true;
    }

    match = urlPath.match(/^\/api\/agent\/sessions\/(ses_[A-Za-z0-9]+)\/diff$/);
    if (req.method === 'GET' && match) {
      await ensureOpenCode();
      const diff = await requestOpenCode('GET', `/session/${match[1]}/diff`);
      sendJson(res, 200, { ok: true, diff: diff || [] });
      return true;
    }

    match = urlPath.match(/^\/api\/agent\/sessions\/(ses_[A-Za-z0-9]+)\/pending$/);
    if (req.method === 'GET' && match) {
      await ensureOpenCode();
      const [permissions, questions] = await Promise.all([
        requestOpenCode('GET', '/permission'),
        requestOpenCode('GET', '/question')
      ]);
      sendJson(res, 200, {
        ok: true,
        permissions: (permissions || []).filter((item) => eventMatchesSession(item, match[1])),
        questions: (questions || []).filter((item) => eventMatchesSession(item, match[1]))
      });
      return true;
    }

    match = urlPath.match(/^\/api\/agent\/sessions\/(ses_[A-Za-z0-9]+)\/permissions\/(per_[A-Za-z0-9]+)$/);
    if (req.method === 'POST' && match) {
      const data = await readJsonBodyAsync(req, 32 * 1024);
      if (!['once', 'always', 'reject'].includes(data.reply)) throw new Error('无效的权限回复');
      await ensureOpenCode();
      await requestOpenCode('POST', `/permission/${match[2]}/reply`, { reply: data.reply, message: String(data.message || '') });
      sendJson(res, 200, { ok: true });
      return true;
    }

    match = urlPath.match(/^\/api\/agent\/sessions\/(ses_[A-Za-z0-9]+)\/questions\/(que_[A-Za-z0-9]+)$/);
    if (req.method === 'POST' && match) {
      const data = await readJsonBodyAsync(req, 64 * 1024);
      if (!Array.isArray(data.answers)) throw new Error('问题答案格式无效');
      await ensureOpenCode();
      await requestOpenCode('POST', `/question/${match[2]}/reply`, { answers: data.answers });
      sendJson(res, 200, { ok: true });
      return true;
    }

    sendJson(res, 404, { ok: false, error: 'Agent API 不存在' });
    return true;
  } catch (err) {
    console.log(`[500] ${req.method} ${urlPath} -> ${err.message}`);
    sendJson(res, 500, { ok: false, error: err.message });
    return true;
  }
}

// ── 静态文件 ───────────────────────────────────────────
function serveStatic(req, res, baseDir, relPath) {
  const safeRel = path.normalize(relPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(baseDir, safeRel === '' || safeRel === '.' ? 'index.html' : safeRel);
  if (!filePath.startsWith(baseDir)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT' || err.code === 'EISDIR') {
        console.log(`[404] ${req.url} -> Not Found`);
        res.writeHead(404);
        res.end('File Not Found');
      } else {
        console.log(`[500] ${req.url} -> ${err.code}`);
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
      return;
    }
    console.log(`[200] ${req.url}`);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content, 'utf-8');
  });
}

const server = http.createServer(async (req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (err) {
    console.log(`[400] ${req.url} -> URI malformed`);
    res.writeHead(400);
    return res.end('Bad Request');
  }

  if (await handleAgentApi(req, res, urlPath)) return;

  if (req.method === 'POST' && urlPath === '/api/save-prd') return requireLoopback(req, res) && handleSavePrd(req, res);
  if (req.method === 'POST' && urlPath === '/api/build-update-page-prompt') return requireLoopback(req, res) && handleBuildUpdatePagePrompt(req, res);
  if (req.method === 'POST' && urlPath === '/api/update-page-from-prd') return requireLoopback(req, res) && handleUpdatePageFromPrd(req, res);

  // 内置运行时挂在 /_kit/ 下（agent 面板、shared 引擎），随包升级
  if (urlPath.startsWith('/_kit/')) {
    return serveStatic(req, res, KIT_RUNTIME_DIR, urlPath.slice('/_kit/'.length));
  }

  serveStatic(req, res, ROOT_DIR, urlPath.replace(/^\//, ''));
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`端口 ${PORT} 已被占用，请先关闭相关进程或改 proto-kit.config.json 的 port。`);
  else console.error('服务器错误:', err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log('====================================');
  console.log('prototype-agent-kit 服务器已启动');
  console.log(`地址: http://localhost:${PORT}`);
  console.log(`监听: ${HOST}${HOST === '127.0.0.1' ? '（仅本机；局域网演示用 --host 0.0.0.0）' : '（局域网可访问预览；/api/* 写入与 Agent 接口仍仅限本机）'}`);
  console.log(`项目根: ${ROOT_DIR}`);
  console.log(`OpenCode: ${OC.bin || '未检测到（Agent 面板需要它，运行 doctor 查看安装引导）'}`);
  console.log('====================================');
});

function stopOwnedOpenCode() {
  if (openCodeOwned && openCodeProcess && !openCodeProcess.killed) openCodeProcess.kill('SIGTERM');
}
process.on('SIGINT', () => { stopOwnedOpenCode(); process.exit(0); });
process.on('SIGTERM', () => { stopOwnedOpenCode(); process.exit(0); });

module.exports = { server };
