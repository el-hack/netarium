import { discoverServices, enrichObservations } from './mdns.js';
import { boundedSubnet, contains, hosts, isPrivateIPv4 } from './ipv4.js';
export { boundedSubnet, contains, hosts, isPrivateIPv4 } from './ipv4.js';
import { networkInterfaces, platform, hostname } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { NetworkInterface, Observation } from '../shared/types.js';
const execute = promisify(execFile);
export async function command(file: string, args: string[], signal?: AbortSignal, timeout = 3000) {
  const { stdout } = await execute(file, args, {
    timeout,
    signal,
    maxBuffer: 4 * 1024 * 1024,
    encoding: 'utf8',
    windowsHide: true,
  });
  return stdout;
}
export async function executable(name: string): Promise<string | null> {
  const paths = (process.env.PATH ?? '').split(platform() === 'win32' ? ';' : ':');
  if (platform() !== 'win32')
    paths.push('/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/usr/sbin', '/sbin', '/bin');
  for (const directory of paths) {
    const file = `${directory}/${name}${platform() === 'win32' ? '.exe' : ''}`;
    try {
      await access(file, constants.X_OK);
      return file;
    } catch {
      /* Try the next standard search directory. */
    }
  }
  return null;
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
        const route = await command(ip, ['-4', 'route', 'show', 'default']);
        gateway = route.match(/via\s+([\d.]+)/)?.[1] ?? null;
        gatewayInterface = route.match(/dev\s+(\S+)/)?.[1] ?? null;
      }
    }
  } catch {
    /* Discovery remains usable without a route provider. */
  }
  return Object.entries(system)
    .flatMap(([name, addresses]) =>
      (addresses ?? [])
        .filter((a) => a.family === 'IPv4' && !a.internal && isPrivateIPv4(a.address))
        .map((a) => ({
          id: `${name}:${a.address}`,
          name,
          address: a.address,
          mac: a.mac,
          cidr: a.cidr ?? boundedSubnet(a.address, a.netmask),
          scanCidr: boundedSubnet(a.address, a.netmask),
          gateway:
            gateway &&
            (!gatewayInterface || gatewayInterface === name) &&
            contains(a.cidr ?? boundedSubnet(a.address, a.netmask), gateway)
              ? gateway
              : null,
        })),
    )
    .sort((a, b) => Number(Boolean(b.gateway)) - Number(Boolean(a.gateway)));
}
function normalizeMac(mac: string): string | null {
  const parts = mac.replaceAll('-', ':').toLowerCase().split(':');
  if (parts.length !== 6 || parts.some((p) => !/^[0-9a-f]{1,2}$/.test(p))) return null;
  const normalized = parts.map((p) => p.padStart(2, '0')).join(':');
  return normalized === '00:00:00:00:00:00' || (parseInt(parts[0], 16) & 1) !== 0
    ? null
    : normalized;
}
export function parseNeighbors(output: string, cidr: string): Observation[] {
  return output.split('\n').flatMap((line) => {
    const ip = line.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/)?.[0];
    const rawMac = line.match(/\b[\da-f]{1,2}(?:[:-][\da-f]{1,2}){5}\b/i)?.[0];
    const mac = rawMac ? normalizeMac(rawMac) : null;
    return ip && mac && contains(cidr, ip) && isPrivateIPv4(ip)
      ? [
          {
            ip,
            mac,
            hostname: null,
            vendor: null,
            source: 'neighbor' as const,
            reachable: false,
            role: 'device' as const,
          },
        ]
      : [];
  });
}
export function parseNmap(xml: string, cidr: string): Observation[] {
  if (XMLValidator.validate(xml) !== true) throw new Error('Résultat Nmap XML invalide');
  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    processEntities: false,
    isArray: (name) => ['host', 'address', 'hostname'].includes(name),
  }).parse(xml);
  if (!parsed.nmaprun) throw new Error('Résultat Nmap incomplet');
  return (parsed.nmaprun.host ?? []).flatMap(
    (host: {
      status?: { state: string };
      address?: { addrtype: string; addr: string; vendor?: string }[];
      hostnames?: { hostname?: { name: string }[] };
    }) => {
      const ip = host.address?.find((a) => a.addrtype === 'ipv4')?.addr;
      const mac = host.address?.find((a) => a.addrtype === 'mac');
      return host.status?.state === 'up' && ip && contains(cidr, ip)
        ? [
            {
              ip,
              mac: mac ? normalizeMac(mac.addr) : null,
              hostname: host.hostnames?.hostname?.[0]?.name ?? null,
              vendor: mac?.vendor ?? null,
              source: 'nmap' as const,
              reachable: true,
              role: 'device' as const,
            },
          ]
        : [];
    },
  );
}
export interface CollectResult {
  observations: Observation[];
  warnings: string[];
}
export async function collect(
  network: NetworkInterface,
  active: boolean,
  signal: AbortSignal,
): Promise<CollectResult> {
  const warnings: string[] = [];
  const found = new Map<string, Observation>();
  found.set(network.address, {
    ip: network.address,
    mac: normalizeMac(network.mac),
    hostname: hostname(),
    vendor: null,
    source: 'local',
    reachable: true,
    role: 'self',
  });
  const readNeighbors = async () => {
    try {
      const ip = platform() === 'linux' ? await executable('ip') : null;
      const arp = await executable('arp');
      const output = ip
        ? await command(ip, ['-4', 'neigh', 'show', 'dev', network.name], signal)
        : arp
          ? await command(arp, platform() === 'win32' ? ['-a'] : ['-an'], signal)
          : '';
      for (const neighbor of parseNeighbors(output, network.scanCidr)) {
        const existing = found.get(neighbor.ip);
        found.set(
          neighbor.ip,
          existing ? { ...neighbor, ...existing, mac: existing.mac ?? neighbor.mac } : neighbor,
        );
      }
    } catch {
      if (!signal.aborted) warnings.push('Table des voisins indisponible.');
    }
  };
  await readNeighbors();
  if (active) {
    const nmap = await executable('nmap');
    let usePing = !nmap;
    if (nmap) {
      try {
        const output = await command(
          nmap,
          [
            '-sn',
            '-n',
            '--unprivileged',
            '--max-retries',
            '1',
            '--host-timeout',
            '3s',
            '-oX',
            '-',
            network.scanCidr,
          ],
          signal,
          90000,
        );
        for (const observation of parseNmap(output, network.scanCidr)) {
          const existing = found.get(observation.ip);
          found.set(observation.ip, {
            ...observation,
            mac: observation.mac ?? existing?.mac ?? null,
            role: existing?.role ?? observation.role,
            hostname: observation.hostname ?? existing?.hostname ?? null,
          });
        }
      } catch {
        if (!signal.aborted) {
          warnings.push('Nmap indisponible pendant la collecte ; repli sur ICMP.');
          usePing = true;
        }
      }
    }
    if (usePing && !signal.aborted) {
      const ping = await executable('ping');
      if (ping) {
        const queue = hosts(network.scanCidr).filter((ip) => ip !== network.address);
        await Promise.all(
          Array.from({ length: 12 }, async () => {
            while (queue.length && !signal.aborted) {
              const ip = queue.shift()!;
              try {
                await command(
                  ping,
                  platform() === 'win32' ? ['-n', '1', '-w', '900', ip] : ['-n', '-c', '1', ip],
                  signal,
                  1400,
                );
                const existing = found.get(ip);
                found.set(ip, {
                  ip,
                  mac: existing?.mac ?? null,
                  hostname: existing?.hostname ?? null,
                  vendor: existing?.vendor ?? null,
                  source: 'ping',
                  reachable: true,
                  role: existing?.role ?? 'device',
                });
              } catch {
                /* Silence and filtering are not proof that a device is switched off. */
              }
            }
          }),
        );
        warnings.push('Découverte ICMP : les appareils silencieux peuvent ne pas répondre.');
      } else warnings.push('Aucun outil de découverte active disponible.');
    }
    await readNeighbors();
  }
  if (signal.aborted) throw new DOMException('Collecte annulée', 'AbortError');
  for (const observation of found.values()) {
    if (observation.ip === network.gateway && observation.role !== 'self')
      observation.role = 'gateway';
  }
  let observations = [...found.values()];
  if (active) {
    const discovery = await discoverServices(network, signal);
    observations = enrichObservations(observations, discovery.services);
    warnings.push(...discovery.warnings);
  }
  return { observations, warnings: [...new Set(warnings)] };
}
