import { allocatePositions } from '../../shared/layout.js';
import { randomUUID, createHash } from 'node:crypto';
import type { ActivityQuery, ActivityRecord, SourceState } from '../../shared/activity.js';
import { blankRecord } from '../../shared/activity.js';
import type { NetworkInterface } from '../../shared/types.js';
import { Store } from '../store.js';
import { IntelligenceStore } from './store.js';
import { counterDelta, readCounters, readConnections, type Counter } from './collectors.js';
export class IntelligenceService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private counters = new Map<string, Counter>();
  private configuration: Promise<void> = Promise.resolve();
  private closed = false;
  private consent = { interface: false, agent: false };
  get thresholdMbps() {
    return this.database.threshold();
  }
  set thresholdMbps(value: number) {
    this.database.threshold(value);
  }
  constructor(
    public database: IntelligenceStore,
    private inventory: Store,
    private interfaces: () => Promise<NetworkInterface[]>,
    private collectors = { readCounters, readConnections },
  ) {
    for (const source of database.sources())
      if (source.enabled && ['interface', 'agent'].includes(source.id))
        database.source({ ...source, enabled: false, error: null });
  }
  private source(id: 'interface' | 'agent', error: string | null = null, synced = false) {
    const previous = this.database.sources().find((s) => s.id === id);
    this.database.source({
      id,
      kind: id,
      name: id === 'agent' ? 'Agent local · processus' : 'Compteurs d’interface',
      enabled: this.consent[id],
      lastSync: synced ? new Date().toISOString() : (previous?.lastSync ?? null),
      error,
      scope: 'Cet ordinateur uniquement',
    });
  }
  configure(kind: 'interface' | 'agent', enabled: boolean) {
    this.configuration = this.configuration
      .catch(() => {})
      .then(() => this.applyConfiguration(kind, enabled));
    return this.configuration;
  }
  private async applyConfiguration(kind: 'interface' | 'agent', enabled: boolean) {
    if (this.closed) throw new Error('Service arrêté');
    this.consent[kind] = enabled;
    this.source(kind);
    if (!enabled) this.counters.clear();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.controller?.abort();
    await this.running;
    if (this.consent.interface || this.consent.agent) {
      this.timer = setInterval(() => void this.sample(), 10000);
      this.timer.unref();
      await this.sample();
    }
  }
  async sample() {
    if (this.running) return this.running;
    const controller = new AbortController();
    this.controller = controller;
    this.running = (async () => {
      const networks = await this.interfaces();
      const devices = this.inventory.devices();
      if (
        !networks.some((n) =>
          devices.some((d) => d.role === 'self' && d.ip === n.address && d.network === n.scanCidr),
        )
      )
        throw new Error('Lancez une découverte de cet ordinateur avant la collecte.');
      for (const kind of ['interface', 'agent'] as const) {
        if (!this.consent[kind] || controller.signal.aborted) continue;
        try {
          const records: ActivityRecord[] = [];
          const timestamp = new Date().toISOString();
          if (kind === 'interface')
            for (const network of networks) {
              const device = devices.find(
                (d) =>
                  d.role === 'self' && d.ip === network.address && d.network === network.scanCidr,
              );
              if (!device) continue;
              const counter = await this.collectors.readCounters(network.name, controller.signal);
              const previous = this.counters.get(network.id);
              this.counters.set(network.id, counter);
              const delta = previous ? counterDelta(previous, counter) : null;
              const record = blankRecord(randomUUID(), device.id, 'bandwidth', timestamp, {
                sourceId: kind,
                sourceKind: kind,
                collectedAt: timestamp,
                precision: 'sample',
                confidence: 'high',
                expiresAt: new Date(Date.now() + 30000).toISOString(),
              });
              if (delta) {
                Object.assign(record, delta);
                record.endAt = new Date(counter.time).toISOString();
                record.timestamp = new Date(previous!.time).toISOString();
              }
              record.localIp = device.ip;
              record.detail = `Interface ${network.name} · ${delta ? 'intervalle mesuré' : 'point de référence, débit indisponible'}`;
              records.push(record);
              if (delta && Math.max(delta.rateIn, delta.rateOut) > this.thresholdMbps * 1e6)
                this.database.alert({
                  id: `bandwidth:${device.id}:${timestamp.slice(0, 13)}`,
                  deviceId: device.id,
                  timestamp,
                  severity: 'warning',
                  title: 'Seuil de trafic dépassé',
                  explanation: `Débit observé supérieur à ${this.thresholdMbps} Mbit/s sur cet ordinateur. Ce seuil ne constitue pas une détection d’attaque.`,
                  sourceId: kind,
                  status: 'open',
                  mutedUntil: null,
                });
            }
          else {
            const connections = await this.collectors.readConnections(controller.signal);
            for (const c of connections) {
              const network = networks.find((n) => n.address === c.localIp);
              const device = network
                ? devices.find(
                    (d) =>
                      d.role === 'self' &&
                      d.ip === network.address &&
                      d.network === network.scanCidr,
                  )
                : undefined;
              if (!device) continue;
              const record = blankRecord(randomUUID(), device.id, 'connection', timestamp, {
                sourceId: kind,
                sourceKind: kind,
                collectedAt: timestamp,
                precision: 'sample',
                confidence: 'high',
                expiresAt: new Date(Date.now() + 30000).toISOString(),
              });
              Object.assign(record, c);
              record.detail = 'Socket observé par lsof ; début réel et volume inconnus.';
              records.push(record);
            }
          }
          if (controller.signal.aborted) break;
          this.database.ingest(records);
          this.source(kind, null, true);
        } catch (error) {
          if (!controller.signal.aborted) {
            this.source(kind, (error as Error).message);
            this.database.alert({
              id: `collector:${kind}:${new Date().toISOString().slice(0, 13)}`,
              deviceId: '',
              timestamp: new Date().toISOString(),
              severity: 'warning',
              title: 'Collecteur indisponible',
              explanation: `${kind} : ${(error as Error).message}`,
              sourceId: kind,
              status: 'open',
              mutedUntil: null,
            });
          }
        }
      }
      this.database.prune(this.inventory.settings().retentionDays);
    })()
      .catch((error) => {
        if (!controller.signal.aborted)
          for (const kind of ['interface', 'agent'] as const)
            if (this.consent[kind]) this.source(kind, (error as Error).message);
      })
      .finally(() => {
        this.running = null;
        this.controller = null;
      });
    return this.running;
  }
  ensureLayout() {
    const existing = this.database.positions();
    const devices = this.inventory.devices();
    for (const network of new Set(devices.map((d) => d.network))) {
      const positions = allocatePositions(
        devices.filter((d) => d.network === network).map((d) => d.id),
        existing,
      );
      for (const [id, p] of Object.entries(positions))
        if (!existing[id]) this.database.position(id, p.x, p.y);
    }
    return this.database.positions();
  }
  syncDiscovery() {
    const scans = this.inventory
      .scans()
      .filter((s) => s.status === 'complete')
      .reverse();
    if (scans.every((scan) => this.database.hasScan(scan.id))) {
      this.database.prune(this.inventory.settings().retentionDays);
      return;
    }
    const previous = new Map<string, ReturnType<Store['devices']>>();
    const known = new Map<string, ReturnType<Store['devices']>[number]>();
    for (const scan of scans) {
      const snapshot = this.inventory.snapshot(scan.id);
      if (!snapshot) continue;
      const before = previous.get(scan.network);
      previous.set(scan.network, snapshot.devices);
      if (this.database.hasScan(scan.id)) {
        for (const d of snapshot.devices) known.set(d.id, d);
        continue;
      }
      const records = snapshot.devices.map((device) => {
        const old = known.get(device.id);
        const newServices = (device.services ?? []).filter(
          (s) => !old?.services?.some((v) => v.type === s.type && v.host === s.host),
        );
        const record = blankRecord(
          `${scan.id}:${device.id}`,
          device.id,
          'discovery',
          scan.finishedAt!,
          {
            sourceId: 'discovery',
            sourceKind: 'discovery',
            collectedAt: scan.finishedAt!,
            precision: 'observed',
            confidence: device.reachable ? 'high' : 'low',
            expiresAt: null,
          },
        );
        record.localIp = device.ip;
        record.state = old ? 'observed' : 'first-seen';
        record.detail = !old
          ? 'Première observation conservée'
          : old.ip !== device.ip
            ? `Adresse modifiée : ${old.ip} → ${device.ip}`
            : 'Appareil revu lors de la collecte';
        if (old && newServices.length)
          record.detail += ` · Nouveaux services annoncés : ${newServices.map((s) => s.type).join(', ')}`;
        if (!old || old.ip !== device.ip || newServices.length)
          this.database.alert({
            id: record.id,
            deviceId: device.id,
            timestamp: record.timestamp,
            severity: 'info',
            title: !old
              ? 'Appareil nouvellement observé'
              : old.ip !== device.ip
                ? 'Changement d’adresse observé'
                : 'Nouveau service annoncé',
            explanation: record.detail + '. Une observation ne prouve pas une menace.',
            sourceId: 'discovery',
            status: 'open',
            mutedUntil: null,
          });
        return record;
      });
      for (const d of before ?? [])
        if (!snapshot.devices.some((current) => current.id === d.id)) {
          const record = blankRecord(
            `${scan.id}:missing:${d.id}`,
            d.id,
            'discovery',
            scan.finishedAt!,
            {
              sourceId: 'discovery',
              sourceKind: 'discovery',
              collectedAt: scan.finishedAt!,
              precision: 'observed',
              confidence: 'high',
              expiresAt: null,
            },
          );
          record.localIp = d.ip;
          record.state = 'not-observed';
          record.detail =
            'Appareil absent de ce relevé ; une absence ne prouve pas une déconnexion.';
          records.push(record);
        }
      for (const d of snapshot.devices) known.set(d.id, d);
      this.database.ingest(records);
      this.database.markScan(scan.id);
    }
    this.database.prune(this.inventory.settings().retentionDays);
  }
  query(query: ActivityQuery) {
    this.syncDiscovery();
    this.ensureLayout();
    return {
      ...this.database.query(query),
      sources: this.sources(),
      alerts: this.database.alerts(),
      coverage: this.database.coverage(),
      thresholdMbps: this.thresholdMbps,
    };
  }
  sources(): SourceState[] {
    const stored = this.database.sources();
    const latest = this.inventory.scans().find((s) => s.status === 'complete');
    return [
      {
        id: 'discovery',
        kind: 'discovery',
        name: 'Local Discovery',
        enabled: true,
        lastSync: latest?.finishedAt ?? null,
        error: null,
        scope: 'Périmètre IPv4 sélectionné',
      },
      ...(['interface', 'agent', 'dns-import', 'flow-import'] as const).map(
        (id) =>
          stored.find((s) => s.id === id) ?? {
            id,
            kind: id,
            name: {
              interface: 'Compteurs d’interface',
              agent: 'Agent local · processus',
              'dns-import': 'Import DNS',
              'flow-import': 'Import de flux',
            }[id],
            enabled: false,
            lastSync: null,
            error: null,
            scope: id.endsWith('import')
              ? 'Appareil associé explicitement'
              : 'Cet ordinateur uniquement',
          },
      ),
    ];
  }
  import(
    deviceId: string,
    kind: 'dns' | 'flow',
    rows: Omit<ActivityRecord, 'id' | 'deviceId' | 'source' | 'kind'>[],
  ) {
    if (!this.inventory.devices().some((d) => d.id === deviceId))
      throw new Error('Appareil inconnu');
    const time = new Date().toISOString();
    const sourceId: 'dns-import' | 'flow-import' = kind === 'dns' ? 'dns-import' : 'flow-import';
    const records = rows.map((row) => ({
      ...row,
      id: createHash('sha256')
        .update(JSON.stringify([sourceId, deviceId, row]))
        .digest('hex'),
      deviceId,
      kind: kind === 'dns' ? ('dns' as const) : ('connection' as const),
      source: {
        sourceId,
        sourceKind: sourceId,
        collectedAt: time,
        precision: 'reported' as const,
        confidence: 'medium' as const,
        expiresAt: null,
      },
    }));
    const inserted = this.database.ingest(records);
    this.database.source({
      id: sourceId,
      kind: sourceId,
      name: kind === 'dns' ? 'Import DNS' : 'Import de flux',
      enabled: true,
      lastSync: time,
      error: null,
      scope: 'Appareil associé explicitement',
    });
    for (const record of records)
      if (record.domain)
        this.database.alert({
          id: `domain:${deviceId}:${record.domain}`,
          deviceId,
          timestamp: record.timestamp,
          severity: 'info',
          title: 'Domaine nouvellement importé',
          explanation: `${record.domain} : observation DNS déclarée. Ne prouve pas une visite volontaire.`,
          sourceId,
          status: 'open',
          mutedUntil: null,
        });
    return inserted;
  }
  async close() {
    this.closed = true;
    this.controller?.abort();
    await this.configuration.catch(() => {});
    if (this.timer) clearInterval(this.timer);
    this.controller?.abort();
    await this.running;
    this.database.close();
  }
}
