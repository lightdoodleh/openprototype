#!/usr/bin/env node
/**
 * 静态规则检查 — 零依赖，扫描页面 HTML / 页面级 JS，命中红线即报错。
 *
 * 用法：
 *   node scripts/check/static-check.js                 # 扫全部产品页面
 *   node scripts/check/static-check.js product/demo/pc   # 扫指定目录/文件
 *   node scripts/check/static-check.js --changed       # 只扫 git 改动的页面
 *   node scripts/check/static-check.js --json          # 输出 JSON（供编排脚本汇总）
 *
 * 退出码 = ERROR 条数（0 表示通过）。WARN 不影响退出码。
 *
 * 对应规范：AGENTS.md §2.3 七条红线 / §2.4 脚本顺序 /
 *           rules/bug-prevention-standards.md
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { loadConfig } = require('../../lib/config');

const ROOT = loadConfig().rootDir;

// 脚本加载顺序铁律（AGENTS.md §2.4），只校验出现的核心文件的相对先后
const SCRIPT_ORDER = [
  'base-manager.js',
  'constants.js',
  'mock-data.js',
  'data.js',
  'common.js',
  'menu.js',
  'prd-content.js',
];

// 页面级 JS / 内联脚本里禁止直接访问的存储 API（必须走 BaseDataManager）
const FORBIDDEN_STORAGE = /\blocalStorage\.(getItem|setItem|removeItem)\s*\(/g;

// 这些目录是基础设施 / 资源 / 模板，不当作"页面"扫描
const NON_PAGE_DIRS = new Set(['shared', 'references', 'templates', 'node_modules', '.git', '.claude']);

const results = []; // { level, file, line, rule, msg }
function add(level, file, line, rule, msg) {
  results.push({ level, file: path.relative(ROOT, file), line, rule, msg });
}

/* ---------- 收集目标文件 ---------- */

function listPageFiles(targets) {
  const files = new Set();
  const walk = (p) => {
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (NON_PAGE_DIRS.has(path.basename(p))) return;
      for (const name of fs.readdirSync(p)) walk(path.join(p, name));
    } else if (/\.(html|js)$/i.test(p) && !isInfraPath(p)) {
      files.add(p);
    }
  };
  for (const t of targets) {
    const abs = path.isAbsolute(t) ? t : path.join(ROOT, t);
    if (fs.existsSync(abs)) walk(abs);
  }
  return [...files];
}

function isInfraPath(p) {
  const rel = path.relative(ROOT, p).split(path.sep);
  return rel.some((seg) => NON_PAGE_DIRS.has(seg));
}

function changedFiles() {
  try {
    // core.quotepath=false：中文等非 ASCII 路径按原样输出（默认会转成 \346… 转义引号串）
    const out = execSync('git -C "' + ROOT + '" -c core.quotepath=false status --porcelain', { encoding: 'utf8' });
    return out
      .split('\n')
      .map(parsePorcelainPath)
      .filter(Boolean)
      .map((f) => path.join(ROOT, f))
      .filter((f) => fs.existsSync(f) && /\.(html|js)$/i.test(f) && !isInfraPath(f));
  } catch {
    return [];
  }
}

/** 解析 `git status --porcelain` 单行：重命名/复制行（`R  old -> new`）取新路径，去掉包裹引号 */
function parsePorcelainPath(line) {
  let p = line.slice(3);
  const arrow = p.indexOf(' -> ');
  if (arrow !== -1) p = p.slice(arrow + 4);
  p = p.trim();
  if (p.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1);
  return p;
}

/* ---------- 读取每个产品的状态文案（用于检测硬编码） ---------- */

const _statusCache = new Map();
function statusLabelsFor(file) {
  // 找到 file 所属的 product/{id}/，读 shared/constants/status.js
  // 返回 { all, workflow }：
  //   all      — STATUS_LABELS + ENABLED_STATUS 全部文案，用于 <option> 硬编码强检测
  //   workflow — 仅 STATUS_LABELS（流转状态），用于 JS 字面量软提示
  //              （启用/禁用/有效/无效 这类开关词太常见，不进 JS 软提示，避免噪音）
  const m = path.relative(ROOT, file).match(/^product[\\/]([^\\/]+)[\\/]/);
  if (!m) return { all: [], workflow: [] };
  const pid = m[1];
  if (_statusCache.has(pid)) return _statusCache.get(pid);
  const statusPath = path.join(ROOT, 'product', pid, 'shared', 'constants', 'status.js');
  const empty = { all: [], workflow: [] };
  if (!fs.existsSync(statusPath)) { _statusCache.set(pid, empty); return empty; }
  const src = fs.readFileSync(statusPath, 'utf8');
  const grab = (name) => {
    const bm = new RegExp(name + '\\s*=\\s*\\{([\\s\\S]*?)\\}').exec(src);
    const out = new Set();
    if (!bm) return out;
    const pairRe = /:\s*'([^']+)'|:\s*"([^"]+)"/g;
    let pm;
    while ((pm = pairRe.exec(bm[1]))) {
      const v = pm[1] || pm[2];
      if (/[一-龥]/.test(v) && v.length >= 2) out.add(v);
    }
    return out;
  };
  const workflow = grab('STATUS_LABELS');
  const enabled = grab('ENABLED_STATUS');
  const res = { all: [...new Set([...workflow, ...enabled])], workflow: [...workflow] };
  _statusCache.set(pid, res);
  return res;
}

/* ---------- 各项检查 ---------- */

function lineOf(src, index) {
  return src.slice(0, index).split('\n').length;
}

function checkHtml(file, src) {
  // 1) Google Fonts 禁用（红线 5：字体系统栈）
  let gf;
  const gfRe = /fonts\.googleapis\.com|fonts\.gstatic\.com/g;
  while ((gf = gfRe.exec(src))) {
    add('ERROR', file, lineOf(src, gf.index), '字体系统栈', '禁止引用 Google Fonts，必须用系统字体栈');
  }

  // 2) 脚本加载顺序（铁律 §2.4）
  const scripts = [];
  const sRe = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let sm;
  while ((sm = sRe.exec(src))) scripts.push({ name: path.basename(sm[1].split('?')[0]), idx: lineOf(src, sm.index) });
  const present = scripts.filter((s) => SCRIPT_ORDER.includes(s.name));
  let lastRank = -1;
  let lastName = '';
  for (const s of present) {
    const rank = SCRIPT_ORDER.indexOf(s.name);
    if (rank < lastRank) {
      add('ERROR', file, s.idx, '脚本顺序', `${s.name} 出现在 ${lastName} 之后，违反加载顺序（应为 ${SCRIPT_ORDER.join(' → ')}）`);
    }
    lastRank = Math.max(lastRank, rank);
    lastName = s.name;
  }

  // 3) 硬编码状态文案到 <option>（红线 3：状态值常量化）
  const labels = statusLabelsFor(file).all;
  if (labels.length) {
    const optRe = /<option\b[^>]*>([^<]+)<\/option>/gi;
    let om;
    while ((om = optRe.exec(src))) {
      const text = om[1].trim();
      if (labels.includes(text)) {
        add('ERROR', file, lineOf(src, om.index), '状态常量化', `<option> 硬编码状态文案“${text}”，状态下拉必须由 SearchRenderer 从 constants 生成`);
      }
    }
  }

  // 4) 页面级 localStorage（红线 2，内联 <script> 里也算）
  scanStorage(file, src);
}

function checkJs(file, src) {
  scanStorage(file, src);

  // 状态文案硬编码到 JS 字符串（WARN，避免误报阻塞）
  const labels = statusLabelsFor(file).workflow;
  for (const label of labels) {
    const re = new RegExp("['\"]" + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "['\"]", 'g');
    let lm;
    while ((lm = re.exec(src))) {
      add('WARN', file, lineOf(src, lm.index), '状态常量化', `JS 中出现状态文案字面量“${label}”，建议改用 STATUS_LABELS[...]`);
    }
  }
}

function scanStorage(file, src) {
  let sm;
  const re = new RegExp(FORBIDDEN_STORAGE.source, 'g');
  while ((sm = re.exec(src))) {
    add('ERROR', file, lineOf(src, sm.index), 'BaseDataManager', `页面禁止直接调用 ${sm[0].replace(/\s*\($/, '')}，数据必须走 BaseDataManager`);
  }
}

/* ---------- 主流程 ---------- */

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const useChanged = argv.includes('--changed');
  const targets = argv.filter((a) => !a.startsWith('--'));

  let files;
  if (useChanged) files = changedFiles();
  else files = listPageFiles(targets.length ? targets : ['product']);

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    if (/\.html$/i.test(file)) checkHtml(file, src);
    else checkJs(file, src);
  }

  const errors = results.filter((r) => r.level === 'ERROR');
  const warns = results.filter((r) => r.level === 'WARN');

  if (asJson) {
    process.stdout.write(JSON.stringify({ scanned: files.length, errors, warns }, null, 2));
    process.exit(errors.length ? 1 : 0);
  }

  console.log(`\n🔍 静态规则检查 — 扫描 ${files.length} 个页面文件\n`);
  if (!results.length) {
    console.log('✅ 全部通过，未发现红线问题。\n');
    process.exit(0);
  }
  const fmt = (r) => `  ${r.file}:${r.line}  [${r.rule}] ${r.msg}`;
  if (errors.length) {
    console.log(`❌ ERROR（${errors.length}，必须修复）：`);
    errors.forEach((r) => console.log(fmt(r)));
    console.log('');
  }
  if (warns.length) {
    console.log(`⚠️  WARN（${warns.length}，建议修复）：`);
    warns.forEach((r) => console.log(fmt(r)));
    console.log('');
  }
  console.log(errors.length ? `结论：${errors.length} 条红线未过。\n` : '结论：无红线错误（仅有建议项）。\n');
  process.exit(errors.length);
}

main();
