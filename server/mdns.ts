import { EventEmitter } from 'node:events';
import multicastDns from 'multicast-dns';
import { Browser } from 'bonjour-service';
import type { AdvertisedService, NetworkInterface, Observation } from '../shared/types.js';
import { contains, isPrivateIPv4 } from './ipv4.js';
const serviceTypes = [
  'device-info',
  'airplay',
  'raop',
  'googlecast',
  'ipp',
  'ipps',
  'printer',
  'smb',
  'companion-link',
];
export interface ServiceClue {
  ip: string;
  service: AdvertisedService;
}
interface Announcement {
  type?: unknown;
  name?: unknown;
  host?: unknown;
  addresses?: unknown;
  txt?: unknown;
  referer?: { address?: unknown };
}
const text = (value: unknown, limit: number) =>
  typeof value === 'string'
    ? value
        // Strip control characters from untrusted network labels.
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .trim()
        .slice(0, limit)
    : '';
export function normalizeService(input: Announcement, scope: string): ServiceClue[] {
  const sender = input.referer?.address;
  if (typeof sender !== 'string' || !isPrivateIPv4(sender) || !contains(scope, sender)) return [];
  const type = text(input.type, 40).toLowerCase();
  const host = text(input.host, 253).replace(/\.$/, '').toLowerCase();
  if (
    !serviceTypes.includes(type) ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+local$/i.test(host)
  )
    return [];
  const txt =
    input.txt && typeof input.txt === 'object' ? (input.txt as Record<string, unknown>) : {};
  // Only model hints are retained; TXT may otherwise contain identifiers, URLs or secrets.
  const model = text(txt.model ?? txt.am ?? txt.md, 120) || null;
  const service: AdvertisedService = { type, host, name: text(input.name, 100), model };
  const addresses = Array.isArray(input.addresses) ? input.addresses.slice(0, 16) : [];
  return [...new Set(addresses)].flatMap((ip) =>
    typeof ip === 'string' && isPrivateIPv4(ip) && contains(scope, ip) ? [{ ip, service }] : [],
  );
}
export function enrichObservations(
  observations: Observation[],
  clues: ServiceClue[],
): Observation[] {
  return observations.map((observation) => {
    const services: AdvertisedService[] = [];
    for (const clue of clues)
      if (
        clue.ip === observation.ip &&
        services.length < 16 &&
        !services.some((s) => JSON.stringify(s) === JSON.stringify(clue.service))
      )
        services.push(clue.service);
    return services.length
      ? { ...observation, hostname: observation.hostname ?? services[0].host, services }
      : observation;
  });
}
interface Transport extends EventEmitter {
  query(name: string, type: 'PTR'): void;
  destroy(callback: () => void): void;
}
interface DiscoveryOptions {
  durationMs?: number;
  createTransport?: (address: string) => Transport;
}
export async function discoverServices(
  network: NetworkInterface,
  signal: AbortSignal,
  options: DiscoveryOptions = {},
): Promise<{ services: ServiceClue[]; warnings: string[] }> {
  signal.throwIfAborted();
  if (!isPrivateIPv4(network.address) || !contains(network.scanCidr, network.address))
    throw new Error('Périmètre mDNS invalide');
  const createTransport =
    options.createTransport ??
    ((address: string) => multicastDns({ interface: address, bind: '0.0.0.0', type: 'udp4' }));
  return new Promise((resolve, reject) => {
    let transport: Transport | undefined;
    const browsers: Browser[] = [];
    const services: ServiceClue[] = [];
    let received = 0,
      done = false;
    const timer = setTimeout(
      () => finish(),
      Math.min(5000, Math.max(1, options.durationMs ?? 3500)),
    );
    const abort = () => finish(undefined, true);
    function finish(warning?: string, aborted = false) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      browsers.forEach((browser) => browser.stop());
      const settle = () =>
        aborted
          ? reject(new DOMException('Collecte annulée', 'AbortError'))
          : resolve({ services, warnings: warning ? [warning] : [] });
      if (transport) {
        try {
          transport.destroy(settle);
        } catch {
          settle();
        }
      } else settle();
    }
    signal.addEventListener('abort', abort, { once: true });
    try {
      transport = createTransport(network.address);
      const unavailable = () =>
        finish('Identification Bonjour/mDNS indisponible pour cette collecte.');
      transport.on('error', unavailable);
      transport.on('warning', unavailable);
      for (const type of serviceTypes) {
        if (done) break;
        browsers.push(
          new Browser(transport, { type }, (service) => {
            if (done) return;
            services.push(...normalizeService(service, network.scanCidr));
            if (++received >= 128)
              finish('Identification mDNS limitée à 128 annonces pour cette collecte.');
          }),
        );
      }
      if (signal.aborted) abort();
    } catch {
      finish('Identification Bonjour/mDNS indisponible pour cette collecte.');
    }
  });
}
