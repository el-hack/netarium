import { IntelligenceStore } from '../server/intelligence/store.js';
import { IntelligenceService } from '../server/intelligence/service.js';
// Deterministic collector used only by browser tests; never imported by the application.
import { join, resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import { Store } from '../server/store.js';
import { Coordinator } from '../server/coordinator.js';
import { createApp } from '../server/app.js';
import type { Observation } from '../shared/types.js';
const store = new Store(join(process.env.NETARIUM_DATA_DIR!, 'test.sqlite'));
const network = {
  id: 'test0:192.168.50.2',
  name: 'test0',
  address: '192.168.50.2',
  mac: '02:00:00:00:00:02',
  cidr: '192.168.50.0/24',
  scanCidr: '192.168.50.0/24',
  gateway: '192.168.50.1',
};
let count = 0;
const coordinator = new Coordinator(
  store,
  async (_network, _active, signal) => {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 450);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new Error('cancelled'));
        },
        { once: true },
      );
    });
    count++;
    const observations: Observation[] = [
      {
        ip: '192.168.50.2',
        mac: '02:00:00:00:00:02',
        hostname: 'ordinateur.local',
        vendor: null,
        source: 'local',
        reachable: true,
        role: 'self',
      },
      {
        ip: '192.168.50.1',
        mac: '02:00:00:00:00:01',
        hostname: null,
        vendor: null,
        source: 'neighbor',
        reachable: false,
        role: 'gateway',
      },
      {
        ip: count === 1 ? '192.168.50.10' : '192.168.50.20',
        mac: '02:00:00:00:00:10',
        hostname: 'nas.local',
        vendor: null,
        source: 'ping',
        reachable: true,
        role: 'device',
      },
      {
        ip: count === 1 ? '192.168.50.11' : '192.168.50.12',
        mac: count === 1 ? '02:00:00:00:00:11' : '02:00:00:00:00:12',
        hostname: count === 1 ? 'iphone.local' : 'tv.local',
        services:
          count === 1
            ? [
                {
                  type: 'device-info',
                  name: 'Téléphone de test',
                  host: 'iphone.local',
                  model: 'iPhone15,2',
                },
              ]
            : [],
        vendor: null,
        source: 'ping',
        reachable: true,
        role: 'device',
      },
    ];
    return { observations, warnings: ['Collecteur déterministe de test.'] };
  },
  async () => [network],
);
const port = Number(process.env.PORT);
let counterReads = 0;
const intelligence = new IntelligenceService(
  new IntelligenceStore(join(process.env.NETARIUM_DATA_DIR!, 'activity.sqlite')),
  store,
  async () => [network],
  {
    readCounters: async () => ({
      rx: ++counterReads * 100000,
      tx: counterReads * 20000,
      time: Date.now(),
    }),
    readConnections: async () => [
      {
        localIp: network.address,
        remoteIp: '203.0.113.10',
        localPort: 54321,
        remotePort: 443,
        protocol: 'TCP',
        process: 'Test Browser',
        pid: 42,
        state: 'ESTABLISHED',
        domain: null,
      },
    ],
  },
);
const app = await createApp({
  intelligence,
  store,
  coordinator,
  port,
  listInterfaces: async () => [network],
  capabilities: {
    platform: 'test',
    nmap: false,
    ping: true,
    neighbor: true,
    dataDirectory: process.env.NETARIUM_DATA_DIR!,
    version: '0.1.0',
  },
});
await app.register(fastifyStatic, { root: resolve('dist'), wildcard: true });
app.setNotFoundHandler((_request, reply) => reply.sendFile('index.html'));
await app.listen({ host: '127.0.0.1', port });
process.on('SIGTERM', async () => {
  await app.close();
  store.close();
  process.exit(0);
});
