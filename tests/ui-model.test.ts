import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Device } from '../shared/types.js';
import { selectDevices } from '../src/device-view.js';
const device = (id: string, ip: string, label: string, status: Device['status'] = 'observed') =>
  ({
    id,
    ip,
    label,
    status,
    hostname: null,
    mac: null,
    category: 'unknown',
    role: 'device',
    lastSeen: '2026-10-30T00:00:00Z',
  }) as Device;
test('sorts IP addresses numerically, without modifying the source inventory', () => {
  const devices = [device('a', '192.168.1.20', 'NAS'), device('b', '192.168.1.3', 'PC')];
  assert.deepEqual(
    selectDevices(devices, { query: '', status: 'all', sort: 'ip' }).map((d) => d.id),
    ['b', 'a'],
  );
  assert.equal(devices[0].id, 'a');
});
test('combines accent-insensitive search with observation status', () => {
  const devices = [
    device('a', '192.168.1.2', 'Télévision'),
    device('b', '192.168.1.3', 'Téléphone', 'cached'),
  ];
  assert.deepEqual(
    selectDevices(devices, { query: 'TELE', status: 'cached', sort: 'name' }).map((d) => d.id),
    ['b'],
  );
});
test('sorts the most recently observed devices first', () => {
  const devices = [
    device('a', '192.168.1.2', 'A'),
    { ...device('b', '192.168.1.3', 'B'), lastSeen: '2026-10-31T00:00:00Z' },
  ];
  assert.equal(selectDevices(devices, { query: '', status: 'all', sort: 'recent' })[0].id, 'b');
});
