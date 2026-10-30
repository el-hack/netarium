import { platform } from 'node:os';
import { readFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { command, executable } from '../network.js';
export interface Counter {
  rx: number;
  tx: number;
  time: number;
}
export function parseCounters(output: string, name: string, os: string) {
  if (os === 'linux') {
    const row = output.split('\n').find((line) => line.trim().startsWith(`${name}:`));
    if (!row) throw new Error('Compteurs indisponibles');
    const columns = row.split(':')[1].trim().split(/\s+/);
    return { rx: Number(columns[0]), tx: Number(columns[8]) };
  }
  const lines = output.trim().split('\n');
  const header = lines[0].trim().split(/\s+/);
  const row = lines
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .find((parts) => parts[0] === name && parts[2]?.startsWith('<Link'));
  if (!row || header.indexOf('Ibytes') < 0 || header.indexOf('Obytes') < 0)
    throw new Error('Compteurs indisponibles');
  return { rx: Number(row[header.indexOf('Ibytes')]), tx: Number(row[header.indexOf('Obytes')]) };
}
export function counterDelta(before: Counter, after: Counter) {
  const seconds = (after.time - before.time) / 1000;
  const rx = after.rx - before.rx,
    tx = after.tx - before.tx;
  if (seconds <= 0 || seconds > 60 || rx < 0 || tx < 0 || !Number.isFinite(rx + tx)) return null;
  return { bytesIn: rx, bytesOut: tx, rateIn: (rx * 8) / seconds, rateOut: (tx * 8) / seconds };
}
function endpoint(value: string) {
  const match = value.match(/^(?:\[([^\]]+)\]|([^:]+)):(\d+|\*)$/);
  if (!match) return { ip: null, port: null };
  const ip = match[1] ?? match[2];
  return { ip: isIP(ip) ? ip : null, port: match[3] === '*' ? null : Number(match[3]) };
}
export function parseConnections(output: string) {
  const result: {
    localIp: string | null;
    remoteIp: string | null;
    localPort: number | null;
    remotePort: number | null;
    protocol: string;
    process: string;
    pid: number;
    state: string;
    domain: null;
  }[] = [];
  let pid = 0,
    process = '',
    protocol = '',
    name = '',
    state = '';
  const flush = () => {
    if (name && pid) {
      const [local, remote] = name.split('->');
      const a = endpoint(local),
        b = endpoint(remote ?? '');
      result.push({
        localIp: a.ip,
        remoteIp: b.ip,
        localPort: a.port,
        remotePort: b.port,
        protocol,
        process,
        pid,
        state: state || 'observed',
        domain: null,
      });
    }
    name = '';
    state = '';
    protocol = '';
  };
  for (const line of output.split('\n')) {
    const key = line[0],
      value = line.slice(1);
    if (key === 'p') {
      flush();
      pid = Number(value);
      process = '';
    } else if (key === 'c') process = value.slice(0, 120);
    else if (key === 'f') flush();
    else if (key === 'P') protocol = value;
    else if (key === 'n') name = value;
    else if (key === 'T' && value.startsWith('ST=')) state = value.slice(3);
  }
  flush();
  return result.slice(0, 2000);
}
export async function readCounters(name: string, signal: AbortSignal) {
  const os = platform();
  if (!['darwin', 'linux'].includes(os))
    throw new Error('Compteurs locaux non intégrés sur ce système.');
  const output =
    os === 'linux'
      ? await readFile('/proc/net/dev', 'utf8')
      : await command('/usr/sbin/netstat', ['-ibn'], signal, 3000);
  const result = parseCounters(output, name, os);
  if (!Number.isSafeInteger(result.rx) || !Number.isSafeInteger(result.tx))
    throw new Error('Compteurs invalides');
  return { ...result, time: Date.now() };
}
export async function readConnections(signal: AbortSignal) {
  const lsof = await executable('lsof');
  if (!lsof || !['darwin', 'linux'].includes(platform()))
    throw new Error('Observation des processus disponible sur macOS/Linux avec lsof.');
  try {
    return parseConnections(
      await command(lsof, ['-nP', '-i', '-FpcfPnT', '+c', '0'], signal, 5000),
    );
  } catch (error) {
    if ((error as { code?: number }).code === 1 && !(error as { stderr?: string }).stderr)
      return [];
    throw error;
  }
}
