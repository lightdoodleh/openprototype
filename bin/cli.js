#!/usr/bin/env node
'use strict';

/**
 * prototype-agent CLI
 *
 *   prototype-agent create <dir>          从零创建一个新项目（场景①）
 *   prototype-agent init                  把框架植入当前已有项目（场景②，非破坏式）
 *   prototype-agent add-product <id>      新增一个产品壳（默认 pc）
 *   prototype-agent serve                 启动本地服务器
 *   prototype-agent check [--changed]     跑自动化检查
 *   prototype-agent nav:sync              重建各产品 nav-tree.json
 *   prototype-agent doctor                体检：Node / OpenCode / 配置 / Playwright
 *   prototype-agent update                提示如何更新框架（运行时随 npm，可编辑资产按需覆盖）
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { detectOpenCodeBin, CONFIG_FILENAME, DEFAULTS } = require('../lib/config');

const PKG_ROOT = path.resolve(__dirname, '..');
const TPL = path.join(PKG_ROOT, 'templates');

// ── 小工具 ──────────────────────────────────────────────
const C = {
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  b: (s) => `\x1b[36m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`
};

function die(msg) { console.error(C.r('✗ ') + msg); process.exit(1); }
function info(msg) { console.log(msg); }
function ok(msg) { console.log(C.g('✓ ') + msg); }

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function copyIfAbsent(src, dst) {
  if (fs.existsSync(dst)) { info(C.dim('  跳过（已存在）: ') + path.relative(process.cwd(), dst)); return false; }
  if (fs.statSync(src).isDirectory()) copyDir(src, dst);
  else { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); }
  ok('写入 ' + path.relative(process.cwd(), dst));
  return true;
}

function writeFileSafe(dst, content) {
  if (fs.existsSync(dst)) { info(C.dim('  跳过（已存在）: ') + path.relative(process.cwd(), dst)); return false; }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, content);
  ok('写入 ' + path.relative(process.cwd(), dst));
  return true;
}

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function scaffoldProductShell(projectRoot, productId, productTitle) {
  const shellTpl = fs.readFileSync(path.join(TPL, 'product-shell', 'index.html'), 'utf8');
  const shell = shellTpl.replace(/\{\{PRODUCT_ID\}\}/g, productId).replace(/\{\{PRODUCT_TITLE\}\}/g, productTitle);
  const dir = path.join(projectRoot, 'product', productId, 'pc');
  writeFileSafe(path.join(dir, 'index.html'), shell);
  writeFileSafe(path.join(dir, 'nav-tree.json'), '[]\n');
}

function loadOrInitConfig(projectRoot) {
  const p = path.join(projectRoot, CONFIG_FILENAME);
  return fs.existsSync(p) ? readJson(p, JSON.parse(JSON.stringify(DEFAULTS))) : JSON.parse(JSON.stringify(DEFAULTS));
}

function saveConfig(projectRoot, config) {
  fs.writeFileSync(path.join(projectRoot, CONFIG_FILENAME), JSON.stringify(config, null, 2) + '\n');
}

// ── 命令：create ────────────────────────────────────────
function cmdCreate(argv) {
  const dir = argv[0];
  if (!dir) die('用法：prototype-agent create <目录名>');
  const root = path.resolve(process.cwd(), dir);
  if (fs.existsSync(root) && fs.readdirSync(root).length) die(`目录 ${dir} 已存在且非空`);
  fs.mkdirSync(root, { recursive: true });

  info(C.b(`\n在 ${dir}/ 创建新项目…\n`));

  // 可编辑资产（用户拥有、可定制）
  copyDir(path.join(TPL, 'docs', 'rules'), path.join(root, 'rules'));
  copyDir(path.join(TPL, 'docs', 'prompts'), path.join(root, 'prompts'));
  copyDir(path.join(TPL, 'docs', 'workflow'), path.join(root, 'workflow'));
  copyDir(path.join(TPL, 'docs', 'skills'), path.join(root, 'skills'));
  ok('写入 rules/ prompts/ workflow/ skills/');

  fs.copyFileSync(path.join(TPL, 'AGENTS.md'), path.join(root, 'AGENTS.md'));
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# Claude Code Context\n\n@AGENTS.md\n');
  fs.copyFileSync(path.join(TPL, 'gitignore'), path.join(root, '.gitignore'));
  ok('写入 AGENTS.md / CLAUDE.md / .gitignore');

  saveConfig(root, JSON.parse(JSON.stringify(DEFAULTS)));
  ok('写入 ' + CONFIG_FILENAME);

  const pkg = {
    name: dir.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    private: true,
    version: '0.1.0',
    scripts: {
      serve: 'prototype-agent serve',
      check: 'prototype-agent check',
      'check:changed': 'prototype-agent check --changed',
      'nav:sync': 'prototype-agent nav:sync'
    },
    dependencies: { 'prototype-agent-kit': `^${readJson(path.join(PKG_ROOT, 'package.json'), {}).version || '0.1.0'}` }
  };
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  ok('写入 package.json');

  // 直接带上可运行的 demo 产品（含示例列表/表单页 + PRD + 数据），首跑即有内容
  copyDir(path.join(PKG_ROOT, 'product', 'demo'), path.join(root, 'product', 'demo'));
  ok('写入 product/demo/（示例列表 + 表单 + PRD）');

  info(C.g('\n✔ 项目已创建。下一步：\n'));
  info(`  cd ${dir}`);
  info('  npm install');
  info('  npm run serve      ' + C.dim('# 打开 http://localhost:8082/product/demo/pc/index.html'));
  info('\n  ' + C.dim('（右侧 AI 面板需要本机安装 OpenCode，运行 npx prototype-agent doctor 检查）\n'));
}

// ── 命令：init（植入已有项目） ──────────────────────────
function cmdInit() {
  const root = process.cwd();
  info(C.b('\n把 prototype-agent-kit 植入当前项目（非破坏式）…\n'));

  copyIfAbsent(path.join(TPL, 'docs', 'rules'), path.join(root, 'rules'));
  copyIfAbsent(path.join(TPL, 'docs', 'prompts'), path.join(root, 'prompts'));
  copyIfAbsent(path.join(TPL, 'docs', 'workflow'), path.join(root, 'workflow'));
  copyIfAbsent(path.join(TPL, 'docs', 'skills'), path.join(root, 'skills'));
  copyIfAbsent(path.join(TPL, 'AGENTS.md'), path.join(root, 'AGENTS.md'));
  if (!fs.existsSync(path.join(root, CONFIG_FILENAME))) {
    saveConfig(root, JSON.parse(JSON.stringify(DEFAULTS)));
    ok('写入 ' + CONFIG_FILENAME);
  } else info(C.dim('  跳过（已存在）: ') + CONFIG_FILENAME);

  // 合并 package.json 脚本（不覆盖用户已有脚本）
  const pkgPath = path.join(root, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = readJson(pkgPath, {});
    pkg.scripts = pkg.scripts || {};
    const want = {
      serve: 'prototype-agent serve',
      check: 'prototype-agent check',
      'check:changed': 'prototype-agent check --changed',
      'nav:sync': 'prototype-agent nav:sync'
    };
    let added = 0;
    for (const [k, v] of Object.entries(want)) {
      if (!pkg.scripts[k]) { pkg.scripts[k] = v; added++; }
      else info(C.dim(`  保留你已有的 scripts.${k}`));
    }
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    ok(`package.json 脚本已合并（新增 ${added} 条）`);
  } else {
    info(C.y('  未发现 package.json，跳过脚本合并（可手动 npm init）'));
  }

  info(C.g('\n✔ 已植入。运行 `npx prototype-agent add-product <id>` 建第一个产品壳。\n'));
}

// ── 命令：add-product ───────────────────────────────────
function cmdAddProduct(argv) {
  const id = (argv[0] || '').trim();
  if (!id || !/^[a-z0-9-]+$/.test(id)) die('用法：prototype-agent add-product <id>（id 只能小写字母/数字/连字符）');
  const surface = argv.includes('--h5') ? 'h5' : 'pc';
  if (surface === 'h5') die('H5 端暂未支持，敬请期待（当前仅 PC）。');
  const title = (argv.find((a, i) => a === '--title' && argv[i + 1]) ? argv[argv.indexOf('--title') + 1] : id);

  const root = process.cwd();
  scaffoldProductShell(root, id, title);

  const config = loadOrInitConfig(root);
  config.products = config.products || [];
  if (!config.products.some((p) => p.id === id)) {
    config.products.push({ id, roots: ['pc'] });
    saveConfig(root, config);
    ok(`已在 ${CONFIG_FILENAME} 注册产品 ${id}`);
  } else info(C.dim(`  产品 ${id} 已在配置中`));

  info(C.g(`\n✔ 产品 ${id} 已创建：product/${id}/pc/index.html\n`));
  info('  把原型页面放进该目录后运行 `npm run nav:sync` 刷新导航树。\n');
}

// ── 命令：serve / check / nav:sync（转发到脚本） ─────────
function runNode(scriptRel, extraArgs) {
  const r = spawnSync(process.execPath, [path.join(PKG_ROOT, scriptRel), ...extraArgs], { stdio: 'inherit' });
  process.exit(r.status || 0);
}

// ── 命令：doctor ────────────────────────────────────────
function cmdDoctor() {
  info(C.b('\nprototype-agent 体检\n'));
  let warn = 0;

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor >= 16) ok(`Node ${process.versions.node}`);
  else { console.log(C.r('✗ ') + `Node ${process.versions.node}（需要 >= 16）`); warn++; }

  const bin = detectOpenCodeBin('auto');
  if (bin) ok(`OpenCode 已找到：${bin}`);
  else {
    console.log(C.y('! ') + '未找到 opencode 可执行文件（右侧 AI 面板需要它）。');
    info(C.dim('    安装：见 https://opencode.ai —— 装好后 `which opencode`（Windows：`where opencode`），'));
    info(C.dim('    如不在 PATH，可在 proto-kit.config.json 的 opencode.bin 写绝对路径。'));
    warn++;
  }

  const cfg = path.join(process.cwd(), CONFIG_FILENAME);
  if (fs.existsSync(cfg)) ok(`找到配置：${CONFIG_FILENAME}`);
  else { console.log(C.y('! ') + `当前目录没有 ${CONFIG_FILENAME}（运行 create 或 init 生成）`); warn++; }

  try { require.resolve('playwright'); ok('Playwright 已安装（冒烟测试可用）'); }
  catch { console.log(C.y('! ') + 'Playwright 未安装（`npm i -D playwright && npx playwright install chromium` 后可跑冒烟测试）'); warn++; }

  info(warn ? C.y(`\n完成，${warn} 项需要注意。\n`) : C.g('\n全部正常。\n'));
}

// ── 命令：update ────────────────────────────────────────
function cmdUpdate() {
  info(C.b('\n更新 prototype-agent-kit\n'));
  info('运行时（服务器 / shared 引擎 / Agent 面板 / 检查脚本）随包升级：');
  info(C.g('  npm update prototype-agent-kit\n'));
  info('可编辑资产（rules / prompts / workflow / AGENTS.md）由你拥有，不会被自动覆盖。');
  info('想同步最新模板时，对比这些目录后按需合并：');
  info(C.dim('  node_modules/prototype-agent-kit/templates/docs/  →  你项目里的 rules/ prompts/ workflow/'));
  info(C.dim('  （建议先 git commit，再用 diff 工具挑选要更新的内容，保护你的本地改动）\n'));
}

// ── 入口 ────────────────────────────────────────────────
function help() {
  info(`
${C.b('prototype-agent')} — 本地原型工作台脚手架

用法：
  ${C.g('prototype-agent create <dir>')}       从零创建新项目
  ${C.g('prototype-agent init')}               把框架植入当前已有项目（非破坏式）
  ${C.g('prototype-agent add-product <id>')}   新增一个产品壳（默认 pc）
  ${C.g('prototype-agent serve')}              启动本地服务器
  ${C.g('prototype-agent check [--changed]')}  自动化检查（静态红线 + 冒烟）
  ${C.g('prototype-agent nav:sync')}           重建各产品 nav-tree.json
  ${C.g('prototype-agent doctor')}             体检（Node / OpenCode / 配置 / Playwright）
  ${C.g('prototype-agent update')}             如何更新框架
`);
}

function main() {
  const [cmd, ...argv] = process.argv.slice(2);
  switch (cmd) {
    case 'create': return cmdCreate(argv);
    case 'init': return cmdInit();
    case 'add-product': return cmdAddProduct(argv);
    case 'serve': return runNode('runtime/server.js', []);
    case 'check': return runNode('scripts/check/run-checks.js', argv);
    case 'nav:sync':
    case 'nav-sync': return runNode('scripts/check/sync-nav-tree.js', argv);
    case 'doctor': return cmdDoctor();
    case 'update': return cmdUpdate();
    case undefined:
    case '-h':
    case '--help':
    case 'help': return help();
    default: die(`未知命令：${cmd}\n运行 prototype-agent --help 查看用法`);
  }
}

main();
