import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { randomBytes } from 'node:crypto';

const root = process.cwd();
const output = path.join(root, 'output/e2e');
fs.mkdirSync(output, { recursive: true });
// Never reuse a developer's server or database, even when a previous run failed.
for (const port of [8013, 4323]) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error(`E2E port ${port} is already in use.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}
const runDir = fs.mkdtempSync(path.join(output, 'run-'));
const database = path.join(runDir, 'database.sqlite');
fs.writeFileSync(database, '');
const env = {
  ...process.env,
  APP_ENV: 'testing', APP_DEBUG: 'true', APP_KEY: `base64:${randomBytes(32).toString('base64')}`,
  APP_CONFIG_CACHE: path.join(runDir, 'config.php'),
  DB_CONNECTION: 'sqlite', DB_DATABASE: database, DB_URL: '',
  MAIL_MAILER: 'array', QUEUE_CONNECTION: 'sync', CACHE_STORE: 'database',
  SESSION_DRIVER: 'database', SESSION_COOKIE: 'midia_e2e_session', SESSION_SECURE_COOKIE: 'false',
  APP_URL: 'http://127.0.0.1:8013', FRONTEND_URL: 'http://127.0.0.1:4323',
  SANCTUM_STATEFUL_DOMAINS: '127.0.0.1:4323,127.0.0.1:8013',
  SHIPPING_MOCK: 'true', FRONTEND_DEPLOY_TRIGGER_ENABLED: 'false',
  STRIPE_KEY: '', STRIPE_SECRET: '', STRIPE_WEBHOOK_SECRET: '',
  GITHUB_ACTIONS_TRIGGER_TOKEN: '', EASYPOST_API_KEY: '',
};
const php = process.env.PHP_BINARY || 'php';
const phpPath = execFileSync(php, ['-r', 'echo PHP_BINARY;'], { encoding: 'utf8', windowsHide: true }).trim();
const extensions = execFileSync(php, ['-m'], { encoding: 'utf8', windowsHide: true }).toLowerCase();
const phpArgs = [];
if (process.platform === 'win32') {
  phpArgs.push('-d', `extension_dir=${path.join(path.dirname(phpPath), 'ext')}`);
  for (const extension of ['pdo_sqlite', 'sqlite3', 'fileinfo']) {
    if (!extensions.split(/\r?\n/).includes(extension)) phpArgs.push('-d', `extension=${extension}`);
  }
}
execFileSync(phpPath, [...phpArgs, 'artisan', 'migrate', '--seed', '--force', '--no-interaction'], {
  cwd: path.join(root, 'backend'), env, windowsHide: true, stdio: 'inherit',
});

const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exit(code);
}
function start(binary, args, options, logName) {
  const log = fs.openSync(path.join(output, logName), 'w');
  const child = spawn(binary, args, { ...options, windowsHide: true, stdio: ['ignore', log, log] });
  children.push(child);
  child.on('error', error => { console.error(error); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code || 1); });
  return child;
}
start(phpPath, [...phpArgs, '-S', '127.0.0.1:8013', path.join(root, 'backend/vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php')], {
  cwd: path.join(root, 'backend/public'), env,
}, 'backend.log');
start(process.execPath, ['node_modules/astro/astro.js', 'dev', '--config', 'tests/support/astro.config.mjs', '--host', '127.0.0.1', '--port', '4323'], {
  cwd: root, env: { ...process.env, PUBLIC_API_URL: 'http://127.0.0.1:8013/api', PUBLIC_STRIPE_KEY: '' },
}, 'astro.log');
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
