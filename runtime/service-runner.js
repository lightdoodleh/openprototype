#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');

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

const pathTimer = setInterval(() => {
  if (requiredPaths.every((target) => fs.existsSync(target))) {
    missingChecks = 0;
    return;
  }
  missingChecks += 1;
  if (missingChecks >= 3) {
    log('连续检测到项目或包路径失效，停止服务。');
    process.exit(0);
  }
}, 30000);

process.on('exit', () => {
  clearInterval(pathTimer);
  try { fs.closeSync(logFd); } catch {}
});

try {
  process.chdir(manifest.projectRoot);
  process.env.OPENPROTOTYPE_SERVICE_ID = manifest.serviceId;
  process.argv.push('--root', manifest.projectRoot, '--service-id', manifest.serviceId);
  log(`启动 openprototype ${manifest.packageVersion}，项目：${manifest.projectRoot}`);
  require(manifest.serverPath);
} catch (err) {
  log(`启动失败：${err.stack || err.message}`);
  process.exit(1);
}
