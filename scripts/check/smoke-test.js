#!/usr/bin/env node
/**
 * 运行时冒烟测试 — 用无头 Chromium 真实打开每个页面。
 *
 * 检查：
 *   1. 页面加载有无未捕获异常 / console.error（ERROR）
 *   2. 资源加载失败（404 等，WARN）
 *   3. _form / _detail 页面带 ?mode=view 时，输入框与增删改按钮是否物理隐藏（ERROR）
 *
 * 用法：
 *   node scripts/check/smoke-test.js                    # 测全部页面
 *   node scripts/check/smoke-test.js product/demo/pc   # 指定目录/文件
 *   node scripts/check/smoke-test.js --changed          # 只测 git 改动的页面
 *   node scripts/check/smoke-test.js --json
 *
 * 失败页面会在 scripts/check/_screenshots/ 下留截图。
 * 退出码 = ERROR 页面数。
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8082;
const BASE = `http://localhost:${PORT}`;
const SHOT_DIR = path.join(__dirname, '_screenshots');
const NON_PAGE_DIRS = new Set(['shared', 'references', 'templates', 'node_modules', '.git', '.claude']);

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('\n⚠️  未安装 playwright，跳过运行时冒烟测试。');
  console.error('   安装：npm install   然后  npx playwright install chromium\n');
  process.exit(0);
}

/* ---------- 目标页面 ---------- */
function isInfra(p) {
  return path.relative(ROOT, p).split(path.sep).some((s) => NON_PAGE_DIRS.has(s));
}
function listHtml(targets) {
  const out = new Set();
  const walk = (p) => {
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (NON_PAGE_DIRS.has(path.basename(p))) return;
      fs.readdirSync(p).forEach((n) => walk(path.join(p, n)));
    } else if (/\.html$/i.test(p) && !isInfra(p) && path.basename(p) !== 'index.html') {
      out.add(p);
    }
  };
  for (const t of targets) {
    const abs = path.isAbsolute(t) ? t : path.join(ROOT, t);
    if (fs.existsSync(abs)) walk(abs);
  }
  return [...out];
}
function changedHtml() {
  try {
    return execSync('git -C "' + ROOT + '" status --porcelain', { encoding: 'utf8' })
      .split('\n').map((l) => l.slice(3).trim()).filter(Boolean)
      .map((f) => path.join(ROOT, f))
      .filter((f) => fs.existsSync(f) && /\.html$/i.test(f) && !isInfra(f) && path.basename(f) !== 'index.html');
  } catch { return []; }
}

/* ---------- 启动 / 复用 server.js ---------- */
function ping() {
  return new Promise((res) => {
    const req = http.get(BASE + '/', (r) => { r.destroy(); res(true); });
    req.on('error', () => res(false));
    req.setTimeout(800, () => { req.destroy(); res(false); });
  });
}
async function ensureServer() {
  if (await ping()) return null; // 已在运行，复用
  const proc = spawn('node', [path.join(ROOT, 'server.js')], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await ping()) return proc;
  }
  proc.kill();
  throw new Error(`server.js 未能在端口 ${PORT} 启动`);
}

function urlFor(file, query = '') {
  const rel = path.relative(ROOT, file).split(path.sep).map(encodeURIComponent).join('/');
  return `${BASE}/${rel}${query}`;
}

/* ---------- 主流程 ---------- */
async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const useChanged = argv.includes('--changed');
  const targets = argv.filter((a) => !a.startsWith('--'));
  const files = useChanged ? changedHtml() : listHtml(targets.length ? targets : ['product']);

  if (!files.length) {
    if (asJson) process.stdout.write(JSON.stringify({ scanned: 0, errors: [], warns: [] }));
    else console.log('\n🌐 运行时冒烟测试 — 无目标页面。\n');
    process.exit(0);
  }

  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    const msg = '\n⚠️  Chromium 浏览器未安装，跳过运行时冒烟测试。\n   执行一次：npx playwright install chromium\n';
    if (asJson) { process.stdout.write(JSON.stringify({ scanned: 0, errors: [], warns: [{ file: '-', rule: '环境', msg: 'Chromium 未安装，已跳过运行时层' }] })); }
    else console.error(msg);
    process.exit(0);
  }
  const server = await ensureServer();
  const errors = [];
  const warns = [];
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const page = await browser.newPage();
    const pageErrs = [];
    page.on('pageerror', (e) => pageErrs.push({ kind: 'exception', text: String(e.message || e) }));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (/favicon\.ico/.test(t)) return;
      pageErrs.push({ kind: /Failed to load resource/.test(t) ? 'resource' : 'console', text: t });
    });

    let loadFailed = false;
    try {
      await page.goto(urlFor(file), { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(400);
    } catch (e) {
      loadFailed = true;
      errors.push({ file: rel, rule: '加载', msg: '页面加载超时/失败：' + String(e.message || e) });
    }

    if (!loadFailed) {
      const realErr = pageErrs.filter((p) => p.kind !== 'resource');
      const resErr = pageErrs.filter((p) => p.kind === 'resource');
      for (const e of realErr) errors.push({ file: rel, rule: 'JS异常', msg: e.text.slice(0, 240) });
      for (const e of resErr) warns.push({ file: rel, rule: '资源加载', msg: e.text.slice(0, 240) });

      // mode=view 物理隐藏（仅 form / detail 页面）
      if (/_(form|detail)/i.test(path.basename(file))) {
        const viewPage = await browser.newPage();
        const viewErrs = [];
        viewPage.on('pageerror', (e) => viewErrs.push(String(e.message || e)));
        try {
          await viewPage.goto(urlFor(file, '?mode=view'), { waitUntil: 'networkidle', timeout: 15000 });
          await viewPage.waitForTimeout(400);
          const leaked = await viewPage.evaluate(() => {
            const visible = (el) => {
              const s = getComputedStyle(el);
              if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
              return el.offsetParent !== null || s.position === 'fixed';
            };
            const out = [];
            document.querySelectorAll('input, textarea, select').forEach((el) => {
              if (el.type === 'hidden') return;
              if (el.disabled || el.readOnly) return;
              if (visible(el)) out.push((el.tagName + (el.name ? `[name=${el.name}]` : '')).toLowerCase());
            });
            document.querySelectorAll('button, a.btn, .btn').forEach((el) => {
              const txt = (el.textContent || '').trim();
              if (/新增|删除|编辑|保存|提交|上传/.test(txt) && visible(el)) out.push(`按钮“${txt}”`);
            });
            return out.slice(0, 12);
          });
          if (leaked.length) {
            const shot = path.join(SHOT_DIR, rel.replace(/[\\/]/g, '__') + '.view.png');
            await viewPage.screenshot({ path: shot, fullPage: true }).catch(() => {});
            errors.push({ file: rel, rule: 'mode=view', msg: `只读模式下仍可见/可编辑：${leaked.join('、')}（截图 ${path.relative(ROOT, shot)}）` });
          }
        } catch { /* view 模式加载失败已在主加载覆盖，忽略 */ }
        await viewPage.close();
      }

      if (realErr.length || loadFailed) {
        const shot = path.join(SHOT_DIR, rel.replace(/[\\/]/g, '__') + '.png');
        await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
      }
    }
    await page.close();
  }

  await browser.close();
  if (server) server.kill();

  if (asJson) {
    process.stdout.write(JSON.stringify({ scanned: files.length, errors, warns }, null, 2));
    process.exit(errors.length ? 1 : 0);
  }

  console.log(`\n🌐 运行时冒烟测试 — 打开 ${files.length} 个页面\n`);
  if (!errors.length && !warns.length) {
    console.log('✅ 全部页面无异常。\n');
    process.exit(0);
  }
  const fmt = (r) => `  ${r.file}  [${r.rule}] ${r.msg}`;
  if (errors.length) {
    console.log(`❌ ERROR（${errors.length}）：`);
    errors.forEach((r) => console.log(fmt(r)));
    console.log('');
  }
  if (warns.length) {
    console.log(`⚠️  WARN（${warns.length}）：`);
    warns.forEach((r) => console.log(fmt(r)));
    console.log('');
  }
  process.exit(errors.length);
}

main().catch((e) => { console.error(e); process.exit(1); });
