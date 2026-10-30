import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Node.js 24 minimum requis.');
try {
  await access('dist/index.html');
  await access('node_modules/tsx/package.json');
} catch {
  console.error('Installation requise : npm ci && npm run build, puis relancez Netarium.');
  process.exit(1);
}
const port = Number(process.env.PORT ?? 4783);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Port local invalide.');
const url = `http://127.0.0.1:${port}`;
async function isRunning() {
  try {
    const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(800) });
    return response.ok && (await response.json()).application === 'netarium';
  } catch {
    return false;
  }
}
function openBrowser() {
  spawn('open', [url], { stdio: 'ignore' }).unref();
}
if (await isRunning()) {
  openBrowser();
  process.exit(0);
}
const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
  stdio: 'inherit',
});
let checking = false;
const timer = setInterval(async () => {
  if (checking) return;
  checking = true;
  if (await isRunning()) {
    clearInterval(timer);
    openBrowser();
  }
  checking = false;
}, 400);
setTimeout(() => clearInterval(timer), 15000).unref();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.kill(signal));
server.on('exit', (code) => {
  clearInterval(timer);
  process.exit(code ?? 0);
});
server.on('error', (error) => {
  clearInterval(timer);
  console.error(error.message);
  process.exit(1);
});
