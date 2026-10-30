import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocatePositions } from '../shared/layout.js';
test('persistent layouts retain existing positions and allocate new nodes without moving their neighbors', () => {
  const ids = Array.from({ length: 20 }, (_, i) => `device-${i}`);
  const initial = allocatePositions(ids);
  const updated = allocatePositions([...ids, 'new-device'], initial);
  for (const id of ids) assert.deepEqual(updated[id], initial[id]);
  assert.deepEqual(allocatePositions([...ids].reverse()), initial);
  for (const p of Object.values(updated)) {
    assert.ok(Math.abs(p.x) <= 20 && Math.abs(p.y) <= 20);
  }
  assert.equal(new Set(Object.values(updated).map((p) => `${p.x},${p.y}`)).size, 21);
});
