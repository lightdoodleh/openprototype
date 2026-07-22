'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadConfig, CONFIG_FILENAME } = require('./config');

const PKG_ROOT = path.resolve(__dirname, '..');
const RUNNER_SOURCE = path.join(PKG_ROOT, 'runtime', 'service-runner.js');
const SERVICE_PREFIX = 'io.openprototype.project';

function canonicalProjectRoot(projectRoot) {
  const resolved = path.resolve(projectRoot || process.cwd());
  try { return fs.realpathSync(resolved); } catch { return resolved; }
}

function projectServiceId(projectRoot, platform) {
  const canonical = canonicalProjectRoot(projectRoot);
  const input = (platform || process.platform) === 'win32' ? canonical.toLowerCase() : canonical;
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function isSupportedPlatform(platform) {
  return (platform || process.platform) === 'darwin' || (platform || process.platform) === 'win32';
}

function isLoopbackHost(host) {
  const value = String(host || '').toLowerCase();
  return value === 'localhost' || value === '::1' || value === '0:0:0:0:0:0:0:1' || /^127(?:\.\d{1,3}){3}$/.test(value);
}

function serviceBaseDir(platform) {
  if ((platform || process.platform) === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'openprototype');
  }
  if ((platform || process.platform) === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'OpenPrototype');
  }
  return path.join(os.homedir(), '.openprototype');
}

function servicePaths(projectRoot, platform) {
  const actualPlatform = platform || process.platform;
  const serviceId = projectServiceId(projectRoot, actualPlatform);
  const baseDir = serviceBaseDir(actualPlatform);
  const serviceDir = path.join(baseDir, 'services', serviceId);
  const label = `${SERVICE_PREFIX}.${serviceId}`;
  return {
    serviceId,
    baseDir,
    serviceDir,
    runnerPath: path.join(serviceDir, 'service-runner.js'),
    manifestPath: path.join(serviceDir, 'manifest.json'),
    logPath: path.join(baseDir, 'logs', `${serviceId}.log`),
    label,
    taskName: `OpenPrototype-${serviceId}`,
    plistPath: path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`)
  };
}

function packageVersion() {
  try { return JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')).version || 'unknown'; }
  catch { return 'unknown'; }
}

function projectContext(projectRoot) {
  const root = canonicalProjectRoot(projectRoot);
  const config = loadConfig(root);
  if (!config.hasConfigFile) throw new Error(`当前项目没有 ${CONFIG_FILENAME}，请先运行 openprototype init`);
  const paths = servicePaths(root);
  return {
    root,
    config,
    paths,
    manifest: {
      schemaVersion: 1,
      serviceId: paths.serviceId,
      platform: process.platform,
      projectRoot: root,
      configPath: config.configFile,
      packageRoot: PKG_ROOT,
      packageVersion: packageVersion(),
      serverPath: path.join(PKG_ROOT, 'runtime', 'server.js'),
      nodePath: process.execPath,
      port: config.port,
      host: config.host,
      logPath: paths.logPath,
      label: paths.label,
      taskName: paths.taskName,
      installedAt: new Date().toISOString()
    }
  };
}

function readManifest(manifestPath) {
  try { return JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { return null; }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function commandResult(command, args, options) {
  return spawnSync(command, args, Object.assign({ encoding: 'utf8', windowsHide: true }, options));
}

function commandError(result, fallback) {
  return String((result && (result.stderr || result.stdout)) || fallback || '系统命令执行失败').trim();
}

function launchDomain() {
  return `gui/${typeof process.getuid === 'function' ? process.getuid() : ''}`;
}

function macPlist(manifest, paths) {
  const args = [manifest.nodePath, paths.runnerPath, '--manifest', paths.manifestPath]
    .map((item) => `      <string>${xmlEscape(item)}</string>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${xmlEscape(paths.label)}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>WorkingDirectory</key><string>${xmlEscape(manifest.projectRoot)}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict><key>SuccessfulExit</key><false/></dict>
  <key>ProcessType</key><string>Background</string>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>${xmlEscape(manifest.logPath)}</string>
  <key>StandardErrorPath</key><string>${xmlEscape(manifest.logPath)}</string>
</dict>
</plist>
`;
}

function windowsAccount() {
  const result = commandResult('whoami.exe', []);
  if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  const domain = process.env.USERDOMAIN;
  const user = process.env.USERNAME;
  return domain && user ? `${domain}\\${user}` : user;
}

function quoteWindowsArg(value) {
  const input = String(value);
  return `"${input.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1')}"`;
}

function windowsTaskXml(manifest, paths) {
  const account = windowsAccount();
  const argumentsText = [paths.runnerPath, '--manifest', paths.manifestPath].map(quoteWindowsArg).join(' ');
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>openprototype project service</Description></RegistrationInfo>
  <Triggers><LogonTrigger><Enabled>true</Enabled><UserId>${xmlEscape(account)}</UserId></LogonTrigger></Triggers>
  <Principals><Principal id="Author"><UserId>${xmlEscape(account)}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure><Interval>PT1M</Interval><Count>999</Count></RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec><Command>${xmlEscape(manifest.nodePath)}</Command><Arguments>${xmlEscape(argumentsText)}</Arguments><WorkingDirectory>${xmlEscape(manifest.projectRoot)}</WorkingDirectory></Exec>
  </Actions>
</Task>
`;
}

function healthHost(host) {
  return String(host || '').includes(':') ? '::1' : '127.0.0.1';
}

function inspectHealth(port, host, timeoutMs) {
  return new Promise((resolve) => {
    let connected = false;
    const req = http.request({
      hostname: healthHost(host),
      port,
      path: '/api/health',
      method: 'GET',
      timeout: timeoutMs || 800
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ occupied: true, health: res.statusCode === 200 ? JSON.parse(body) : null, statusCode: res.statusCode });
        } catch {
          resolve({ occupied: true, health: null, statusCode: res.statusCode });
        }
      });
    });
    req.on('socket', (socket) => socket.once('connect', () => { connected = true; }));
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', () => resolve({ occupied: connected, health: null, statusCode: null }));
    req.end();
  });
}

async function waitForHealth(manifest, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 10000);
  while (Date.now() < deadline) {
    const probe = await inspectHealth(manifest.port, manifest.host, 500);
    if (probe.health && probe.health.serviceId === manifest.serviceId) return probe.health;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

function macStop(paths) {
  commandResult('launchctl', ['bootout', `${launchDomain()}/${paths.label}`]);
}

function macStart(paths) {
  let result = commandResult('launchctl', ['bootstrap', launchDomain(), paths.plistPath]);
  if (result.status !== 0 && !/already loaded|service is already loaded/i.test(commandError(result))) {
    result = commandResult('launchctl', ['load', '-w', paths.plistPath]);
    if (result.status !== 0 && !/already loaded/i.test(commandError(result))) {
      throw new Error(commandError(result, '无法加载 macOS LaunchAgent'));
    }
  }
  commandResult('launchctl', ['kickstart', '-k', `${launchDomain()}/${paths.label}`]);
}

function windowsStop(paths) {
  commandResult('schtasks.exe', ['/End', '/TN', paths.taskName]);
}

function windowsStart(paths) {
  const result = commandResult('schtasks.exe', ['/Run', '/TN', paths.taskName]);
  if (result.status !== 0) throw new Error(commandError(result, '无法启动 Windows 计划任务'));
}

function stopPlatformService(paths, platform) {
  if (platform === 'darwin') macStop(paths);
  else if (platform === 'win32') windowsStop(paths);
}

function startPlatformService(paths, platform) {
  if (platform === 'darwin') macStart(paths);
  else if (platform === 'win32') windowsStart(paths);
  else throw new Error('常驻服务目前仅支持 macOS 和 Windows');
}

function registerPlatformService(manifest, paths, platform) {
  if (platform === 'darwin') {
    fs.mkdirSync(path.dirname(paths.plistPath), { recursive: true });
    fs.writeFileSync(paths.plistPath, macPlist(manifest, paths));
    macStart(paths);
    return;
  }
  if (platform === 'win32') {
    const xmlPath = path.join(paths.serviceDir, 'task.xml');
    fs.writeFileSync(xmlPath, '\ufeff' + windowsTaskXml(manifest, paths), 'utf16le');
    const result = commandResult('schtasks.exe', ['/Create', '/TN', paths.taskName, '/XML', xmlPath, '/F']);
    try { fs.unlinkSync(xmlPath); } catch {}
    if (result.status !== 0) throw new Error(commandError(result, '无法注册 Windows 计划任务'));
    windowsStart(paths);
    return;
  }
  throw new Error('常驻服务目前仅支持 macOS 和 Windows');
}

function unregisterPlatformService(paths, platform) {
  stopPlatformService(paths, platform);
  if (platform === 'darwin') {
    try { fs.unlinkSync(paths.plistPath); } catch {}
  } else if (platform === 'win32') {
    commandResult('schtasks.exe', ['/Delete', '/TN', paths.taskName, '/F']);
  }
}

async function installService(options) {
  const opts = options || {};
  if (!isSupportedPlatform()) throw new Error('常驻服务目前仅支持 macOS 和 Windows');
  const context = projectContext(opts.projectRoot);
  const { config, manifest, paths } = context;
  if (config.service && config.service.autoInstall === false && !opts.explicit) {
    return { skipped: true, reason: 'service.autoInstall=false', serviceId: paths.serviceId };
  }
  if (!isLoopbackHost(config.host) && !opts.allowLan) {
    throw new Error(`当前 host=${config.host} 会长期暴露到局域网；如确认需要，请使用 service install --allow-lan`);
  }

  const probe = await inspectHealth(config.port, config.host, 1000);
  if (probe.occupied && (!probe.health || probe.health.serviceId !== paths.serviceId)) {
    throw new Error(`端口 ${config.port} 已被${probe.health && probe.health.serviceId ? '另一个 openprototype 项目' : '其他进程'}占用`);
  }

  stopPlatformService(paths, process.platform);
  fs.mkdirSync(paths.serviceDir, { recursive: true });
  fs.mkdirSync(path.dirname(paths.logPath), { recursive: true });
  fs.copyFileSync(RUNNER_SOURCE, paths.runnerPath);
  try { fs.chmodSync(paths.runnerPath, 0o700); } catch {}
  writeJson(paths.manifestPath, manifest);
  registerPlatformService(manifest, paths, process.platform);

  const health = await waitForHealth(manifest, 10000);
  if (!health) throw new Error(`服务已注册，但未能在 10 秒内通过健康检查；请查看 ${paths.logPath}`);
  return { skipped: false, registered: true, running: true, health, manifest, paths };
}

function registrationExists(paths, platform) {
  if (platform === 'darwin') return fs.existsSync(paths.plistPath);
  if (platform === 'win32') return commandResult('schtasks.exe', ['/Query', '/TN', paths.taskName]).status === 0;
  return false;
}

async function serviceStatus(projectRoot) {
  const root = canonicalProjectRoot(projectRoot);
  const paths = servicePaths(root);
  const manifest = readManifest(paths.manifestPath);
  const supported = isSupportedPlatform();
  const registered = supported && registrationExists(paths, process.platform);
  const config = loadConfig(root);
  const port = manifest ? manifest.port : config.port;
  const host = manifest ? manifest.host : config.host;
  const probe = port ? await inspectHealth(port, host, 800) : { occupied: false, health: null };
  const ownsPort = !!(probe.health && probe.health.serviceId === paths.serviceId);
  const stale = !!(manifest && (!fs.existsSync(manifest.projectRoot) || !fs.existsSync(manifest.serverPath) || !fs.existsSync(manifest.nodePath)));
  const configDrift = !!(manifest && (manifest.port !== config.port || manifest.host !== config.host));
  const installedVersion = packageVersion();
  const runtimeVersion = ownsPort ? probe.health.version : (manifest && manifest.packageVersion);
  const versionDrift = !!(manifest && runtimeVersion && runtimeVersion !== installedVersion);
  const nodeDrift = !!(manifest && manifest.nodePath !== process.execPath);
  let state = 'unregistered';
  if (ownsPort) state = 'running';
  else if (probe.occupied) state = 'port-conflict';
  else if (stale) state = 'stale';
  else if (registered) state = 'stopped';
  return {
    supported,
    platform: process.platform,
    serviceId: paths.serviceId,
    state,
    registered,
    running: ownsPort,
    stale,
    port,
    host,
    pid: ownsPort ? probe.health.pid : null,
    version: runtimeVersion,
    installedVersion,
    configDrift,
    versionDrift,
    nodeDrift,
    startedAt: ownsPort ? probe.health.startedAt : null,
    logPath: paths.logPath,
    projectRoot: root,
    manifestPath: paths.manifestPath
  };
}

async function startService(projectRoot) {
  if (!isSupportedPlatform()) throw new Error('常驻服务目前仅支持 macOS 和 Windows');
  const root = canonicalProjectRoot(projectRoot);
  const paths = servicePaths(root);
  const manifest = readManifest(paths.manifestPath);
  if (!manifest || !registrationExists(paths, process.platform)) throw new Error('服务尚未安装，请先运行 openprototype service install');
  const current = await serviceStatus(root);
  if (current.running) return current;
  startPlatformService(paths, process.platform);
  const health = await waitForHealth(manifest, 10000);
  if (!health) throw new Error(`服务未能通过健康检查，请查看 ${paths.logPath}`);
  return serviceStatus(root);
}

function stopService(projectRoot) {
  if (!isSupportedPlatform()) throw new Error('常驻服务目前仅支持 macOS 和 Windows');
  const root = canonicalProjectRoot(projectRoot);
  const paths = servicePaths(root);
  stopPlatformService(paths, process.platform);
  return { serviceId: paths.serviceId, stopped: true };
}

function uninstallService(projectRoot) {
  if (!isSupportedPlatform()) throw new Error('常驻服务目前仅支持 macOS 和 Windows');
  const root = canonicalProjectRoot(projectRoot);
  const paths = servicePaths(root);
  unregisterPlatformService(paths, process.platform);
  try { fs.rmSync(paths.serviceDir, { recursive: true, force: true }); } catch {}
  return { serviceId: paths.serviceId, uninstalled: true, logPath: paths.logPath };
}

function pruneServices() {
  if (!isSupportedPlatform()) return [];
  const servicesDir = path.join(serviceBaseDir(), 'services');
  let names = [];
  try { names = fs.readdirSync(servicesDir); } catch { return []; }
  const removed = [];
  for (const name of names) {
    const manifest = readManifest(path.join(servicesDir, name, 'manifest.json'));
    if (!manifest) continue;
    const valid = fs.existsSync(manifest.projectRoot) && fs.existsSync(manifest.configPath) && fs.existsSync(manifest.serverPath) && fs.existsSync(manifest.nodePath);
    if (valid) continue;
    const paths = servicePaths(manifest.projectRoot, manifest.platform || process.platform);
    unregisterPlatformService(paths, manifest.platform || process.platform);
    try { fs.rmSync(path.join(servicesDir, name), { recursive: true, force: true }); } catch {}
    removed.push({ serviceId: manifest.serviceId || name, projectRoot: manifest.projectRoot });
  }
  return removed;
}

function readLog(projectRoot, lineCount) {
  const paths = servicePaths(canonicalProjectRoot(projectRoot));
  let content = '';
  try { content = fs.readFileSync(paths.logPath, 'utf8'); } catch {}
  const lines = content.split(/\r?\n/);
  return { path: paths.logPath, content: lines.slice(-1 * (lineCount || 100)).join('\n') };
}

module.exports = {
  installService,
  startService,
  stopService,
  uninstallService,
  pruneServices,
  serviceStatus,
  readLog,
  projectServiceId,
  servicePaths,
  isSupportedPlatform,
  isLoopbackHost,
  inspectHealth
};
