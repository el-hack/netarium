export const categories = ['unknown', 'computer', 'phone', 'media', 'storage', 'iot', 'network'] as const;
export type Category = typeof categories[number];
export type EvidenceSource = 'local' | 'neighbor' | 'ping' | 'nmap';
export interface NetworkInterface {
  id: string; name: string; address: string; mac: string; cidr: string; scanCidr: string; gateway: string | null;
}
export interface Observation {
  ip: string; mac: string | null; hostname: string | null; vendor: string | null;
  source: EvidenceSource; reachable: boolean; role: 'self' | 'gateway' | 'device';
}
export interface Device extends Observation {
  id: string; network: string; label: string; category: Category; notes: string;
  firstSeen: string; lastSeen: string; observedAt: string; scanId: string;
  status: 'observed' | 'cached' | 'unseen';
}
export interface Scan {
  id: string; interfaceId: string; network: string; startedAt: string; finishedAt: string | null;
  status: 'running' | 'complete' | 'failed' | 'cancelled'; mode: 'discovery' | 'passive';
  count: number; error: string | null; warnings: string[];
}
export interface Snapshot { scan: Scan; devices: Device[] }
export interface Settings { intervalMinutes: number; retentionDays: number; interfaceId: string | null }
export interface Capabilities { platform: string; nmap: boolean; ping: boolean; neighbor: boolean; dataDirectory: string; version: string }
export interface Overview {
  devices: Device[]; scans: Scan[]; interfaces: NetworkInterface[]; settings: Settings;
  capabilities: Capabilities; activeScan: Scan | null;
}
export interface Comparison { added: Device[]; missing: Device[]; changed: {before: Device; after: Device}[] }
export function compareSnapshots(before: Device[], after: Device[]): Comparison {
  const old = new Map(before.map(device => [device.id, device]));
  const current = new Map(after.map(device => [device.id, device]));
  return {
    added: after.filter(device => !old.has(device.id)),
    missing: before.filter(device => !current.has(device.id)),
    changed: after.flatMap(device => {
      const previous = old.get(device.id);
      return previous && ['ip', 'hostname', 'mac', 'reachable', 'source', 'role'].some(key => previous[key as keyof Device] !== device[key as keyof Device])
        ? [{before: previous, after: device}] : [];
    }),
  };
}
