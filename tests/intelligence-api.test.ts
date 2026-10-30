import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../server/store.js';
import { IntelligenceStore } from '../server/intelligence/store.js';
import { IntelligenceService } from '../server/intelligence/service.js';
import { Coordinator } from '../server/coordinator.js';
import { createApp } from '../server/app.js';
const network = {
  id: 'test0',
  name: 'test0',
  address: '192.168.1.2',
  mac: '02:00:00:00:00:02',
  cidr: '192.168.1.0/24',
  scanCidr: '192.168.1.0/24',
  gateway: '192.168.1.1',
};
const host = { host: '127.0.0.1:4783' };
const headers = { ...host, 'x-netarium-client': '1', origin: 'http://127.0.0.1:4783' };
async function fixture() {
  const inventory = new Store(':memory:');
  const scan = inventory.beginScan(network.id, network.scanCidr, 'passive');
  inventory.finishScan(
    scan.id,
    [
      {
        ip: network.address,
        mac: network.mac,
        role: 'self',
        hostname: 'test.local',
        source: 'local',
        reachable: true,
        vendor: null,
      },
    ],
    [],
  );
  const database = new IntelligenceStore(':memory:');
  let reads = 0;
  const start = Date.now();
  const service = new IntelligenceService(database, inventory, async () => [network], {
    readCounters: async () => ({
      rx: ++reads * 1000,
      tx: reads * 2000,
      time: start + reads * 10000,
    }),
    readConnections: async () => [
      {
        localIp: network.address,
        remoteIp: '203.0.113.10',
        localPort: 51000,
        remotePort: 443,
        protocol: 'TCP',
        process: 'TestProcess',
        pid: 42,
        state: 'ESTABLISHED',
        domain: null,
      },
    ],
  });
  const coordinator = new Coordinator(
    inventory,
    async () => ({ observations: [], warnings: [] }),
    async () => [network],
  );
  const app = await createApp({
    store: inventory,
    coordinator,
    intelligence: service,
    port: 4783,
    listInterfaces: async () => [network],
    capabilities: {
      platform: 'test',
      ping: true,
      nmap: false,
      neighbor: true,
      version: 'test',
      dataDirectory: ':memory:',
    },
  });
  return {
    inventory,
    database,
    service,
    app,
    device: inventory.devices()[0],
    close: async () => {
      await app.close();
      inventory.close();
    },
  };
}
test('consent gates real collection, counter baselines are unknown and disabling stops ingestion', async () => {
  const f = await fixture();
  try {
    assert.equal(
      (
        await f.app.inject({
          method: 'POST',
          url: '/api/sources/local',
          headers,
          payload: { kind: 'agent', enabled: true },
        })
      ).statusCode,
      400,
    );
    assert.equal(f.database.query({ kind: 'connection' }).total, 0);
    await f.app.inject({
      method: 'POST',
      url: '/api/sources/local',
      headers,
      payload: { kind: 'interface', enabled: true, consent: true },
    });
    assert.equal(f.database.query({ kind: 'bandwidth' }).records[0].bytesIn, null);
    await f.service.sample();
    const result = f.database.query({ kind: 'bandwidth' });
    assert.equal(result.total, 2);
    assert.ok(result.records.some((r) => r.bytesIn === 1000 && r.rateIn === 800));
    await f.service.configure('interface', false);
    await f.service.sample();
    assert.equal(f.database.query({ kind: 'bandwidth' }).total, 2);
    assert.equal(f.service.sources().find((s) => s.id === 'interface')?.enabled, false);
  } finally {
    await f.close();
  }
});
test('local agent associates actual process metadata only with this computer', async () => {
  const f = await fixture();
  try {
    await f.service.configure('agent', true);
    const record = f.database.query({ kind: 'connection' }).records[0];
    assert.equal(record.deviceId, f.device.id);
    assert.equal(record.process, 'TestProcess');
    assert.equal(record.bytesIn, null);
    assert.equal(record.domain, null);
    assert.equal(record.source.precision, 'sample');
  } finally {
    await f.close();
  }
});
test('DNS imports validate device and schema, preserve unknowns and deduplicate equivalent timestamps', async () => {
  const f = await fixture();
  try {
    const payload = {
      deviceId: f.device.id,
      kind: 'dns',
      records: [{ timestamp: new Date().toISOString(), domain: 'EXAMPLE.ORG' }],
    };
    const first = await f.app.inject({
      method: 'POST',
      url: '/api/activity/import',
      headers,
      payload,
    });
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(first.json().inserted, 1);
    assert.equal(
      (await f.app.inject({ method: 'POST', url: '/api/activity/import', headers, payload })).json()
        .inserted,
      0,
    );
    const row = f.database.query({ kind: 'dns' }).records[0];
    assert.equal(row.domain, 'example.org');
    assert.equal(row.bytesIn, null);
    assert.equal(row.source.confidence, 'medium');
    for (const bad of [
      { ...payload, deviceId: 'unknown' },
      {
        ...payload,
        records: [{ timestamp: new Date().toISOString(), domain: 'https://example.org/private' }],
      },
      { ...payload, records: [{ ...payload.records[0], process: 'pretend-browser' }] },
    ])
      assert.equal(
        (await f.app.inject({ method: 'POST', url: '/api/activity/import', headers, payload: bad }))
          .statusCode,
        400,
      );
    const cross = await f.app.inject({
      url: '/api/intelligence?network=192.168.9.0%2F24',
      headers: host,
    });
    assert.equal(cross.json().total, 0);
  } finally {
    await f.close();
  }
});
test('analytics separate interface volumes from imported flows and keep missing directions unknown', async () => {
  const f = await fixture();
  try {
    await f.service.configure('interface', true);
    await f.service.sample();
    const timestamp = new Date().toISOString();
    const imported = await f.app.inject({
      method: 'POST',
      url: '/api/activity/import',
      headers,
      payload: {
        deviceId: f.device.id,
        kind: 'flow',
        records: [{ timestamp, remoteIp: '203.0.113.5', protocol: 'TCP', bytesOut: 1000000 }],
      },
    });
    assert.equal(imported.statusCode, 200);
    const result = await f.app.inject({
      url:
        '/api/analytics?' +
        new URLSearchParams({
          network: network.scanCidr,
          since: new Date(Date.now() - 3600000).toISOString(),
          until: new Date(Date.now() + 3600000).toISOString(),
        }),
      headers: host,
    });
    const data = result.json();
    assert.equal(data.bandwidth[0].bytesIn, 1000);
    assert.equal(data.bandwidth[0].bytesOut, 2000);
    assert.equal(data.flows[0].bytesIn, null);
    assert.equal(data.flows[0].bytesOut, 1000000);
  } finally {
    await f.close();
  }
});
test('tags survive rediscovery and snapshots retain their original annotations', async () => {
  const f = await fixture();
  try {
    const response = await f.app.inject({
      method: 'PATCH',
      url: `/api/devices/${f.device.id}`,
      headers,
      payload: {
        label: 'Bureau',
        category: 'computer',
        notes: 'Test',
        tags: ['Privé', 'Privé', 'Bureau'],
      },
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(f.inventory.devices()[0].tags, ['Privé', 'Bureau']);
    assert.deepEqual(f.inventory.snapshot(f.device.scanId)?.devices[0].tags, []);
    const scan = f.inventory.beginScan(network.id, network.scanCidr, 'passive');
    f.inventory.finishScan(scan.id, [{ ...f.device, ip: '192.168.1.3' }], []);
    assert.deepEqual(f.inventory.devices()[0].tags, ['Privé', 'Bureau']);
    const history = await f.app.inject({
      url: `/api/devices/${f.device.id}/history`,
      headers: host,
    });
    assert.equal(history.json().length, 2);
  } finally {
    await f.close();
  }
});
test('configuration is serialized and thresholds are stored with the activity database', async () => {
  const f = await fixture();
  try {
    await Promise.all([
      f.service.configure('interface', true),
      f.service.configure('agent', true),
      f.service.configure('interface', false),
      f.service.configure('agent', false),
    ]);
    assert.ok(
      f.service
        .sources()
        .filter((s) => ['interface', 'agent'].includes(s.id))
        .every((s) => !s.enabled),
    );
    f.service.thresholdMbps = 250;
    assert.equal(f.database.threshold(), 250);
    const invalid = await f.app.inject({
      method: 'DELETE',
      url: '/api/activity',
      headers,
      payload: { confirm: 'yes' },
    });
    assert.equal(invalid.statusCode, 400);
    assert.ok(f.database.query({}).total > 0);
  } finally {
    await f.close();
  }
});

test('retention applies with stopped collectors and clearing does not reimport existing discoveries', async () => {
  const f = await fixture();
  try {
    f.service.query({});
    const timestamp = new Date(Date.now() - 40 * 86400000).toISOString();
    f.service.import(f.device.id, 'dns', [
      {
        timestamp,
        endAt: null,
        domain: 'old.example.org',
        localIp: null,
        remoteIp: null,
        localPort: null,
        remotePort: null,
        protocol: null,
        process: null,
        pid: null,
        bytesIn: null,
        bytesOut: null,
        rateIn: null,
        rateOut: null,
        state: 'observed',
        detail: 'old',
      },
    ]);
    assert.equal(f.service.query({ kind: 'dns' }).total, 0);
    const response = await f.app.inject({
      method: 'DELETE',
      url: '/api/activity',
      headers,
      payload: { confirm: 'DELETE_ACTIVITY' },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(f.service.query({}).total, 0);
    assert.equal(f.inventory.devices().length, 1);
  } finally {
    await f.close();
  }
});
