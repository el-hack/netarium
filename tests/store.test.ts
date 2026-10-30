import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../server/store.js';
import type { Observation } from '../shared/types.js';
const observation = (
  ip = '192.168.1.7',
  mac: string | null = 'aa:bb:cc:dd:ee:ff',
): Observation => ({
  ip,
  mac,
  hostname: null,
  vendor: null,
  source: 'ping',
  reachable: true,
  role: 'device',
});

test('keeps identity and user annotations when an address changes', () => {
  const store = new Store(':memory:');
  const first = store.beginScan('en0', '192.168.1.0/24', 'discovery');
  store.finishScan(first.id, [observation()], []);
  const original = store.devices()[0];
  store.annotate(original.id, { label: 'Mon NAS', category: 'storage', notes: 'Bureau' });
  const second = store.beginScan('en0', first.network, 'discovery');
  store.finishScan(second.id, [observation('192.168.1.20')], []);
  assert.equal(store.devices().length, 1);
  assert.equal(store.devices()[0].label, 'Mon NAS');
  assert.equal(store.devices()[0].id, original.id);
  assert.equal(store.snapshot(first.id)?.devices[0].ip, '192.168.1.7');
  store.close();
});
test('never merges two different MAC addresses after DHCP reuse', () => {
  const store = new Store(':memory:');
  for (const mac of ['aa:bb:cc:dd:ee:ff', '11:22:33:44:55:66']) {
    const scan = store.beginScan('en0', '192.168.1.0/24', 'discovery');
    store.finishScan(scan.id, [observation('192.168.1.7', mac)], []);
  }
  assert.equal(store.devices().length, 2);
  assert.equal(store.devices().filter((d) => d.status === 'unseen').length, 1);
  store.close();
});
test('promotes an IP-only identity when its MAC becomes available', () => {
  const store = new Store(':memory:');
  const first = store.beginScan('en0', '192.168.1.0/24', 'discovery');
  store.finishScan(first.id, [observation('192.168.1.7', null)], []);
  const id = store.devices()[0].id;
  const next = store.beginScan('en0', first.network, 'discovery');
  store.finishScan(next.id, [observation()], []);
  assert.equal(store.devices().length, 1);
  assert.equal(store.devices()[0].id, id);
  store.close();
});
test('a failed scan does not erase the last successful observations', () => {
  const store = new Store(':memory:');
  const first = store.beginScan('en0', '192.168.1.0/24', 'discovery');
  store.finishScan(first.id, [observation()], []);
  const next = store.beginScan('en0', first.network, 'discovery');
  store.failScan(next.id, 'Collecte indisponible');
  assert.equal(store.devices()[0].status, 'observed');
  assert.equal(store.snapshot(next.id), null);
  store.close();
});

test('snapshots preserve annotations from their capture time', () => {
  const store = new Store(':memory:');
  const scan = store.beginScan('en0', '192.168.1.0/24', 'discovery');
  store.finishScan(scan.id, [observation()], []);
  store.annotate(store.devices()[0].id, {
    label: 'Nouveau nom',
    category: 'storage',
    notes: 'Texte actuel',
  });
  assert.equal(store.snapshot(scan.id)?.devices[0].label, '');
  assert.equal(store.devices()[0].label, 'Nouveau nom');
  store.close();
});
test('a cancelled scan preserves observations in other network scopes', () => {
  const store = new Store(':memory:');
  const first = store.beginScan('en0', '192.168.1.0/24', 'discovery');
  store.finishScan(first.id, [observation()], []);
  const second = store.beginScan('en1', '10.0.0.0/24', 'discovery');
  store.failScan(second.id, 'Collecte annulée', true);
  assert.equal(store.devices()[0].status, 'observed');
  assert.equal(store.scan(second.id)?.status, 'cancelled');
  store.close();
});

test('inferences and raw clues are frozen in snapshots while manual overrides survive rediscovery', () => {
  const store = new Store(':memory:');
  try {
    const first = store.beginScan('en0', '192.168.1.0/24', 'discovery');
    store.finishScan(first.id, [{ ...observation(), hostname: 'iPhone.local' }], []);
    const original = store.devices()[0];
    assert.equal(original.identification?.category, 'phone');
    assert.equal(original.category, 'unknown');
    store.annotate(original.id, { label: 'Mon appareil', category: 'computer', notes: '' });
    const next = store.beginScan('en0', first.network, 'discovery');
    store.finishScan(next.id, [{ ...observation(), hostname: null }], []);
    assert.equal(store.devices()[0].category, 'computer');
    assert.equal(store.devices()[0].identification?.category, 'unknown');
    assert.equal(store.snapshot(first.id)?.devices[0].identification?.category, 'phone');
    assert.equal(store.snapshot(first.id)?.devices[0].category, 'unknown');
  } finally {
    store.close();
  }
});
