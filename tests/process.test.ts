import { test } from 'node:test';
import assert from 'node:assert/strict';
import { command } from '../server/network.js';
test('system commands obey their execution deadline', async () => {
  await assert.rejects(
    command(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], undefined, 60),
  );
});
test('collection cancellation propagates to a running system process', async () => {
  const controller = new AbortController();
  const pending = command(
    process.execPath,
    ['-e', 'setTimeout(() => {}, 10000)'],
    controller.signal,
    5000,
  );
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
