#!/usr/bin/env node
/**
 * 扫描每个已注册产品的入口目录，重建同目录的 nav-tree.json。
 *
 * 产品列表来自 proto-kit.config.json（见 lib/config.js）。
 * 导航页与 nav-tree.json 同目录部署，因此树里的 path 均为端目录内相对路径。
 */

const fs = require('fs');
const path = require('path');

const { loadConfig } = require('../../lib/config');
const CONFIG = loadConfig();
const ROOT = CONFIG.rootDir;

// 每个已注册产品入口目录一个同步目标；目录还不存在的先跳过
const TARGETS = CONFIG.productRoots
  .filter((r) => fs.existsSync(r.dir))
  .map((r) => ({
    name: `${r.id}/${r.surface}`,
    dir: r.dir,
    treePath: path.join(r.dir, 'nav-tree.json'),
  }));

function collectRegisteredPaths(nodes, out) {
  nodes.forEach((n) => {
    if (n.file) out.add(n.path);
    else collectRegisteredPaths(n.children || [], out);
  });
  return out;
}

function listDiskPaths(dir) {
  const files = [];
  const dirs = [];
  const walk = (p) => {
    for (const name of fs.readdirSync(p)) {
      if (name.startsWith('.')) continue; // 隐藏目录 / 文件不进导航树
      const full = path.join(p, name);
      if (fs.statSync(full).isDirectory()) {
        dirs.push(path.relative(dir, full).split(path.sep).join('/'));
        walk(full);
      } else if (name.endsWith('.html') && full !== path.join(dir, 'index.html')) {
        files.push(path.relative(dir, full).split(path.sep).join('/'));
      }
    }
  };
  walk(dir);
  return { files: files.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')), dirs };
}

function ensureFolderChildren(tree, folderNames) {
  let level = tree;
  for (const name of folderNames) {
    let node = level.find((n) => n.name === name);
    if (!node) {
      node = { name, children: [] };
      level.push(node);
    }
    level = node.children;
  }
  return level;
}

function compareNodes(a, b) {
  const aIsFolder = !!a.children;
  const bIsFolder = !!b.children;
  if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
  return (a.name || a.file).localeCompare(b.name || b.file, 'zh-Hans-CN');
}

function sortTree(nodes) {
  nodes.sort(compareNodes);
  nodes.forEach((n) => n.children && sortTree(n.children));
  return nodes;
}

function buildTree(paths, dirs) {
  const tree = [];
  // 先登记磁盘上的所有目录（含空目录，保住导航页刚创建、还没放页面的文件夹）
  for (const relDir of dirs || []) ensureFolderChildren(tree, relDir.split('/'));
  for (const relPath of paths) {
    const segments = relPath.split('/');
    const fileName = segments.pop();
    const children = ensureFolderChildren(tree, segments);
    children.push({ file: fileName, path: relPath });
  }
  return sortTree(tree);
}

function syncTarget(target) {
  const previousTree = fs.existsSync(target.treePath)
    ? JSON.parse(fs.readFileSync(target.treePath, 'utf8'))
    : [];
  const previous = collectRegisteredPaths(previousTree, new Set());
  const { files: diskPaths, dirs } = listDiskPaths(target.dir);
  const onDisk = new Set(diskPaths);
  const tree = buildTree(diskPaths, dirs);
  const next = collectRegisteredPaths(tree, new Set());
  const added = [...next].filter((p) => !previous.has(p));
  const removed = [...previous].filter((p) => !onDisk.has(p));

  fs.writeFileSync(target.treePath, JSON.stringify(tree, null, 2) + '\n');

  return { target, scanned: onDisk.size, registered: next.size, added, removed };
}

function main() {
  const reports = TARGETS.map(syncTarget);
  const added = reports.flatMap((report) =>
    report.added.map((p) => `${report.target.name.toLowerCase()}/${p}`)
  );
  const result = {
    scanned: reports.reduce((sum, report) => sum + report.scanned, 0),
    errors: [],
    warns: [],
    added,
  };

  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  console.log('────────────────────────────────────────');
  console.log('  导航树同步（PC / H5 nav-tree.json）');
  console.log('────────────────────────────────────────');
  reports.forEach((report) => {
    console.log(`${report.target.name}: 磁盘页面 ${report.scanned} 个，已登记 ${report.registered} 个`);
    if (report.added.length) {
      console.log(`  新增 ${report.added.length} 个页面：`);
      report.added.forEach((p) => console.log('  + ' + p));
    } else {
      console.log('  没有新增页面。');
    }
    if (report.removed.length) {
      console.log(`  移除 ${report.removed.length} 个已不存在的登记条目：`);
      report.removed.forEach((p) => console.log('  - ' + p));
    }
  });
  console.log('');
}

main();
