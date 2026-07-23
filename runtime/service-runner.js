#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');
const { spawn } = require('child_process');

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : '';
}

const manifestPath = argValue('--manifest');
if (!manifestPath) process.exit(1);

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch {
  process.exit(1);
}

fs.mkdirSync(path.dirname(manifest.logPath), { recursive: true });
try {
  const stat = fs.statSync(manifest.logPath);
  if (stat.size > 5 * 1024 * 1024) {
    const previous = manifest.logPath + '.1';
    try { fs.unlinkSync(previous); } catch {}
    fs.renameSync(manifest.logPath, previous);
  }
} catch {}

const logFd = fs.openSync(manifest.logPath, 'a');
function log(message) {
  fs.writeSync(logFd, `[${new Date().toISOString()}] ${message}\n`);
}

console.log = (...args) => log(util.format(...args));
console.info = (...args) => log(util.format(...args));
console.warn = (...args) => log(`WARN ${util.format(...args)}`);
console.error = (...args) => log(`ERROR ${util.format(...args)}`);

const requiredPaths = [manifest.projectRoot, manifest.configPath, manifest.serverPath];
if (requiredPaths.some((target) => !fs.existsSync(target))) {
  log('项目或 openprototype 包已不存在，服务停止。运行 service prune 可清理系统注册。');
  fs.closeSync(logFd);
  process.exit(0);
}

let missingChecks = 0;
let serverChild = null;
let restartTimer = null;
let shuttingDown = false;

function stopServerChild() {
  shuttingDown = true;
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = null;
  if (serverChild && !serverChild.killed) {
    try { serverChild.kill(); } catch {}
  }
}

const pathTimer = setInterval(() => {
  if (requiredPaths.every((target) => fs.existsSync(target))) {
    missingChecks = 0;
    return;
  }
  missingChecks += 1;
  if (missingChecks >= 3) {
    log('连续检测到项目或包路径失效，停止服务。');
    stopServerChild();
    process.exit(0);
  }
}, 30000);

process.on('exit', () => {
  clearInterval(pathTimer);
  if (restartTimer) clearTimeout(restartTimer);
  try { fs.closeSync(logFd); } catch {}
});

process.on('SIGINT', () => {
  stopServerChild();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopServerChild();
  process.exit(0);
});

function startWindowsServer() {
  if (shuttingDown) return;
  const env = Object.assign({}, process.env, { OPENPROTOTYPE_SERVICE_ID: manifest.serviceId });
  const args = [manifest.serverPath, '--root', manifest.projectRoot, '--service-id', manifest.serviceId];
  log(`启动 openprototype ${manifest.packageVersion}，项目：${manifest.projectRoot}`);
  serverChild = spawn(manifest.nodePath, args, {
    cwd: manifest.projectRoot,
    env,
    stdio: ['ignore', logFd, logFd],
    windowsHide: true
  });
  serverChild.once('error', (err) => {
    log(`启动失败：${err.stack || err.message}`);
    serverChild = null;
    scheduleWindowsRestart();
  });
  serverChild.once('exit', (code, signal) => {
    serverChild = null;
    if (shuttingDown) return;
    log(`服务器进程退出（code=${code}, signal=${signal || 'none'}），2 秒后重启。`);
    scheduleWindowsRestart();
  });
}

function scheduleWindowsRestart() {
  if (shuttingDown || restartTimer) return;
  restartTimer = setTimeout(() => {
    restartTimer = null;
    startWindowsServer();
  }, 2000);
}

try {
  process.chdir(manifest.projectRoot);
  if (process.platform === 'win32') {
    startWindowsServer();
  } else {
    process.env.OPENPROTOTYPE_SERVICE_ID = manifest.serviceId;
    process.argv.push('--root', manifest.projectRoot, '--service-id', manifest.serviceId);
    log(`启动 openprototype ${manifest.packageVersion}，项目：${manifest.projectRoot}`);
    require(manifest.serverPath);
  }
} catch (err) {
  log(`启动失败：${err.stack || err.message}`);
  process.exit(1);
}
