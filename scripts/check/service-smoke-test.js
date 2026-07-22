#!/usr/bin/env node
'use strict';

const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const PKG_ROOT = path.resolve(__dirname, '..', '..');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, cwd, options) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    env: Object.assign({}, process.env, options && options.env),
    timeout: options && options.timeout ? options.timeout : 120000
  });
  if (result.status !== 0 && !(options && options.allowFailure)) {
    throw new Error(`${command} ${args.join(' ')} 失败\n${result.stdout || ''}\n${result.stderr || ''}`);
  }
  return result;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close((err) => err ? reject(err) : resolve(port));
    });
  });
}

function cliPath(projectRoot) {
  return path.join(projectRoot, 'node_modules', 'openprototype', 'bin', 'cli.js');
}

function cli(projectRoot, args, options) {
  return run(process.execPath, [cliPath(projectRoot), ...args], projectRoot, options);
}

function status(projectRoot) {
  const result = cli(projectRoot, ['service', 'status', '--json']);
  return JSON.parse(result.stdout);
}

async function waitFor(projectRoot, predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let current;
  while (Date.now() < deadline) {
    try {
      current = status(projectRoot);
      if (predicate(current)) return current;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`等待服务状态超时：${JSON.stringify(current)}`);
}

async function main() {
  if (!['darwin', 'win32'].includes(process.platform)) {
    console.log('当前平台不支持常驻服务，跳过。');
    return;
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openprototype 服务测试 '));
  const packDir = path.join(tempRoot, 'pack');
  const projectRoot = path.join(tempRoot, '中文 project');
  process.env.NPM_CONFIG_CACHE = process.env.NPM_CONFIG_CACHE || path.join(tempRoot, 'npm-cache');
  fs.mkdirSync(packDir, { recursive: true });
  fs.mkdirSync(projectRoot, { recursive: true });

  let installed = false;
  try {
    const packed = run(NPM, ['pack', '--json', '--pack-destination', packDir], PKG_ROOT);
    const packResult = JSON.parse(packed.stdout);
    const packItem = Array.isArray(packResult) ? packResult[0] : (packResult.openprototype || Object.values(packResult)[0]);
    if (!packItem || !packItem.filename) throw new Error(`无法解析 npm pack 输出：${packed.stdout}`);
    const tarball = path.join(packDir, packItem.filename);
    const dependencySpec = `file:${tarball.split(path.sep).join('/')}`;
    const port = await freePort();

    fs.writeFileSync(path.join(projectRoot, 'package.json'), JSON.stringify({
      name: 'openprototype-service-smoke',
      private: true,
      version: '1.0.0',
      // npm 12 对本地 tarball 按来源路径授权；正式 registry 安装使用包名授权。
      allowScripts: { [dependencySpec]: true },
      dependencies: { openprototype: dependencySpec }
    }, null, 2) + '\n');
    fs.writeFileSync(path.join(projectRoot, 'proto-kit.config.json'), JSON.stringify({
      port,
      host: '127.0.0.1',
      service: { autoInstall: true },
      products: []
    }, null, 2) + '\n');

    const installResult = run(NPM, ['install', '--foreground-scripts'], projectRoot, {
      env: { OPENPROTOTYPE_SERVICE_AUTO_INSTALL: 'force' }
    });
    process.stdout.write(installResult.stdout || '');
    process.stderr.write(installResult.stderr || '');
    installed = true;

    const initial = await waitFor(projectRoot, (item) => item.running, 20000);
    if (!initial.registered || initial.port !== port || !initial.pid) throw new Error('自动安装后的服务状态不完整');

    process.kill(initial.pid, 'SIGKILL');
    const restarted = await waitFor(projectRoot, (item) => item.running && item.pid !== initial.pid, process.platform === 'win32' ? 90000 : 30000);
    if (restarted.version !== require(path.join(PKG_ROOT, 'package.json')).version) throw new Error('服务版本不正确');

    cli(projectRoot, ['service', 'stop', '--json']);
    await waitFor(projectRoot, (item) => !item.running, 15000);
    cli(projectRoot, ['service', 'start', '--json']);
    await waitFor(projectRoot, (item) => item.running, 20000);
    cli(projectRoot, ['service', 'restart', '--json']);
    await waitFor(projectRoot, (item) => item.running, 20000);

    const logResult = cli(projectRoot, ['service', 'logs', '--json']);
    const log = JSON.parse(logResult.stdout);
    if (!log.path || !log.content.includes('openprototype')) throw new Error('服务日志不可用');

    cli(projectRoot, ['service', 'uninstall', '--json']);
    installed = false;
    const removed = await waitFor(projectRoot, (item) => !item.registered && !item.running, 15000);
    if (removed.state !== 'unregistered') throw new Error('服务未完全卸载');

    const configPath = path.join(projectRoot, 'proto-kit.config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.host = '0.0.0.0';
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    const lanResult = cli(projectRoot, ['service', 'install'], { allowFailure: true });
    if (lanResult.status === 0 || !`${lanResult.stdout}\n${lanResult.stderr}`.includes('--allow-lan')) {
      throw new Error('非回环 host 未被安全拦截');
    }

    config.host = '127.0.0.1';
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    const blocker = net.createServer();
    await new Promise((resolve, reject) => blocker.once('error', reject).listen(port, '127.0.0.1', resolve));
    const conflictResult = cli(projectRoot, ['service', 'install'], { allowFailure: true });
    await new Promise((resolve) => blocker.close(resolve));
    if (conflictResult.status === 0 || !`${conflictResult.stdout}\n${conflictResult.stderr}`.includes('端口')) {
      throw new Error('端口冲突未被安装前检查拦截');
    }

    console.log(`service smoke passed: ${process.platform}, port=${port}`);
  } finally {
    if (fs.existsSync(cliPath(projectRoot))) {
      cli(projectRoot, ['service', 'uninstall', '--json'], { allowFailure: true });
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
