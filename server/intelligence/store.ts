import { DatabaseSync } from 'node:sqlite';
import type {
  ActivityQuery,
  ActivityRecord,
  NetworkAlert,
  SourceState,
} from '../../shared/activity.js';
export class IntelligenceStore {
  private db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
 CREATE TABLE IF NOT EXISTS intelligence_migrations(version INTEGER PRIMARY KEY);
 CREATE TABLE IF NOT EXISTS activity(source TEXT NOT NULL,id TEXT NOT NULL,device TEXT NOT NULL,kind TEXT NOT NULL,time TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(source,id));
 CREATE INDEX IF NOT EXISTS activity_device_time ON activity(device,time DESC);
 CREATE INDEX IF NOT EXISTS activity_time ON activity(time DESC);
 CREATE TABLE IF NOT EXISTS alerts(id TEXT PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS source_state(id TEXT PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS positions(device TEXT PRIMARY KEY,x REAL NOT NULL,y REAL NOT NULL);
 CREATE TABLE IF NOT EXISTS intelligence_config(key TEXT PRIMARY KEY,value REAL NOT NULL);
 CREATE TABLE IF NOT EXISTS processed_scans(id TEXT PRIMARY KEY);
 INSERT OR IGNORE INTO intelligence_migrations VALUES(1);`);
  }
  ingest(records: ActivityRecord[]) {
    this.db.exec('BEGIN IMMEDIATE');
    let count = 0;
    try {
      const insert = this.db.prepare(
        'INSERT OR IGNORE INTO activity(source,id,device,kind,time,data) VALUES(?,?,?,?,?,?)',
      );
      for (const r of records)
        count += Number(
          insert.run(r.source.sourceId, r.id, r.deviceId, r.kind, r.timestamp, JSON.stringify(r))
            .changes,
        );
      this.db.exec('COMMIT');
      return count;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  query(query: ActivityQuery) {
    const where: string[] = [];
    const values: (string | number)[] = [];
    for (const [column, value] of [
      ['device', query.deviceId],
      ['kind', query.kind],
    ] as const)
      if (value) {
        where.push(`${column}=?`);
        values.push(value);
      }
    if (query.deviceIds) {
      where.push(
        query.deviceIds.length ? `device IN (${query.deviceIds.map(() => '?').join(',')})` : '0',
      );
      values.push(...query.deviceIds);
    }
    for (const [column, value] of [
      ["json_extract(data,'$.protocol')", query.protocol],
      ['source', query.source],
      ["json_extract(data,'$.remotePort')", query.remotePort],
    ] as const) {
      if (value !== undefined) {
        where.push(`${column}=?`);
        values.push(value);
      }
    }
    if (query.since) {
      where.push('time>=?');
      values.push(query.since);
    }
    if (query.until) {
      where.push('time<=?');
      values.push(query.until);
    }
    if (query.search) {
      where.push(
        "(json_extract(data,'$.domain') LIKE ? ESCAPE '\\' OR json_extract(data,'$.process') LIKE ? ESCAPE '\\' OR json_extract(data,'$.remoteIp') LIKE ? ESCAPE '\\' OR json_extract(data,'$.detail') LIKE ? ESCAPE '\\')",
      );
      const term = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`;
      values.push(term, term, term, term);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = Number(
      (
        this.db.prepare(`SELECT COUNT(*) AS n FROM activity ${clause}`).get(...values) as {
          n: number;
        }
      ).n,
    );
    const limit = Math.min(1000, Math.max(1, query.limit ?? 200));
    const offset = Math.max(0, query.offset ?? 0);
    const rows = this.db
      .prepare(`SELECT data FROM activity ${clause} ORDER BY time DESC,source,id LIMIT ? OFFSET ?`)
      .all(...values, limit, offset) as { data: string }[];
    return {
      records: rows.map((row) => JSON.parse(row.data) as ActivityRecord),
      total,
      truncated: total > limit + offset,
    };
  }
  alert(alert: NetworkAlert) {
    this.db
      .prepare('INSERT OR IGNORE INTO alerts(id,data) VALUES(?,?)')
      .run(alert.id, JSON.stringify(alert));
  }
  alerts() {
    return (
      this.db
        .prepare("SELECT data FROM alerts ORDER BY json_extract(data,'$.timestamp') DESC LIMIT 500")
        .all() as { data: string }[]
    ).map((r) => JSON.parse(r.data) as NetworkAlert);
  }
  updateAlert(id: string, status: NetworkAlert['status'], mutedUntil: string | null) {
    return this.db
      .prepare("UPDATE alerts SET data=json_set(data,'$.status',?,'$.mutedUntil',?) WHERE id=?")
      .run(status, mutedUntil, id).changes;
  }
  source(source: SourceState) {
    this.db
      .prepare(
        'INSERT INTO source_state(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
      )
      .run(source.id, JSON.stringify(source));
  }
  sources() {
    return (this.db.prepare('SELECT data FROM source_state').all() as { data: string }[]).map(
      (r) => JSON.parse(r.data) as SourceState,
    );
  }
  hasScan(id: string) {
    return Boolean(this.db.prepare('SELECT id FROM processed_scans WHERE id=?').get(id));
  }
  markScan(id: string) {
    this.db.prepare('INSERT OR IGNORE INTO processed_scans VALUES(?)').run(id);
  }
  positions() {
    return Object.fromEntries(
      (
        this.db.prepare('SELECT device,x,y FROM positions').all() as {
          device: string;
          x: number;
          y: number;
        }[]
      ).map((r) => [r.device, { x: r.x, y: r.y }]),
    );
  }
  position(id: string, x: number, y: number) {
    this.db
      .prepare(
        'INSERT INTO positions VALUES(?,?,?) ON CONFLICT(device) DO UPDATE SET x=excluded.x,y=excluded.y',
      )
      .run(id, x, y);
  }
  prune(days: number) {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    this.db.prepare('DELETE FROM activity WHERE time<?').run(cutoff);
    this.db.prepare("DELETE FROM alerts WHERE json_extract(data,'$.timestamp')<?").run(cutoff);
  }
  clear() {
    this.db.exec('DELETE FROM activity; DELETE FROM alerts;');
  }
  coverage() {
    return this.db
      .prepare(
        "SELECT device AS deviceId,source,COUNT(*) AS count,MAX(time) AS lastSeen FROM activity WHERE source!='interface' OR json_extract(data,'$.rateIn') IS NOT NULL GROUP BY device,source",
      )
      .all() as { deviceId: string; source: string; count: number; lastSeen: string }[];
  }
  threshold(value?: number) {
    if (value !== undefined)
      this.db
        .prepare(
          "INSERT INTO intelligence_config VALUES('threshold',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        )
        .run(value);
    return (
      (
        this.db.prepare("SELECT value FROM intelligence_config WHERE key='threshold'").get() as
          { value: number } | undefined
      )?.value ?? 100
    );
  }
  analytics(since: string, until: string, ids: string[]) {
    const placeholders = ids.map(() => '?').join(',');
    const where = `time>=? AND time<? AND device IN (${placeholders || 'NULL'})`;
    const values = [since, until, ...ids];
    return {
      bandwidth: this.db
        .prepare(
          `SELECT device AS deviceId,SUM(json_extract(data,'$.bytesIn')) AS bytesIn,SUM(json_extract(data,'$.bytesOut')) AS bytesOut,MAX(json_extract(data,'$.rateIn')) AS peakIn,MAX(json_extract(data,'$.rateOut')) AS peakOut,COUNT(json_extract(data,'$.rateIn')) AS intervals,COALESCE(SUM(CASE WHEN json_extract(data,'$.rateIn') IS NOT NULL THEN (julianday(json_extract(data,'$.endAt'))-julianday(time))*86400 ELSE 0 END),0) AS seconds,MIN(time) AS first,MAX(time) AS last FROM activity WHERE ${where} AND kind='bandwidth' GROUP BY device`,
        )
        .all(...values),
      flows: this.db
        .prepare(
          `SELECT device AS deviceId,json_extract(data,'$.protocol') AS protocol,COUNT(*) AS observations,SUM(json_extract(data,'$.bytesIn')) AS bytesIn,SUM(json_extract(data,'$.bytesOut')) AS bytesOut FROM activity WHERE ${where} AND source='flow-import' GROUP BY device,json_extract(data,'$.protocol')`,
        )
        .all(...values),
      domains: this.db
        .prepare(
          `SELECT json_extract(data,'$.domain') AS domain,COUNT(*) AS observations FROM activity WHERE ${where} AND kind='dns' GROUP BY json_extract(data,'$.domain') ORDER BY observations DESC LIMIT 20`,
        )
        .all(...values),
    };
  }
  close() {
    this.db.close();
  }
}
