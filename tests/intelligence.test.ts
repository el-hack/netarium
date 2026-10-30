import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IntelligenceStore } from '../server/intelligence/store.js';
import { blankRecord, activitySummary } from '../shared/activity.js';
const event = (id = 'one') =>
  blankRecord(id, 'device-1', 'dns', '2026-10-30T10:00:00.000Z', {
    sourceId: 'dns-import',
    sourceKind: 'dns-import',
    collectedAt: '2026-10-30T10:01:00.000Z',
    precision: 'reported',
    confidence: 'medium',
    expiresAt: null,
  });
test('ingestion is idempotent by source and event identity, never replacing evidence', () => {
  const store = new IntelligenceStore(':memory:');
  try {
    store.ingest([event(), event()]);
    store.ingest([{ ...event(), domain: 'changed.example' }]);
    assert.equal(store.query({}).total, 1);
    assert.equal(store.query({}).records[0].domain, null);
  } finally {
    store.close();
  }
});
test('activity query preserves device isolation, time boundaries and pagination', () => {
  const store = new IntelligenceStore(':memory:');
  try {
    store.ingest([
      event('a'),
      { ...event('b'), deviceId: 'device-2' },
      { ...event('c'), timestamp: '2026-10-29T10:00:00.000Z' },
    ]);
    assert.equal(store.query({ deviceId: 'device-1', since: '2026-10-30T00:00:00.000Z' }).total, 1);
    assert.equal(store.query({ limit: 1 }).records.length, 1);
    assert.equal(store.query({ limit: 1, offset: 1 }).records.length, 1);
  } finally {
    store.close();
  }
});
test('absence of byte measurements is unknown, never a zero-byte measurement', () => {
  assert.equal(activitySummary([event()]).bytesIn, null);
  assert.equal(activitySummary([{ ...event(), kind: 'bandwidth', bytesIn: 100 }]).bytesOut, null);
  assert.equal(activitySummary([{ ...event(), kind: 'connection', bytesIn: 100 }]).bytesIn, null);
  assert.equal(activitySummary([{ ...event(), kind: 'bandwidth', bytesIn: 0 }]).bytesIn, 0);
});
test('acknowledgement and mute survive deduplicated alert generation', () => {
  const store = new IntelligenceStore(':memory:');
  try {
    const alert = {
      id: 'a',
      deviceId: 'd',
      timestamp: event().timestamp,
      severity: 'info' as const,
      title: 'New',
      explanation: 'Observed',
      sourceId: 'discovery',
      status: 'open' as const,
      mutedUntil: null,
    };
    store.alert(alert);
    store.updateAlert('a', 'acknowledged', '2026-10-31T00:00:00.000Z');
    store.alert(alert);
    assert.equal(store.alerts()[0].status, 'acknowledged');
  } finally {
    store.close();
  }
});

test('advanced filters apply before pagination and SQL LIKE special characters are literal', () => {
  const store = new IntelligenceStore(':memory:');
  try {
    store.ingest([
      {
        ...event('one'),
        kind: 'connection',
        protocol: 'TCP',
        remotePort: 443,
        process: '100%Test',
      },
      { ...event('two'), kind: 'connection', protocol: 'UDP', remotePort: 53, process: 'Other' },
    ]);
    assert.equal(store.query({ protocol: 'TCP', remotePort: 443 }).total, 1);
    assert.equal(store.query({ search: '%' }).total, 1);
    assert.equal(store.query({ deviceIds: [] }).total, 0);
  } finally {
    store.close();
  }
});

test('activity, thresholds, source state and manual positions survive a database restart', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const folder = mkdtempSync(join(tmpdir(), 'netarium-intelligence-'));
  const path = join(folder, 'activity.sqlite');
  try {
    const first = new IntelligenceStore(path);
    first.ingest([event()]);
    first.threshold(250);
    first.position('device-1', 3, 4);
    first.source({
      id: 'agent',
      kind: 'agent',
      name: 'Local',
      enabled: true,
      lastSync: event().timestamp,
      error: null,
      scope: 'self',
    });
    first.close();
    const reopened = new IntelligenceStore(path);
    assert.equal(reopened.query({}).total, 1);
    assert.equal(reopened.threshold(), 250);
    assert.deepEqual(reopened.positions(), { 'device-1': { x: 3, y: 4 } });
    assert.equal(reopened.sources()[0].lastSync, event().timestamp);
    reopened.close();
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
