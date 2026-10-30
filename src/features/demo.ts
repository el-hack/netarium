import type { Overview } from '../../shared/types';
import { blankRecord, type Intelligence, type ActivityRecord } from '../../shared/activity';
const now = Date.now();
const iso = (minutes = 0) => new Date(now - minutes * 60000).toISOString();
export const demoOverview: Overview = {
  interfaces: [
    {
      id: 'demo-lan',
      name: 'LAN simulé',
      address: '192.168.50.10',
      mac: '02:00:00:00:00:10',
      cidr: '192.168.50.0/24',
      scanCidr: '192.168.50.0/24',
      gateway: '192.168.50.1',
    },
  ],
  devices: [
    ['gateway', 'Box du salon', 'network', '192.168.50.1', 'gateway'],
    ['studio', 'MacBook Studio', 'computer', '192.168.50.10', 'self'],
    ['phone', 'Téléphone personnel', 'phone', '192.168.50.21', 'device'],
    ['nas', 'Archive familiale', 'storage', '192.168.50.30', 'device'],
    ['tv', 'Écran du salon', 'media', '192.168.50.40', 'device'],
    ['printer', 'Imprimante bureau', 'printer', '192.168.50.51', 'device'],
  ].map(([id, label, category, ip, role], i) => ({
    id: `demo-${id}`,
    label,
    category,
    ip,
    role,
    network: '192.168.50.0/24',
    mac: `02:00:00:00:00:${10 + i}`,
    hostname: `${id}.local`,
    vendor: null,
    notes: 'Données simulées pour explorer Netarium.',
    source: role === 'self' ? 'local' : 'ping',
    reachable: i !== 5,
    status: i === 5 ? 'unseen' : 'observed',
    firstSeen: iso(1440),
    lastSeen: iso(i === 5 ? 120 : 1),
    observedAt: iso(1),
    scanId: 'demo-scan',
  })) as Overview['devices'],
  scans: [
    {
      id: 'demo-scan',
      interfaceId: 'demo-lan',
      network: '192.168.50.0/24',
      startedAt: iso(2),
      finishedAt: iso(1),
      status: 'complete',
      mode: 'discovery',
      count: 6,
      error: null,
      warnings: [],
    },
  ],
  settings: { interfaceId: 'demo-lan', intervalMinutes: 0, retentionDays: 30 },
  capabilities: {
    platform: 'simulation',
    nmap: false,
    ping: true,
    neighbor: true,
    dataDirectory: 'Mémoire du navigateur · données simulées',
    version: '0.2.0',
  },
  activeScan: null,
};
const records: ActivityRecord[] = [];
for (let i = 0; i < 60; i++) {
  const t = new Date(now - (60 - i) * 10000).toISOString();
  const r = blankRecord(`demo-bw-${i}`, 'demo-studio', 'bandwidth', t, {
    sourceId: 'interface',
    sourceKind: 'interface',
    collectedAt: t,
    precision: 'sample',
    confidence: 'high',
    expiresAt: iso(-1),
  });
  r.rateIn = (4 + Math.sin(i * 0.4) * 2 + (i > 30 && i < 42 ? 10 : 0)) * 1e6;
  r.rateOut = (1 + Math.cos(i * 0.35) * 0.5) * 1e6;
  r.bytesIn = (r.rateIn * 10) / 8;
  r.bytesOut = (r.rateOut * 10) / 8;
  r.endAt = new Date(Date.parse(t) + 10000).toISOString();
  r.detail = 'Échantillon d’interface simulé';
  records.push(r);
}
for (const [i, domain] of [
  'github.com',
  'example.org',
  'npmjs.com',
  'developer.mozilla.org',
  'example.net',
].entries()) {
  const r = blankRecord(`demo-dns-${i}`, 'demo-studio', 'dns', iso(i + 2), {
    sourceId: 'dns-import',
    sourceKind: 'dns-import',
    collectedAt: iso(0),
    precision: 'reported',
    confidence: 'medium',
    expiresAt: null,
  });
  r.domain = domain;
  r.detail = 'Observation DNS simulée';
  records.push(r);
}
for (const [i, process] of ['Firefox', 'Code', 'node', 'Firefox', 'Music', 'Code'].entries()) {
  const r = blankRecord(`demo-connection-${i}`, 'demo-studio', 'connection', iso(i * 0.3), {
    sourceId: 'agent',
    sourceKind: 'agent',
    collectedAt: iso(i * 0.3),
    precision: 'sample',
    confidence: 'high',
    expiresAt: iso(-1),
  });
  Object.assign(r, {
    process,
    pid: 1200 + i,
    localIp: '192.168.50.10',
    remoteIp: `203.0.113.${10 + i}`,
    localPort: 51000 + i,
    remotePort: 443,
    protocol: 'TCP',
    state: 'ESTABLISHED',
    detail: 'Socket simulé',
  });
  records.push(r);
}
for (const d of demoOverview.devices) {
  const r = blankRecord(`demo-discovery-${d.id}`, d.id, 'discovery', iso(1), {
    sourceId: 'discovery',
    sourceKind: 'discovery',
    collectedAt: iso(1),
    precision: 'observed',
    confidence: 'high',
    expiresAt: null,
  });
  r.localIp = d.ip;
  r.detail = 'Appareil observé · simulation';
  records.push(r);
}
records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
export const demoIntelligence: Intelligence = {
  records,
  total: records.length,
  truncated: false,
  thresholdMbps: 100,
  coverage: [...new Set(records.map((r) => `${r.deviceId}|${r.source.sourceId}`))].map((key) => {
    const [deviceId, source] = key.split('|');
    const rows = records.filter((r) => r.deviceId === deviceId && r.source.sourceId === source);
    return { deviceId, source, count: rows.length, lastSeen: rows[0].timestamp };
  }),
  sources: (['discovery', 'interface', 'agent', 'dns-import', 'flow-import'] as const).map(
    (kind) => ({
      id: kind,
      kind,
      name: {
        discovery: 'Local Discovery',
        interface: 'Compteurs d’interface',
        agent: 'Agent local · processus',
        'dns-import': 'Import DNS',
        'flow-import': 'Import de flux',
      }[kind],
      enabled: kind !== 'flow-import',
      lastSync: kind === 'flow-import' ? null : iso(0),
      error: null,
      scope: 'Simulation uniquement',
    }),
  ),
  alerts: [
    {
      id: 'demo-alert',
      deviceId: 'demo-studio',
      timestamp: iso(4),
      severity: 'warning',
      title: 'Seuil de trafic dépassé',
      explanation:
        'Exemple simulé : débit supérieur au seuil configuré. Ce signal ne constitue pas une preuve d’attaque.',
      sourceId: 'interface',
      status: 'open',
      mutedUntil: null,
    },
    {
      id: 'demo-new',
      deviceId: 'demo-printer',
      timestamp: iso(40),
      severity: 'info',
      title: 'Appareil nouvellement observé',
      explanation: 'Une nouvelle identité a été observée dans ce périmètre simulé.',
      sourceId: 'discovery',
      status: 'open',
      mutedUntil: null,
    },
  ],
};
