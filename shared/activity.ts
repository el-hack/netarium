export type ActivityKind = 'connection' | 'dns' | 'bandwidth' | 'discovery';
export type SourceKind = 'discovery' | 'interface' | 'agent' | 'dns-import' | 'flow-import';
export interface Provenance {
  sourceId: string;
  sourceKind: SourceKind;
  collectedAt: string;
  precision: 'sample' | 'reported' | 'observed';
  confidence: 'high' | 'medium' | 'low';
  expiresAt: string | null;
}
export interface ActivityRecord {
  id: string;
  deviceId: string;
  kind: ActivityKind;
  timestamp: string;
  endAt: string | null;
  source: Provenance;
  localIp: string | null;
  remoteIp: string | null;
  localPort: number | null;
  remotePort: number | null;
  protocol: string | null;
  process: string | null;
  pid: number | null;
  domain: string | null;
  bytesIn: number | null;
  bytesOut: number | null;
  rateIn: number | null;
  rateOut: number | null;
  state: string;
  detail: string;
}
export interface SourceState {
  id: string;
  kind: SourceKind;
  name: string;
  enabled: boolean;
  lastSync: string | null;
  error: string | null;
  scope: string;
}
export interface NetworkAlert {
  id: string;
  deviceId: string;
  timestamp: string;
  severity: 'info' | 'warning';
  title: string;
  explanation: string;
  sourceId: string;
  status: 'open' | 'acknowledged';
  mutedUntil: string | null;
}
export interface Intelligence {
  records: ActivityRecord[];
  total: number;
  truncated: boolean;
  sources: SourceState[];
  alerts: NetworkAlert[];
  coverage: { deviceId: string; source: string; count: number; lastSeen: string }[];
  thresholdMbps: number;
}
export interface ActivityQuery {
  deviceId?: string;
  deviceIds?: string[];
  kind?: ActivityKind;
  since?: string;
  until?: string;
  search?: string;
  protocol?: string;
  source?: SourceKind;
  remotePort?: number;
  offset?: number;
  limit?: number;
}
export function blankRecord(
  id: string,
  deviceId: string,
  kind: ActivityKind,
  timestamp: string,
  source: Provenance,
): ActivityRecord {
  return {
    id,
    deviceId,
    kind,
    timestamp,
    source,
    endAt: null,
    localIp: null,
    remoteIp: null,
    localPort: null,
    remotePort: null,
    protocol: null,
    process: null,
    pid: null,
    domain: null,
    bytesIn: null,
    bytesOut: null,
    rateIn: null,
    rateOut: null,
    state: 'observed',
    detail: '',
  };
}
export function activitySummary(records: ActivityRecord[]) {
  const bandwidth = records.filter((r) => r.kind === 'bandwidth');
  const incoming = bandwidth.filter((r) => r.bytesIn !== null);
  const outgoing = bandwidth.filter((r) => r.bytesOut !== null);
  return {
    connections: records.filter((r) => r.kind === 'connection').length,
    domains: new Set(records.filter((r) => r.domain).map((r) => r.domain)).size,
    applications: new Set(
      records.filter((r) => r.source.sourceKind === 'agent' && r.process).map((r) => r.process),
    ).size,
    bytesIn: incoming.length ? incoming.reduce((n, r) => n + r.bytesIn!, 0) : null,
    bytesOut: outgoing.length ? outgoing.reduce((n, r) => n + r.bytesOut!, 0) : null,
    latestBandwidth: bandwidth[0] ?? null,
  };
}
export interface Analytics {
  bandwidth: {
    deviceId: string;
    bytesIn: number | null;
    bytesOut: number | null;
    peakIn: number | null;
    peakOut: number | null;
    intervals: number;
    seconds: number;
    first: string;
    last: string;
  }[];
  flows: {
    deviceId: string;
    protocol: string | null;
    observations: number;
    bytesIn: number | null;
    bytesOut: number | null;
  }[];
  domains: { domain: string; observations: number }[];
}
