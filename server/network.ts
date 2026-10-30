import { networkInterfaces, platform, hostname } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { NetworkInterface, Observation } from '../shared/types.js';
const execute = promisify(execFile);
export async function command(file: string, args: string[], signal?: AbortSignal, timeout = 3000) {
  const { stdout } = await execute(file, args, {timeout, signal, maxBuffer: 4 * 1024 * 1024, encoding:'utf8', windowsHide:true});
  return stdout;
}
export async function executable(name: string): Promise<string | null> {
  const paths = (process.env.PATH ?? '').split(platform() === 'win32' ? ';' : ':');
  if (platform() !== 'win32') paths.push('/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/usr/sbin', '/sbin', '/bin');
  for (const directory of paths) {
    const file = `${directory}/${name}${platform() === 'win32' ? '.exe' : ''}`;
    try { await access(file, constants.X_OK); return file; } catch { /* Try the next standard search directory. */ }
  }
  return null;
}
function numeric(ip: string): number | null {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || ip.split('.').some(part => Number(part) > 255)) return null;
  return ip.split('.').reduce((sum, part) => (sum * 256 + Number(part)) >>> 0, 0);
}
function dotted(value: number) { return [24,16,8,0].map(shift => (value >>> shift) & 255).join('.'); }
export function isPrivateIPv4(ip: string) {
  const n = numeric(ip);
  return n !== null && ((n >>> 24) === 10 || (n >>> 20) === 0xac1 || (n >>> 16) === 0xc0a8);
}
export function contains(cidr: string, ip: string) {
  const [base, prefixText] = cidr.split('/');
  const prefix = Number(prefixText);
  const address = numeric(ip), network = numeric(base);
  if (address === null || network === null || !Number.isInteger(prefix) || prefix < 1 || prefix > 32) return false;
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return (address & mask) === (network & mask);
}
export function boundedSubnet(address: string, netmask: string) {
  const mask = numeric(netmask);
  if (mask === null || numeric(address) === null) throw new Error('Adresse réseau invalide');
  const bits = mask.toString(2).padStart(32, '0');
  if (!/^1*0*$/.test(bits)) throw new Error('Masque réseau invalide');
  const prefix = Math.max(24, bits.replace(/0/g, '').length);
  return `${dotted((numeric(address)! & (0xffffffff << (32-prefix))) >>> 0)}/${prefix}`;
}
export function hosts(cidr: string) {
  const [base, prefix] = cidr.split('/');
  const start = numeric(base)!;
  const size = 2 ** (32 - Number(prefix));
  if (size > 256 || size < 1) throw new Error('Périmètre trop grand');
  return Array.from({length: size <= 2 ? size : size-2}, (_, i) => dotted(start + i + (size <= 2 ? 0 : 1)));
}
export async function interfaces(): Promise<NetworkInterface[]> {
  const system = networkInterfaces();
  let gateway: string | null = null;
  let gatewayInterface: string | null = null;
  try {
    if (platform() === 'darwin') {
      const route = await command('/sbin/route', ['-n', 'get', 'default']);
      gateway = route.match(/gateway:\s+(\d+\.\d+\.\d+\.\d+)/)?.[1] ?? null;
      gatewayInterface = route.match(/interface:\s+(\S+)/)?.[1] ?? null;
    } else if (platform() === 'linux') {
      const ip = await executable('ip');
      if (ip) {
        const route = await command(ip, ['-4','route','show','default']);
        gateway = route.match(/via\s+([\d.]+)/)?.[1] ?? null;
        gatewayInterface = route.match(/dev\s+(\S+)/)?.[1] ?? null;
      }
    }
  } catch { /* Discovery remains usable without a route provider. */ }
  return Object.entries(system).flatMap(([name, addresses]) => (addresses ?? []).filter(a => a.family === 'IPv4' && !a.internal && isPrivateIPv4(a.address)).map(a => ({
    id:`${name}:${a.address}`, name, address:a.address, mac:a.mac,
    cidr: a.cidr ?? boundedSubnet(a.address, a.netmask), scanCidr: boundedSubnet(a.address, a.netmask),
    gateway: gateway && (!gatewayInterface || gatewayInterface === name) && contains(a.cidr ?? boundedSubnet(a.address, a.netmask), gateway) ? gateway : null,
  }))).sort((a,b) => Number(Boolean(b.gateway))-Number(Boolean(a.gateway)));
}
function normalizeMac(mac: string): string | null {
  const parts = mac.replaceAll('-', ':').toLowerCase().split(':');
  if (parts.length !== 6 || parts.some(p => !/^[0-9a-f]{1,2}$/.test(p))) return null;
  const normalized = parts.map(p => p.padStart(2, '0')).join(':');
  return normalized === '00:00:00:00:00:00' || (parseInt(parts[0],16) & 1) !== 0 ? null : normalized;
}
export function parseNeighbors(output: string, cidr: string): Observation[] {
  return output.split('\n').flatMap(line => {
    const ip = line.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/)?.[0];
    const rawMac = line.match(/\b[\da-f]{1,2}(?:[:-][\da-f]{1,2}){5}\b/i)?.[0];
    const mac = rawMac ? normalizeMac(rawMac) : null;
    return ip && mac && contains(cidr, ip) && isPrivateIPv4(ip) ? [{ip, mac, hostname:null, vendor:null, source:'neighbor' as const, reachable:false, role:'device' as const}] : [];
  });
}
export function parseNmap(xml: string, cidr: string): Observation[] {
  if (XMLValidator.validate(xml) !== true) throw new Error('Résultat Nmap XML invalide');
  const parsed = new XMLParser({ignoreAttributes:false, attributeNamePrefix:'', processEntities:false, isArray:name => ['host','address','hostname'].includes(name)}).parse(xml);
  if (!parsed.nmaprun) throw new Error('Résultat Nmap incomplet');
  return (parsed.nmaprun.host ?? []).flatMap((host: {status?: {state:string}; address?: {addrtype:string; addr:string; vendor?:string}[]; hostnames?: {hostname?: {name:string}[]}}) => {
    const ip = host.address?.find(a => a.addrtype === 'ipv4')?.addr;
    const mac = host.address?.find(a => a.addrtype === 'mac');
    return host.status?.state === 'up' && ip && contains(cidr,ip) ? [{ip, mac:mac ? normalizeMac(mac.addr) : null, hostname:host.hostnames?.hostname?.[0]?.name ?? null, vendor:mac?.vendor ?? null, source:'nmap' as const, reachable:true, role:'device' as const}] : [];
  });
}
export interface CollectResult { observations: Observation[]; warnings: string[] }
export async function collect(network: NetworkInterface, active: boolean, signal: AbortSignal): Promise<CollectResult> {
  const warnings: string[] = [];
  const found = new Map<string,Observation>();
  found.set(network.address, {ip:network.address, mac:normalizeMac(network.mac), hostname:hostname(), vendor:null, source:'local', reachable:true, role:'self'});
  const readNeighbors = async () => {
    try {
      const ip = platform() === 'linux' ? await executable('ip') : null;
      const arp = await executable('arp');
      const output = ip ? await command(ip, ['-4','neigh','show','dev',network.name], signal) : arp ? await command(arp, ['-an'], signal) : '';
      for (const neighbor of parseNeighbors(output, network.scanCidr)) {
        const existing = found.get(neighbor.ip);
        found.set(neighbor.ip, existing ? {...neighbor, ...existing, mac:existing.mac ?? neighbor.mac} : neighbor);
      }
    } catch { if (!signal.aborted) warnings.push('Table des voisins indisponible.'); }
  };
  await readNeighbors();
  if (active) {
    const nmap = await executable('nmap');
    let usePing = !nmap;
    if (nmap) {
      try {
        const output = await command(nmap, ['-sn','-n','--unprivileged','--max-retries','1','--host-timeout','3s','-oX','-',network.scanCidr], signal, 90000);
        for (const observation of parseNmap(output, network.scanCidr)) {
          const existing = found.get(observation.ip);
          found.set(observation.ip, {...observation, mac:observation.mac ?? existing?.mac ?? null, role:existing?.role ?? observation.role, hostname:observation.hostname ?? existing?.hostname ?? null});
        }
      } catch { if (!signal.aborted) { warnings.push('Nmap indisponible pendant la collecte ; repli sur ICMP.'); usePing = true; } }
    }
    if (usePing && !signal.aborted) {
      const ping = await executable('ping');
      if (ping) {
        const queue = hosts(network.scanCidr).filter(ip => ip !== network.address);
        await Promise.all(Array.from({length:12}, async () => {
          while (queue.length && !signal.aborted) {
            const ip = queue.shift()!;
            try {
              await command(ping, platform() === 'win32' ? ['-n','1','-w','900',ip] : ['-n','-c','1',ip], signal, 1400);
              const existing = found.get(ip);
              found.set(ip,{ip,mac:existing?.mac ?? null,hostname:existing?.hostname ?? null,vendor:existing?.vendor ?? null,source:'ping',reachable:true,role:existing?.role ?? 'device'});
            } catch { /* Silence and filtering are not proof that a device is switched off. */ }
          }
        }));
        warnings.push('Découverte ICMP : les appareils silencieux peuvent ne pas répondre.');
      } else warnings.push('Aucun outil de découverte active disponible.');
    }
    await readNeighbors();
  }
  if (signal.aborted) throw new DOMException('Collecte annulée','AbortError');
  for (const observation of found.values()) {
    if (observation.ip === network.gateway && observation.role !== 'self') observation.role = 'gateway';
  }
  return {observations:[...found.values()], warnings:[...new Set(warnings)]};
}
