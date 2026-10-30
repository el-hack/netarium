import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../server/store.js';
test('restart retains annotations and snapshots and recovers an interrupted collection', () => {
  const directory = mkdtempSync(join(tmpdir(), 'netarium-persistence-'));
  const path = join(directory, 'network.sqlite');
  let store: Store | undefined;
  try {
    store = new Store(path);
    const scan = store.beginScan('en0', '192.168.1.0/24', 'discovery');
    store.finishScan(
      scan.id,
      [
        {
          ip: '192.168.1.7',
          mac: '02:00:00:00:00:07',
          hostname: null,
          vendor: null,
          source: 'ping',
          reachable: true,
          role: 'device',
        },
      ],
      [],
    );
    const id = store.devices()[0].id;
    store.annotate(id, { label: 'NAS du bureau', category: 'storage', notes: 'Sauvegardes' });
    store.saveSettings({ intervalMinutes: 15, retentionDays: 90, interfaceId: 'en0' });
    const interrupted = store.beginScan('en0', '192.168.1.0/24', 'discovery');
    store.close();
    store = new Store(path);
    assert.equal(store.devices()[0].label, 'NAS du bureau');
    assert.equal(store.devices()[0].status, 'observed');
    assert.equal(store.snapshot(scan.id)?.devices[0].id, id);
    assert.equal(store.scan(interrupted.id)?.status, 'failed');
    assert.equal(store.settings().retentionDays, 90);
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
