#!/usr/bin/env node
'use strict';

/**
 * openprototype CLI
 *
 *   openprototype create <dir>          从零创建一个新项目（场景①）
 *   openprototype init                  把框架植入当前已有项目（场景②，非破坏式）
 *   openprototype add-product <id>      新增一个产品壳（默认 pc）
 *   openprototype serve                 启动本地服务器
 *   openprototype service <action>      管理本地常驻服务
 *   openprototype check [--changed]     跑自动化检查
 *   openprototype nav:sync              重建各产品 nav-tree.json
 *   openprototype doctor                体检：Node / OpenCode / 配置 / Playwright
 *   openprototype update                提示如何更新框架（运行时随 npm，可编辑资产按需覆盖）
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { detectOpenCodeBin, CONFIG_FILENAME, DEFAULTS } = require('../lib/config');
const {
  installService,
  startService,
  stopService,
  uninstallService,
  pruneServices,
  serviceStatus,
  readLog,
  isSupportedPlatform
} = require('../lib/service-manager');

const PKG_ROOT = path.resolve(__dirname, '..');
const TPL = path.join(PKG_ROOT, 'templates');

const RULES_README = `# rules/ — 你团队自己的规范

这个目录留给你放**自己**的产品规范，框架不预置、也不会覆盖它们：

- \`*-page-prd-template.md\` — 你的列表/表单/详情/审批 PRD 模板
- UI 组件规范、业务逻辑规范、术语约定……

放进来后，在项目根的 \`AGENTS.md\` 第三节登记，AI 就会先读再做。

> 页面的硬性红线（脚本顺序、BaseDataManager、状态常量化、字体栈、mode=view 物理隐藏）
> 由框架的 \`CONVENTIONS.md\` + \`openprototype check\` 管，不需要你重写。
`;

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

/** 新项目 package.json 里本框架的依赖版本（已发布 npm，语义化版本管理） */
function kitDependencySpec() {
  const pkg = readJson(path.join(PKG_ROOT, 'package.json'), {});
  return `^${pkg.version || '0.1.0'}`;
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
  if (!dir) die('用法：openprototype create <目录名>');
  const root = path.resolve(process.cwd(), dir);
  if (fs.existsSync(root) && fs.readdirSync(root).length) die(`目录 ${dir} 已存在且非空`);
  fs.mkdirSync(root, { recursive: true });

  info(C.b(`\n在 ${dir}/ 创建新项目…\n`));

  // 可编辑资产（用户拥有、可定制）：只带最小通用层
  copyDir(path.join(TPL, 'skills'), path.join(root, 'skills'));
  fs.copyFileSync(path.join(TPL, 'AGENTS.md'), path.join(root, 'AGENTS.md'));
  fs.copyFileSync(path.join(TPL, 'CONVENTIONS.md'), path.join(root, 'CONVENTIONS.md'));
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# Claude Code Context\n\n@AGENTS.md\n');
  fs.copyFileSync(path.join(TPL, 'gitignore'), path.join(root, '.gitignore'));
  // 留一个空 rules/ 让你放自己团队的 PRD 模板 / UI 规范
  fs.mkdirSync(path.join(root, 'rules'), { recursive: true });
  fs.writeFileSync(path.join(root, 'rules', 'README.md'), RULES_README);
  ok('写入 AGENTS.md / CONVENTIONS.md / CLAUDE.md / skills/ / rules/（空）');

  saveConfig(root, JSON.parse(JSON.stringify(DEFAULTS)));
  ok('写入 ' + CONFIG_FILENAME);

  const pkg = {
    name: dir.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    private: true,
    version: '0.1.0',
    scripts: {
      serve: 'openprototype serve',
      check: 'openprototype check',
      'check:changed': 'openprototype check --changed',
      'nav:sync': 'openprototype nav:sync'
    },
    allowScripts: { openprototype: true },
    dependencies: { 'openprototype': kitDependencySpec() }
  };
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  ok('写入 package.json');

  // 直接带上可运行的 demo 产品（含示例列表/表单页 + PRD + 数据），首跑即有内容
  copyDir(path.join(PKG_ROOT, 'product', 'demo'), path.join(root, 'product', 'demo'));
  ok('写入 product/demo/（示例列表 + 表单 + PRD）');

  info(C.g('\n✔ 项目已创建。下一步：\n'));
  info(`  cd ${dir}`);
  info('  npm install');
  info('  ' + C.dim('# npm 安装后会自动启动常驻服务'));
  info('  浏览器打开 http://127.0.0.1:8082/product/demo/pc/index.html');
  info('\n  ' + C.dim('（右侧 AI 面板需要本机安装 OpenCode，npm install 后运行 npx openprototype doctor 检查）\n'));
}

// ── 命令：init（植入已有项目） ──────────────────────────
async function cmdInit() {
  const root = process.cwd();
  let serviceInstallDenied = false;
  info(C.b('\n把 openprototype 植入当前项目（非破坏式）…\n'));

  copyIfAbsent(path.join(TPL, 'skills'), path.join(root, 'skills'));
  copyIfAbsent(path.join(TPL, 'AGENTS.md'), path.join(root, 'AGENTS.md'));
  copyIfAbsent(path.join(TPL, 'CONVENTIONS.md'), path.join(root, 'CONVENTIONS.md'));
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
      serve: 'openprototype serve',
      check: 'openprototype check',
      'check:changed': 'openprototype check --changed',
      'nav:sync': 'openprototype nav:sync'
    };
    let added = 0;
    let allowedInstallScript = false;
    for (const [k, v] of Object.entries(want)) {
      if (!pkg.scripts[k]) { pkg.scripts[k] = v; added++; }
      else info(C.dim(`  保留你已有的 scripts.${k}`));
    }
    if (pkg.allowScripts === undefined) pkg.allowScripts = {};
    if (pkg.allowScripts && typeof pkg.allowScripts === 'object' && pkg.allowScripts.openprototype === false) {
      serviceInstallDenied = true;
    }
    if (pkg.allowScripts && typeof pkg.allowScripts === 'object' && pkg.allowScripts.openprototype === undefined) {
      pkg.allowScripts.openprototype = true;
      allowedInstallScript = true;
    }
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    ok(`package.json 脚本已合并（新增 ${added} 条）`);
    if (allowedInstallScript) ok('已允许 openprototype 运行 npm 安装钩子');
  } else {
    info(C.y('  未发现 package.json，跳过脚本合并（可手动 npm init）'));
  }

  const envServicePolicy = String(process.env.OPENPROTOTYPE_SERVICE_AUTO_INSTALL || '').toLowerCase();
  const envServiceDisabled = ['0', 'false', 'off'].includes(envServicePolicy);
  if (isSupportedPlatform() && !serviceInstallDenied && !envServiceDisabled) {
    const config = loadOrInitConfig(root);
    if (!config.service || config.service.autoInstall !== false) {
      try {
        const result = await installService({ projectRoot: root, explicit: false });
        if (!result.skipped) ok(`常驻服务已启动：http://127.0.0.1:${config.port}`);
      } catch (err) {
        info(C.y(`! 常驻服务未能自动启动：${err.message}`));
        info(C.dim('  可稍后运行 `npx openprototype service install` 重试。'));
      }
    } else {
      info(C.dim('  已按 service.autoInstall=false 跳过常驻服务。'));
    }
  } else if (serviceInstallDenied || envServiceDisabled) {
    info(C.dim('  已按安装脚本策略跳过常驻服务。'));
  }

  info(C.g('\n✔ 已植入。运行 `npx openprototype add-product <id>` 建第一个产品壳。\n'));
}

// ── 命令：add-product ───────────────────────────────────
function cmdAddProduct(argv) {
  const id = (argv[0] || '').trim();
  if (!id || !/^[a-z0-9-]+$/.test(id)) die('用法：openprototype add-product <id>（id 只能小写字母/数字/连字符）');
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

function printServiceStatus(status) {
  const labels = {
    running: C.g('运行中'),
    stopped: C.y('已注册，当前停止'),
    'port-conflict': C.r('端口被其他进程占用'),
    stale: C.y('注册已失效'),
    unregistered: C.dim('未安装')
  };
  info(`状态: ${labels[status.state] || status.state}`);
  info(`项目: ${status.projectRoot}`);
  info(`服务 ID: ${status.serviceId}`);
  info(`地址: http://127.0.0.1:${status.port}`);
  if (status.pid) info(`PID: ${status.pid}`);
  if (status.version) info(`版本: ${status.version}`);
  if (status.startedAt) info(`启动时间: ${status.startedAt}`);
  if (status.configDrift || status.versionDrift || status.nodeDrift) {
    info(C.y('配置、包版本或 Node 路径已变化，请运行 openprototype service restart'));
  }
  info(`日志: ${status.logPath}`);
}

async function cmdService(argv) {
  const action = argv[0] || 'status';
  const json = argv.includes('--json');
  try {
    if (action === 'install' || action === 'restart') {
      const result = await installService({
        projectRoot: process.cwd(),
        allowLan: argv.includes('--allow-lan'),
        explicit: true
      });
      const status = await serviceStatus(process.cwd());
      if (json) info(JSON.stringify(status, null, 2));
      else { ok(action === 'restart' ? '常驻服务已重启' : '常驻服务已安装并启动'); printServiceStatus(status); }
      return result;
    }
    if (action === 'start') {
      const status = await startService(process.cwd());
      if (json) info(JSON.stringify(status, null, 2));
      else { ok('常驻服务已启动'); printServiceStatus(status); }
      return;
    }
    if (action === 'stop') {
      const result = stopService(process.cwd());
      if (json) info(JSON.stringify(result, null, 2));
      else ok('常驻服务已停止；下次登录仍会自动启动，永久取消请运行 service uninstall');
      return;
    }
    if (action === 'uninstall') {
      const result = uninstallService(process.cwd());
      if (json) info(JSON.stringify(result, null, 2));
      else { ok('常驻服务注册已删除'); info(C.dim(`日志保留在 ${result.logPath}`)); }
      return;
    }
    if (action === 'prune') {
      const removed = pruneServices();
      if (json) info(JSON.stringify({ removed }, null, 2));
      else if (removed.length) ok(`已清理 ${removed.length} 个失效服务注册`);
      else info(C.dim('没有需要清理的失效服务。'));
      return;
    }
    if (action === 'logs') {
      const log = readLog(process.cwd(), 100);
      if (json) info(JSON.stringify(log, null, 2));
      else { info(C.dim(`日志：${log.path}\n`)); info(log.content || C.dim('暂无日志。')); }
      return;
    }
    if (action === 'status') {
      const status = await serviceStatus(process.cwd());
      if (json) info(JSON.stringify(status, null, 2));
      else printServiceStatus(status);
      return;
    }
    die('用法：openprototype service <install|start|stop|restart|status|logs|uninstall|prune>');
  } catch (err) {
    die(err.message);
  }
}

// ── 命令：doctor ────────────────────────────────────────
async function cmdDoctor() {
  info(C.b('\nopenprototype 体检\n'));
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

  if (isSupportedPlatform() && fs.existsSync(cfg)) {
    try {
      const status = await serviceStatus(process.cwd());
      if (status.running && !status.configDrift && !status.versionDrift && !status.nodeDrift) {
        ok(`常驻服务运行中（PID ${status.pid}，端口 ${status.port}）`);
      } else if (status.running) {
        console.log(C.y('! ') + '常驻服务正在运行，但配置、包版本或 Node 路径已变化');
        info(C.dim('    应用更新：npx openprototype service restart'));
        warn++;
      }
      else {
        console.log(C.y('! ') + `常驻服务状态：${status.state}`);
        info(C.dim('    修复：npx openprototype service install'));
        warn++;
      }
    } catch (err) {
      console.log(C.y('! ') + `常驻服务检查失败：${err.message}`);
      warn++;
    }
  } else if (!isSupportedPlatform()) {
    info(C.dim('  常驻服务：当前平台不支持（仅 macOS / Windows）'));
  }

  info(warn ? C.y(`\n完成，${warn} 项需要注意。\n`) : C.g('\n全部正常。\n'));
}

// ── 命令：update ────────────────────────────────────────
function cmdUpdate() {
  info(C.b('\n更新 openprototype\n'));
  info('运行时（服务器 / shared 引擎 / Agent 面板 / 检查脚本）随包升级：');
  info(C.g('  npm update openprototype\n'));
  info('可编辑资产（rules / prompts / workflow / AGENTS.md）由你拥有，不会被自动覆盖。');
  info('想同步最新模板时，对比这些目录后按需合并：');
  info(C.dim('  node_modules/openprototype/templates/  →  你项目里的 AGENTS.md / CONVENTIONS.md / skills/'));
  info(C.dim('  （建议先 git commit，再用 diff 工具挑选要更新的内容，保护你的本地改动）\n'));
}

// ── 入口 ────────────────────────────────────────────────
function help() {
  info(`
${C.b('openprototype')} — 本地原型工作台脚手架

用法：
  ${C.g('openprototype create <dir>')}       从零创建新项目
  ${C.g('openprototype init')}               把框架植入当前已有项目（非破坏式）
  ${C.g('openprototype add-product <id>')}   新增一个产品壳（默认 pc）
  ${C.g('openprototype serve')}              启动本地服务器
  ${C.g('openprototype service <action>')}   管理常驻服务（install/start/stop/restart/status/logs/uninstall/prune）
  ${C.g('openprototype check [--changed]')}  自动化检查（静态红线 + 冒烟）
  ${C.g('openprototype nav:sync')}           重建各产品 nav-tree.json
  ${C.g('openprototype doctor')}             体检（Node / OpenCode / 配置 / Playwright）
  ${C.g('openprototype update')}             如何更新框架
`);
}

async function main() {
  const [cmd, ...argv] = process.argv.slice(2);
  switch (cmd) {
    case 'create': return cmdCreate(argv);
    case 'init': return cmdInit();
    case 'add-product': return cmdAddProduct(argv);
    case 'serve': return runNode('runtime/server.js', argv);
    case 'service': return cmdService(argv);
    case 'check': return runNode('scripts/check/run-checks.js', argv);
    case 'nav:sync':
    case 'nav-sync': return runNode('scripts/check/sync-nav-tree.js', argv);
    case 'doctor': return cmdDoctor();
    case 'update': return cmdUpdate();
    case undefined:
    case '-h':
    case '--help':
    case 'help': return help();
    default: die(`未知命令：${cmd}\n运行 openprototype --help 查看用法`);
  }
}

main().catch((err) => die(err.message));
