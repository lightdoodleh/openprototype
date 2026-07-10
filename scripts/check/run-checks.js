#!/usr/bin/env node
/**
 * 编排入口 — 先跑静态规则检查，再跑运行时冒烟测试，汇总成一份报告。
 *
 * 用法：
 *   node scripts/check/run-checks.js                 # 全量
 *   node scripts/check/run-checks.js --changed       # 只查 git 改动（AI 生成后默认用这个）
 *   node scripts/check/run-checks.js product/demo/pc   # 指定范围
 *   node scripts/check/run-checks.js --static-only   # 跳过浏览器层
 */

const { execFileSync } = require('child_process');
const path = require('path');

const DIR = __dirname;
const passthrough = process.argv.slice(2).filter((a) => a !== '--static-only');
const staticOnly = process.argv.includes('--static-only');

function run(script) {
  try {
    const out = execFileSync('node', [path.join(DIR, script), '--json', ...passthrough], { encoding: 'utf8' });
    return JSON.parse(out);
  } catch (e) {
    // 脚本以非零退出码结束时，stdout 仍是 JSON
    try { return JSON.parse(e.stdout); } catch { return { scanned: 0, errors: [{ file: script, rule: '运行', msg: String(e.message).slice(0, 200) }], warns: [] }; }
  }
}

const nav = run('sync-nav-tree.js');
const stat = run('static-check.js');
const smoke = staticOnly ? { scanned: 0, errors: [], warns: [] } : run('smoke-test.js');

const allErr = [...stat.errors, ...smoke.errors];
const allWarn = [...nav.warns, ...stat.warns, ...smoke.warns];
if (nav.added && nav.added.length) {
  console.log(`📌 导航树已自动同步新增页面（${nav.added.length} 个）：${nav.added.join('、')}`);
}

console.log('\n════════════════════════════════════════');
console.log('  原型自动化检查报告');
console.log('════════════════════════════════════════');
console.log(`静态规则：扫描 ${stat.scanned} 文件，${stat.errors.length} ERROR / ${stat.warns.length} WARN`);
console.log(`运行时  ：打开 ${smoke.scanned} 页面，${smoke.errors.length} ERROR / ${smoke.warns.length} WARN`);
console.log('────────────────────────────────────────');

const fmt = (r) => `  ${r.file}${r.line ? ':' + r.line : ''}  [${r.rule}] ${r.msg}`;
if (allErr.length) {
  console.log(`\n❌ 必须修复（${allErr.length}）：`);
  allErr.forEach((r) => console.log(fmt(r)));
}
if (allWarn.length) {
  console.log(`\n⚠️  建议修复（${allWarn.length}）：`);
  allWarn.forEach((r) => console.log(fmt(r)));
}
if (!allErr.length && !allWarn.length) console.log('\n✅ 全部通过。');
console.log('');

process.exit(allErr.length ? 1 : 0);
