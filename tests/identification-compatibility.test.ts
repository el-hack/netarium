import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../server/store.js';

test('legacy inventories gain inference without rewriting historical snapshots or annotations', () => {
  const directory = mkdtempSync(join(tmpdir(), 'netarium-legacy-'));
  const path = join(directory, 'data.sqlite');
  let store: Store | undefined;
  try {
    store = new Store(path);
    const scan = store.beginScan('en0', '192.168.1.0/24', 'discovery');
    store.finishScan(
      scan.id,
      [
        {
          ip: '192.168.1.4',
          mac: null,
          hostname: 'iPhone.local',
          vendor: null,
          source: 'ping',
          reachable: true,
          role: 'device',
        },
      ],
      [],
    );
    const original = store.devices()[0];
    store.annotate(original.id, { label: 'Mon appareil', category: 'tablet', notes: 'Conserver' });
    store.close();
    store = undefined;
    // Recreate the v1 JSON shape, before identification existed.
    const db = new DatabaseSync(path);
    try {
      db.exec(
        "UPDATE devices SET last_data=json_remove(last_data,'$.identification'); UPDATE snapshots SET data=json_remove(data,'$[0].identification');",
      );
    } finally {
      db.close();
    }
    store = new Store(path);
    const current = store.devices()[0];
    assert.equal(current.identification?.category, 'phone');
    assert.equal(current.category, 'tablet');
    assert.equal(current.notes, 'Conserver');
    assert.equal(store.snapshot(scan.id)?.devices[0].identification, undefined);
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
