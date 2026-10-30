import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { discoverServices, normalizeService, enrichObservations } from '../server/mdns.js';
const network = {
  id: 'en0:192.168.1.2',
  name: 'en0',
  address: '192.168.1.2',
  mac: '',
  cidr: '192.168.1.0/24',
  scanCidr: '192.168.1.0/24',
  gateway: '192.168.1.1',
};
const service = {
  type: 'device-info',
  name: 'Téléphone',
  host: 'iphone.local',
  addresses: ['192.168.1.4', '8.8.8.8'],
  txt: { model: 'iPhone15,2', secret: 'discard' },
  referer: { address: '192.168.1.4' },
};
test('mDNS accepts only local scope, whitelists model data and rejects invalid hostnames', () => {
  const result = normalizeService(service, network.scanCidr);
  assert.equal(result.length, 1);
  assert.equal(result[0].service.model, 'iPhone15,2');
  assert.equal('secret' in result[0].service, false);
  assert.deepEqual(
    normalizeService({ ...service, referer: { address: '10.0.0.1' } }, network.scanCidr),
    [],
  );
  assert.deepEqual(normalizeService({ ...service, host: 'example.com' }, network.scanCidr), []);
  assert.deepEqual(normalizeService({ ...service, host: '<script>.local' }, network.scanCidr), []);
});
test('mDNS adds clues only to observed addresses and never promotes cached presence', () => {
  const existing = {
    ip: '192.168.1.4',
    mac: null,
    hostname: null,
    vendor: null,
    source: 'neighbor' as const,
    reachable: false,
    role: 'gateway' as const,
  };
  const enriched = enrichObservations([existing], normalizeService(service, network.scanCidr));
  assert.equal(enriched[0].services?.[0].model, 'iPhone15,2');
  assert.equal(enriched[0].hostname, 'iphone.local');
  assert.equal(enriched[0].reachable, false);
  assert.equal(enriched[0].role, 'gateway');
  assert.equal(existing.hostname, null);
  assert.deepEqual(enrichObservations([], normalizeService(service, network.scanCidr)), []);
});
class Transport extends EventEmitter {
  closed = false;
  query() {}
  destroy(callback: () => void) {
    this.closed = true;
    callback();
  }
}
test('discovery ends at its deadline and closes the transport', async () => {
  const transport = new Transport();
  const result = await discoverServices(network, new AbortController().signal, {
    createTransport: () => transport,
    durationMs: 10,
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(transport.closed, true);
});
test('cancellation closes mDNS and rejects instead of returning partial results', async () => {
  const transport = new Transport();
  const controller = new AbortController();
  const pending = discoverServices(network, controller.signal, {
    createTransport: () => transport,
    durationMs: 1000,
  });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(transport.closed, true);
});
test('transport errors degrade to a warning and do not fail discovery', async () => {
  const transport = new Transport();
  const pending = discoverServices(network, new AbortController().signal, {
    createTransport: () => transport,
    durationMs: 1000,
  });
  transport.emit('error', new Error('bind failed'));
  const result = await pending;
  assert.equal(result.warnings.length, 1);
  assert.equal(transport.closed, true);
});
test('real DNS-SD records are decoded into bounded service evidence', async () => {
  const transport = new Transport();
  const pending = discoverServices(network, new AbortController().signal, {
    createTransport: () => transport,
    durationMs: 20,
  });
  transport.emit(
    'response',
    {
      answers: [
        {
          name: '_device-info._tcp.local',
          type: 'PTR',
          ttl: 120,
          data: 'Phone._device-info._tcp.local',
        },
        {
          name: 'Phone._device-info._tcp.local',
          type: 'SRV',
          ttl: 120,
          data: { target: 'iphone.local', port: 9 },
        },
        {
          name: 'Phone._device-info._tcp.local',
          type: 'TXT',
          ttl: 120,
          data: [Buffer.from('model=iPhone15,2')],
        },
        { name: 'iphone.local', type: 'A', ttl: 120, data: '192.168.1.4' },
      ],
      additionals: [],
    },
    { address: '192.168.1.4', family: 'IPv4', port: 5353, size: 100 },
  );
  const result = await pending;
  assert.equal(result.services[0]?.service.model, 'iPhone15,2');
});

test('an already cancelled collection never opens a socket', async () => {
  const controller = new AbortController();
  controller.abort();
  let opened = false;
  await assert.rejects(
    discoverServices(network, controller.signal, {
      createTransport: () => {
        opened = true;
        return new Transport();
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal(opened, false);
});
test('discovery limits a burst of advertisements and releases its listeners', async () => {
  const transport = new Transport();
  const pending = discoverServices(network, new AbortController().signal, {
    createTransport: () => transport,
    durationMs: 1000,
  });
  for (let index = 0; index < 140; index++) {
    const fqdn = `Phone-${index}._device-info._tcp.local`;
    transport.emit(
      'response',
      {
        answers: [
          { name: '_device-info._tcp.local', type: 'PTR', ttl: 120, data: fqdn },
          { name: fqdn, type: 'SRV', ttl: 120, data: { target: 'iphone.local', port: 9 } },
          { name: 'iphone.local', type: 'A', ttl: 120, data: '192.168.1.4' },
        ],
        additionals: [],
      },
      { address: '192.168.1.4' },
    );
  }
  const result = await pending;
  assert.equal(result.services.length, 128);
  assert.equal(result.warnings.length, 1);
  assert.equal(transport.closed, true);
  assert.equal(transport.listenerCount('response'), 0);
});
