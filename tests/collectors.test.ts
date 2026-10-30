import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCounters,
  parseConnections,
  counterDelta,
} from '../server/intelligence/collectors.js';
test('macOS counter parser uses link totals once, not duplicate IPv4 and IPv6 rows', () => {
  const output =
    'Name Mtu Network Address Ipkts Ierrs Ibytes Opkts Oerrs Obytes Coll\nen0 1500 <Link#4> aa 20 0 9000 30 0 3000 0\nen0 1500 192.168 x 20 0 9000 30 0 3000 0';
  assert.deepEqual(parseCounters(output, 'en0', 'darwin'), { rx: 9000, tx: 3000 });
});
test('counter reset or nonpositive interval is not negative traffic', () => {
  assert.equal(
    counterDelta({ rx: 100, tx: 100, time: 1000 }, { rx: 50, tx: 110, time: 2000 }),
    null,
  );
  assert.deepEqual(
    counterDelta({ rx: 100, tx: 100, time: 1000 }, { rx: 200, tx: 150, time: 3000 }),
    { bytesIn: 100, bytesOut: 50, rateIn: 400, rateOut: 200 },
  );
});
test('process connections preserve endpoint, protocol, PID and socket state without DNS invention', () => {
  const rows = parseConnections(
    'p42\ncBrowser\nf10\nPTCP\nn192.168.1.2:50300->93.184.216.34:443\nTST=ESTABLISHED\nf11\nPTCP\nn*:8080\nTST=LISTEN',
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].remotePort, 443);
  assert.equal(rows[0].process, 'Browser');
  assert.equal(rows[0].pid, 42);
  assert.equal(rows[0].domain, null);
  assert.equal(rows[1].remoteIp, null);
});
