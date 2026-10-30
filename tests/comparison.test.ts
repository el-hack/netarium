import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareSnapshots, type Device } from '../shared/types.js';
const device = (id: string, ip: string): Device => ({
  id,
  ip,
  mac: null,
  hostname: null,
  vendor: null,
  source: 'ping',
  reachable: true,
  role: 'device',
  network: '192.168.1.0/24',
  label: '',
  category: 'unknown',
  notes: '',
  firstSeen: '2026-10-30T00:00:00Z',
  lastSeen: '2026-10-30T00:00:00Z',
  observedAt: '2026-10-30T00:00:00Z',
  scanId: 'test',
  status: 'observed',
});
test('compares stable identity and observation changes without treating annotations as network changes', () => {
  const before = [
    device('nas', '192.168.1.2'),
    device('phone', '192.168.1.3'),
    device('pc', '192.168.1.4'),
  ];
  const after = [
    device('nas', '192.168.1.20'),
    device('tv', '192.168.1.5'),
    { ...device('pc', '192.168.1.4'), label: 'Mon PC' },
  ];
  const result = compareSnapshots(before, after);
  assert.deepEqual(
    result.added.map((d) => d.id),
    ['tv'],
  );
  assert.deepEqual(
    result.missing.map((d) => d.id),
    ['phone'],
  );
  assert.deepEqual(
    result.changed.map((d) => d.after.id),
    ['nas'],
  );
});
