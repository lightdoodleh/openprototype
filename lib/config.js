'use strict';

/**
 * 配置加载 + OpenCode 二进制自动探测。
 * 所有"写死的"东西（端口、OpenCode 路径/模型、产品根目录）都在这里集中收口，
 * server.js / scripts 只读这里，不再各自硬编码。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const CONFIG_FILENAME = 'proto-kit.config.json';

const DEFAULTS = {
  port: 8082,
  // 服务器监听地址。默认只绑本机；需要给局域网同事演示时改成 '0.0.0.0'
  // （写入 / Agent 类 /api/* 接口始终只接受本机请求，不随该项放开）。
  host: '127.0.0.1',
  opencode: {
    bin: 'auto',
    model: 'deepseek/deepseek-v4-flash',
    agent: 'build',
    host: '127.0.0.1',
    port: 4097,
    startTimeoutMs: 15000
  },
  // 每个产品一个入口目录；roots 目前只支持 'pc'（'h5' 后续再加）
  products: [{ id: 'demo', roots: ['pc'] }]
};

function deepMerge(base, override) {
  if (!override || typeof override !== 'object') return base;
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  Object.keys(override).forEach((key) => {
    const value = override[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && base && typeof base[key] === 'object') {
      out[key] = deepMerge(base[key], value);
    } else {
      out[key] = value;
    }
  });
  return out;
}

function findProjectRoot(startDir) {
  let dir = path.resolve(startDir || process.cwd());
  while (true) {
    if (fs.existsSync(path.join(dir, CONFIG_FILENAME))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // 没找到配置文件时，退回到起始目录（首次运行 / 未初始化的场景）
  return path.resolve(startDir || process.cwd());
}

function loadRawConfig(rootDir) {
  const file = path.join(rootDir, CONFIG_FILENAME);
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${CONFIG_FILENAME} 解析失败：${err.message}`);
  }
}

/**
 * 跨平台探测 opencode 可执行文件。
 * 顺序：显式路径 → PATH(which/where) → 常见安装位。找不到返回 null（由调用方给安装引导）。
 */
function detectOpenCodeBin(explicit) {
  if (explicit && explicit !== 'auto') {
    return fs.existsSync(explicit) ? explicit : explicit; // 用户写死了就用它，存在与否交给 spawn 报错
  }

  const isWin = process.platform === 'win32';
  const lookup = isWin ? 'where' : 'which';
  try {
    const result = spawnSync(lookup, ['opencode'], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout) {
      const first = result.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
      if (first && fs.existsSync(first)) return first;
    }
  } catch (err) {
    // ignore，继续查常见位置
  }

  const home = os.homedir();
  const candidates = isWin
    ? [
        path.join(process.env.APPDATA || '', 'npm', 'opencode.cmd'),
        path.join(home, 'AppData', 'Local', 'opencode', 'opencode.exe'),
        path.join(home, '.opencode', 'bin', 'opencode.exe')
      ]
    : [
        '/opt/homebrew/bin/opencode',
        '/usr/local/bin/opencode',
        path.join(home, '.opencode', 'bin', 'opencode'),
        path.join(home, '.local', 'bin', 'opencode')
      ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * 返回归一化后的运行时配置。
 * @param {string} [startDir] 从哪个目录起找配置（默认 cwd）
 */
function loadConfig(startDir) {
  const rootDir = findProjectRoot(startDir);
  const raw = loadRawConfig(rootDir);

  const merged = deepMerge(DEFAULTS, raw);

  // 环境变量优先级最高（方便 CI / 临时覆盖）
  if (process.env.PROTO_KIT_PORT) merged.port = Number(process.env.PROTO_KIT_PORT);
  if (process.env.PROTO_KIT_HOST) merged.host = process.env.PROTO_KIT_HOST;
  if (process.env.OPENCODE_BIN) merged.opencode.bin = process.env.OPENCODE_BIN;
  if (process.env.OPENCODE_MODEL) merged.opencode.model = process.env.OPENCODE_MODEL;
  if (process.env.OPENCODE_PORT) merged.opencode.port = Number(process.env.OPENCODE_PORT);

  const resolvedBin = detectOpenCodeBin(merged.opencode.bin);

  // 每个产品入口目录的绝对路径，供 Agent 写入白名单 & 静态服务使用
  const productRoots = [];
  (merged.products || []).forEach((product) => {
    (product.roots || ['pc']).forEach((root) => {
      productRoots.push({
        id: product.id,
        surface: root,
        dir: path.resolve(rootDir, 'product', product.id, root)
      });
    });
  });

  return {
    rootDir,
    configFile: path.join(rootDir, CONFIG_FILENAME),
    hasConfigFile: fs.existsSync(path.join(rootDir, CONFIG_FILENAME)),
    port: merged.port,
    host: merged.host,
    opencode: {
      bin: resolvedBin,               // null 表示没找到
      binConfigured: merged.opencode.bin,
      model: merged.opencode.model,
      agent: merged.opencode.agent,
      host: merged.opencode.host,
      port: merged.opencode.port,
      baseUrl: `http://${merged.opencode.host}:${merged.opencode.port}`,
      startTimeoutMs: merged.opencode.startTimeoutMs
    },
    products: merged.products || [],
    productRoots
  };
}

module.exports = { loadConfig, detectOpenCodeBin, findProjectRoot, DEFAULTS, CONFIG_FILENAME };
