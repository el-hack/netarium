import { identifyDevice } from '../shared/identification.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import type { Category, Device, Observation, Scan, Settings, Snapshot } from '../shared/types.js';
interface DeviceRow {
  id: string;
  network: string;
  ip: string;
  mac: string | null;
  label: string;
  category: Category;
  notes: string;
  tags: string;
  first_seen: string;
  last_seen: string;
  last_data: string;
}
interface ScanRow {
  id: string;
  interface_id: string;
  network: string;
  started_at: string;
  finished_at: string | null;
  status: Scan['status'];
  mode: Scan['mode'];
  count: number;
  error: string | null;
  warnings: string;
}
const scanFromRow = (row: ScanRow): Scan => ({
  id: row.id,
  interfaceId: row.interface_id,
  network: row.network,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  status: row.status,
  mode: row.mode,
  count: row.count,
  error: row.error,
  warnings: JSON.parse(row.warnings),
});
export class Store {
  private readonly db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY, network TEXT NOT NULL, ip TEXT NOT NULL, mac TEXT, label TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'unknown', notes TEXT NOT NULL DEFAULT '', first_seen TEXT NOT NULL, last_seen TEXT NOT NULL, last_data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS devices_network_mac ON devices(network,mac);
      CREATE INDEX IF NOT EXISTS devices_network_ip ON devices(network,ip);
      CREATE TABLE IF NOT EXISTS scans(id TEXT PRIMARY KEY, interface_id TEXT NOT NULL, network TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL, mode TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, error TEXT, warnings TEXT NOT NULL DEFAULT '[]');
      CREATE INDEX IF NOT EXISTS scans_started ON scans(started_at DESC);
      CREATE TABLE IF NOT EXISTS snapshots(scan_id TEXT PRIMARY KEY REFERENCES scans(id) ON DELETE CASCADE, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
      INSERT OR IGNORE INTO migrations(version) VALUES(1);
      INSERT OR IGNORE INTO settings(id,data) VALUES(1,'{"intervalMinutes":0,"retentionDays":30,"interfaceId":null}');`);
    if (!this.db.prepare('SELECT version FROM migrations WHERE version=2').get()) {
      this.db.exec(
        "BEGIN IMMEDIATE; ALTER TABLE devices ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'; INSERT INTO migrations VALUES(2); COMMIT;",
      );
    }
    this.db
      .prepare(
        "UPDATE scans SET status='failed', error='Collecte interrompue par un arrêt de l’application.', finished_at=? WHERE status='running'",
      )
      .run(new Date().toISOString());
  }
  beginScan(interfaceId: string, network: string, mode: Scan['mode']): Scan {
    const scan: Scan = {
      id: randomUUID(),
      interfaceId,
      network,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      status: 'running',
      mode,
      count: 0,
      error: null,
      warnings: [],
    };
    this.db
      .prepare(
        'INSERT INTO scans(id,interface_id,network,started_at,status,mode) VALUES(?,?,?,?,?,?)',
      )
      .run(scan.id, interfaceId, network, scan.startedAt, scan.status, mode);
    return scan;
  }
  private rowDevice(row: DeviceRow): Device {
    const observation = JSON.parse(row.last_data) as Device;
    return {
      ...observation,
      identification: observation.identification ?? identifyDevice(observation),
      id: row.id,
      network: row.network,
      label: row.label,
      category: row.category,
      notes: row.notes,
      tags: JSON.parse(row.tags),
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
    };
  }
  finishScan(id: string, observations: Observation[], warnings: string[]) {
    const scan = this.scan(id);
    if (!scan || scan.status !== 'running') throw new Error('Collecte inactive');
    const now = new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result: Device[] = [];
      // Prefer MAC identity. IP-only identity is provisional, scoped to this subnet.
      for (const observation of observations) {
        let row = observation.mac
          ? (this.db
              .prepare(
                'SELECT * FROM devices WHERE network=? AND mac=? ORDER BY last_seen DESC LIMIT 1',
              )
              .get(scan.network, observation.mac) as DeviceRow | undefined)
          : undefined;
        if (!row) {
          row = this.db
            .prepare(
              `SELECT * FROM devices WHERE network=? AND ip=? ${observation.mac ? 'AND mac IS NULL' : ''} ORDER BY last_seen DESC LIMIT 1`,
            )
            .get(scan.network, observation.ip) as DeviceRow | undefined;
        }
        const device: Device = {
          ...observation,
          identification: identifyDevice(observation),
          mac: observation.mac ?? row?.mac ?? null,
          id: row?.id ?? randomUUID(),
          network: scan.network,
          label: row?.label ?? '',
          category: row?.category ?? 'unknown',
          notes: row?.notes ?? '',
          tags: JSON.parse(row?.tags ?? '[]'),
          firstSeen: row?.first_seen ?? now,
          lastSeen: now,
          observedAt: now,
          scanId: id,
          status: observation.reachable ? 'observed' : 'cached',
        };
        this.db
          .prepare(
            `INSERT INTO devices(id,network,ip,mac,label,category,notes,first_seen,last_seen,last_data) VALUES(?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET ip=excluded.ip,mac=excluded.mac,last_seen=excluded.last_seen,last_data=excluded.last_data`,
          )
          .run(
            device.id,
            device.network,
            device.ip,
            device.mac,
            device.label,
            device.category,
            device.notes,
            device.firstSeen,
            now,
            JSON.stringify(device),
          );
        result.push(device);
      }
      this.db
        .prepare("UPDATE scans SET status='complete',finished_at=?,count=?,warnings=? WHERE id=?")
        .run(now, result.length, JSON.stringify(warnings), id);
      this.db
        .prepare('INSERT INTO snapshots(scan_id,data) VALUES(?,?)')
        .run(id, JSON.stringify(result));
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  failScan(id: string, error: string, cancelled = false) {
    this.db
      .prepare('UPDATE scans SET status=?,finished_at=?,error=? WHERE id=? AND status=?')
      .run(cancelled ? 'cancelled' : 'failed', new Date().toISOString(), error, id, 'running');
  }
  devices(): Device[] {
    const latest = new Map<string, string>();
    for (const row of this.db
      .prepare(
        "SELECT id,network FROM (SELECT id,network,ROW_NUMBER() OVER(PARTITION BY network ORDER BY started_at DESC,rowid DESC) AS rank FROM scans WHERE status='complete') WHERE rank=1",
      )
      .all() as { id: string; network: string }[])
      latest.set(row.network, row.id);
    return (
      this.db
        .prepare('SELECT * FROM devices ORDER BY last_seen DESC,id')
        .all() as unknown as DeviceRow[]
    ).map((row) => {
      const device = this.rowDevice(row);
      return {
        ...device,
        status: latest.get(device.network) === device.scanId ? device.status : 'unseen',
      };
    });
  }
  annotate(
    id: string,
    input: { label: string; category: Category; notes: string; tags?: string[] },
  ): boolean {
    return (
      Number(
        this.db
          .prepare('UPDATE devices SET label=?,category=?,notes=?,tags=COALESCE(?,tags) WHERE id=?')
          .run(
            input.label,
            input.category,
            input.notes,
            input.tags ? JSON.stringify(input.tags) : null,
            id,
          ).changes,
      ) > 0
    );
  }
  deviceHistory(id: string) {
    return this.db
      .prepare(
        "SELECT scans.finished_at AS timestamp,json_extract(item.value,'$.ip') AS ip FROM snapshots JOIN scans ON scans.id=snapshots.scan_id,json_each(snapshots.data) AS item WHERE json_extract(item.value,'$.id')=? ORDER BY scans.started_at DESC LIMIT 200",
      )
      .all(id);
  }
  scan(id: string): Scan | null {
    const row = this.db.prepare('SELECT * FROM scans WHERE id=?').get(id) as ScanRow | undefined;
    return row ? scanFromRow(row) : null;
  }
  scans(limit = 200): Scan[] {
    return (
      this.db
        .prepare('SELECT * FROM scans ORDER BY started_at DESC,rowid DESC LIMIT ?')
        .all(limit) as unknown as ScanRow[]
    ).map(scanFromRow);
  }
  snapshot(id: string): Snapshot | null {
    const row = this.db.prepare('SELECT data FROM snapshots WHERE scan_id=?').get(id) as
      { data: string } | undefined;
    const scan = this.scan(id);
    return row && scan ? { scan, devices: JSON.parse(row.data) } : null;
  }
  settings(): Settings {
    return JSON.parse(
      (this.db.prepare('SELECT data FROM settings WHERE id=1').get() as { data: string }).data,
    );
  }
  saveSettings(settings: Settings) {
    this.db.prepare('UPDATE settings SET data=? WHERE id=1').run(JSON.stringify(settings));
  }
  prune(days: number) {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    // Retain the most recent successful snapshot of each scope even after a long pause.
    this.db
      .prepare(
        "DELETE FROM scans WHERE started_at < ? AND status != 'running' AND id NOT IN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER(PARTITION BY network ORDER BY started_at DESC,rowid DESC) AS rank FROM scans WHERE status='complete') WHERE rank=1)",
      )
      .run(cutoff);
    this.db
      .prepare(
        "DELETE FROM devices WHERE last_seen < ? AND id NOT IN (SELECT json_extract(value,'$.id') FROM snapshots,json_each(snapshots.data))",
      )
      .run(cutoff);
  }
  close() {
    this.db.close();
  }
}
