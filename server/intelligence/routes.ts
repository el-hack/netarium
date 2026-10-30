import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { isIP } from 'node:net';
import { blankRecord } from '../../shared/activity.js';
import type { Store } from '../store.js';
import type { IntelligenceService } from './service.js';
const timestamp = z.iso.datetime({ offset: true }).transform((s) => new Date(s).toISOString());
const ip = z
  .string()
  .refine((value) => isIP(value) > 0, 'Adresse IP invalide')
  .nullable()
  .default(null);
const port = z.number().int().min(0).max(65535).nullable().default(null);
const bytes = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable().default(null);
export function intelligenceRoutes(
  app: FastifyInstance,
  service: IntelligenceService,
  inventory: Store,
) {
  app.get('/api/intelligence', async (request) => {
    const query = z
      .object({
        network: z.string().optional(),
        deviceId: z.string().optional(),
        kind: z.enum(['dns', 'connection', 'bandwidth', 'discovery']).optional(),
        since: timestamp.optional(),
        until: timestamp.optional(),
        search: z.string().max(200).optional(),
        protocol: z.enum(['TCP', 'UDP', 'ICMP']).optional(),
        source: z.enum(['discovery', 'interface', 'agent', 'dns-import', 'flow-import']).optional(),
        remotePort: z.coerce.number().int().min(0).max(65535).optional(),
        offset: z.coerce.number().int().min(0).default(0),
        limit: z.coerce.number().int().min(1).max(1000).default(200),
      })
      .parse(request.query);
    return service.query({
      ...query,
      deviceIds: query.network
        ? inventory
            .devices()
            .filter((d) => d.network === query.network)
            .map((d) => d.id)
        : undefined,
    });
  });
  app.post('/api/sources/local', async (request) => {
    const input = z
      .object({
        kind: z.enum(['interface', 'agent']),
        enabled: z.boolean(),
        consent: z.boolean().default(false),
      })
      .strict()
      .parse(request.body);
    if (input.enabled && !input.consent)
      throw Object.assign(new Error('Consentement explicite requis pour activer ce collecteur.'), {
        statusCode: 400,
      });
    await service.configure(input.kind, input.enabled);
    return { sources: service.sources() };
  });
  app.post('/api/activity/import', { bodyLimit: 1024 * 1024 }, async (request) => {
    const input = z
      .object({
        deviceId: z.string(),
        kind: z.enum(['dns', 'flow']),
        records: z
          .array(
            z
              .object({
                timestamp,
                endAt: timestamp.nullable().default(null),
                domain: z
                  .string()
                  .toLowerCase()
                  .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}\.?$/)
                  .max(253)
                  .nullable()
                  .default(null),
                localIp: ip,
                remoteIp: ip,
                localPort: port,
                remotePort: port,
                protocol: z.enum(['TCP', 'UDP', 'ICMP']).nullable().default(null),
                bytesIn: bytes,
                bytesOut: bytes,
              })
              .strict(),
          )
          .min(1)
          .max(500),
      })
      .strict()
      .parse(request.body);
    if (!inventory.devices().some((d) => d.id === input.deviceId))
      throw Object.assign(new Error('Sélectionnez un appareil connu.'), { statusCode: 400 });
    const records = input.records.map((row) => {
      if (
        new Date(row.timestamp).getTime() > Date.now() + 300000 ||
        (row.endAt && row.endAt < row.timestamp) ||
        (input.kind === 'dns' && !row.domain)
      )
        throw Object.assign(new Error('Horodatage ou domaine invalide.'), { statusCode: 400 });
      const blank = blankRecord(
        '',
        input.deviceId,
        input.kind === 'dns' ? 'dns' : 'connection',
        row.timestamp,
        {
          sourceId: '',
          sourceKind: 'dns-import',
          collectedAt: '',
          precision: 'reported',
          confidence: 'medium',
          expiresAt: null,
        },
      );
      return {
        ...blank,
        ...row,
        bytesIn: input.kind === 'dns' ? null : row.bytesIn,
        bytesOut: input.kind === 'dns' ? null : row.bytesOut,
        detail:
          input.kind === 'dns'
            ? 'Observation DNS importée ; ne prouve pas une visite web.'
            : 'Flux normalisé importé ; association à l’appareil confirmée lors de l’import.',
      };
    });
    return { inserted: service.import(input.deviceId, input.kind, records) };
  });
  app.patch<{ Params: { id: string } }>('/api/alerts/:id', async (request, reply) => {
    const input = z
      .object({
        status: z.enum(['open', 'acknowledged']),
        mutedUntil: timestamp.nullable().default(null),
      })
      .strict()
      .parse(request.body);
    if (!service.database.updateAlert(request.params.id, input.status, input.mutedUntil))
      return reply.code(404).send({ message: 'Alerte introuvable.' });
    return { ok: true };
  });
  app.put('/api/alerts/threshold', async (request) => {
    const { mbps } = z.object({ mbps: z.number().min(1).max(100000) }).parse(request.body);
    service.thresholdMbps = mbps;
    return { mbps };
  });
  app.get('/api/analytics', async (request) => {
    const q = z
      .object({ network: z.string(), since: timestamp, until: timestamp })
      .parse(request.query);
    if (q.since >= q.until)
      throw Object.assign(new Error('Période invalide.'), { statusCode: 400 });
    return service.database.analytics(
      q.since,
      q.until,
      inventory
        .devices()
        .filter((d) => d.network === q.network)
        .map((d) => d.id),
    );
  });
  app.get('/api/layout', async () => service.ensureLayout());
  app.put<{ Params: { id: string } }>('/api/layout/:id', async (request, reply) => {
    const { x, y } = z
      .object({ x: z.number().min(-20).max(20), y: z.number().min(-20).max(20) })
      .strict()
      .parse(request.body);
    if (!inventory.devices().some((d) => d.id === request.params.id))
      return reply.code(404).send({ message: 'Appareil introuvable.' });
    service.database.position(request.params.id, x, y);
    return { ok: true };
  });
  app.delete('/api/activity', async (request, reply) => {
    const { confirm } = z.object({ confirm: z.literal('DELETE_ACTIVITY') }).parse(request.body);
    if (!confirm) return reply.code(400).send({ message: 'Confirmation requise.' });
    await service.configure('interface', false);
    await service.configure('agent', false);
    service.syncDiscovery();
    service.database.clear();
    return { ok: true };
  });
  app.get('/api/activity/export', async (request, reply) => {
    const query = z
      .object({ deviceId: z.string().optional(), since: timestamp.optional() })
      .parse(request.query);
    const result = service.query({ ...query, limit: 1000 });
    reply.header('Content-Disposition', 'attachment; filename="netarium-activity.json"');
    return { schemaVersion: 1, exportedAt: new Date().toISOString(), ...result };
  });
}
