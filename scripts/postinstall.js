#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { findProjectRoot, loadConfig } = require('../lib/config');
const { installService, isSupportedPlatform, isLoopbackHost } = require('../lib/service-manager');

const PKG_ROOT = path.resolve(__dirname, '..');

function isTruthy(value) {
  return !!value && !['0', 'false', 'no', 'off'].includes(String(value).toLowerCase());
}

function isConsumerInstall(projectRoot) {
  try {
    const installedPackage = path.dirname(require.resolve('openprototype/package.json', { paths: [projectRoot] }));
    return fs.realpathSync(installedPackage) === fs.realpathSync(PKG_ROOT) && fs.realpathSync(projectRoot) !== fs.realpathSync(PKG_ROOT);
  } catch {
    return false;
  }
}

(async () => {
  const policy = String(process.env.OPENPROTOTYPE_SERVICE_AUTO_INSTALL || '').toLowerCase();
  if (policy === '0' || policy === 'false' || policy === 'off') return;
  if (!isSupportedPlatform()) return;
  if (isTruthy(process.env.CI) && policy !== 'force') return;

  const startDir = process.env.INIT_CWD || process.cwd();
  const projectRoot = findProjectRoot(startDir);
  const config = loadConfig(projectRoot);
  if (!config.hasConfigFile || !isConsumerInstall(projectRoot)) return;
  if (config.service && config.service.autoInstall === false) return;
  if (!isLoopbackHost(config.host)) {
    console.warn(`[openprototype] 已跳过常驻服务：host=${config.host} 不是本机回环地址。`);
    console.warn('[openprototype] 如确认需要长期开放局域网访问，请运行：npx openprototype service install --allow-lan');
    return;
  }

  try {
    const result = await installService({ projectRoot, explicit: false });
    if (!result.skipped) console.log(`[openprototype] 常驻服务已启动：http://127.0.0.1:${config.port}`);
  } catch (err) {
    console.warn(`[openprototype] 常驻服务自动安装失败：${err.message}`);
    console.warn('[openprototype] npm 安装不受影响；可稍后运行：npx openprototype service install');
  }
})().catch((err) => {
  console.warn(`[openprototype] 常驻服务自动安装失败：${err.message}`);
  process.exitCode = 0;
});

