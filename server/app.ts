import { IntelligenceService } from './intelligence/service.js';
import { IntelligenceStore } from './intelligence/store.js';
import { intelligenceRoutes } from './intelligence/routes.js';
import { effectiveCategory } from '../shared/identification.js';
import Fastify from 'fastify';
import { z } from 'zod';
import type { Capabilities, NetworkInterface } from '../shared/types.js';
import { categories } from '../shared/types.js';
import { interfaces } from './network.js';
import { Store } from './store.js';
import { AppError, Coordinator } from './coordinator.js';
interface AppOptions {
  store: Store;
  coordinator: Coordinator;
  port: number;
  capabilities: Capabilities;
  listInterfaces?: () => Promise<NetworkInterface[]>;
  logger?: boolean;
  intelligence?: IntelligenceService;
}
const annotation = z
  .object({
    label: z.string().trim().max(80),
    category: z.enum(categories),
    notes: z.string().trim().max(2000),
    tags: z
      .array(z.string().trim().min(1).max(30))
      .max(12)
      .transform((tags) => [...new Set(tags)])
      .optional(),
  })
  .strict();
const settingsSchema = z
  .object({
    intervalMinutes: z.union([z.literal(0), z.number().int().min(5).max(1440)]),
    retentionDays: z.number().int().min(1).max(365),
    interfaceId: z.string().max(200).nullable(),
  })
  .strict();
function csvCell(value: string) {
  // Neutralize spreadsheet formulas in user-controlled names and notes.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export async function createApp({
  store,
  coordinator,
  port,
  capabilities,
  listInterfaces = interfaces,
  logger = false,
  intelligence = new IntelligenceService(new IntelligenceStore(':memory:'), store, listInterfaces),
}: AppOptions) {
  const app = Fastify({ logger, bodyLimit: 16384, requestTimeout: 10000 });
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const allowedOrigins = new Set([...allowedHosts].map((host) => `http://${host}`));
  app.addHook('onRequest', async (request, reply) => {
    if (!allowedHosts.has(request.headers.host ?? ''))
      return reply.code(403).send({ message: 'Accès local uniquement.' });
    if (request.url.startsWith('/api/')) {
      if (request.headers.origin && !allowedOrigins.has(request.headers.origin))
        return reply.code(403).send({ message: 'Origine non autorisée.' });
      if (request.headers['sec-fetch-site'] === 'cross-site')
        return reply.code(403).send({ message: 'Requête externe refusée.' });
      if (!['GET', 'HEAD'].includes(request.method) && request.headers['x-netarium-client'] !== '1')
        return reply.code(403).send({ message: 'Client local requis.' });
      reply.header('Cache-Control', 'no-store');
    }
    reply
      .header('X-Content-Type-Options', 'nosniff')
      .header('X-Frame-Options', 'DENY')
      .header('Referrer-Policy', 'no-referrer');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:* ws://localhost:*; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError)
      return reply.code(400).send({
        message: 'Paramètres invalides.',
        details: error.issues.map((i) => `${i.path.join('.')} : ${i.message}`),
      });
    const statusCode =
      error instanceof AppError
        ? error.statusCode
        : ((error as { statusCode?: number }).statusCode ?? 500);
    if (statusCode >= 500) request.log.error({ err: error }, 'Request failed');
    return reply.code(statusCode).send({
      message:
        statusCode >= 500
          ? 'Erreur interne. Consultez les journaux locaux.'
          : (error as Error).message,
    });
  });
  intelligenceRoutes(app, intelligence, store);
  app.get<{ Params: { id: string } }>('/api/devices/:id/history', async (request) =>
    store.deviceHistory(request.params.id),
  );
  app.get('/api/health', async () => ({
    application: 'netarium',
    status: 'ok',
    version: capabilities.version,
  }));
  app.get('/api/overview', async () => ({
    devices: store.devices(),
    scans: store.scans(),
    interfaces: await listInterfaces(),
    settings: store.settings(),
    capabilities,
    activeScan: coordinator.active,
  }));
  app.post('/api/scans', async (request, reply) => {
    const { interfaceId, mode } = z
      .object({
        interfaceId: z.string().min(1).max(200),
        mode: z.enum(['discovery', 'passive']).default('discovery'),
      })
      .strict()
      .parse(request.body);
    const scan = await coordinator.start(interfaceId, mode === 'discovery');
    return reply.code(202).send(scan);
  });
  app.post('/api/scans/cancel', async () => {
    coordinator.cancel();
    return { ok: true };
  });
  app.get<{ Params: { id: string } }>('/api/snapshots/:id', async (request) => {
    const snapshot = store.snapshot(request.params.id);
    if (!snapshot) throw new AppError(404, 'Instantané introuvable.');
    return snapshot;
  });
  app.patch<{ Params: { id: string } }>('/api/devices/:id', async (request) => {
    const input = annotation.parse(request.body);
    if (!store.annotate(request.params.id, input)) throw new AppError(404, 'Appareil introuvable.');
    return { ok: true };
  });
  app.put('/api/settings', async (request) => {
    const input = settingsSchema.parse(request.body);
    if (input.interfaceId && !(await listInterfaces()).some((n) => n.id === input.interfaceId))
      throw new AppError(400, 'Interface indisponible.');
    if (input.intervalMinutes && !input.interfaceId)
      throw new AppError(400, 'Sélectionnez une interface pour la collecte automatique.');
    store.saveSettings(input);
    coordinator.schedule();
    store.prune(input.retentionDays);
    return input;
  });
  app.get('/api/export', async (request, reply) => {
    const { format } = z
      .object({ format: z.enum(['json', 'csv']).default('json') })
      .parse(request.query);
    reply.header(
      'Content-Disposition',
      `attachment; filename="netarium-${new Date().toISOString().slice(0, 10)}.${format}"`,
    );
    const devices = store.devices();
    if (format === 'csv') {
      const keys = [
        'id',
        'label',
        'ip',
        'mac',
        'hostname',
        'category',
        'status',
        'source',
        'firstSeen',
        'lastSeen',
        'notes',
      ] as const;
      return reply
        .type('text/csv; charset=utf-8')
        .send(
          '\uFEFF' +
            [...keys, 'effectiveCategory', 'identificationConfidence'].join(',') +
            '\r\n' +
            devices
              .map((device) =>
                [
                  ...keys.map((key) => csvCell(String(device[key] ?? ''))),
                  csvCell(effectiveCategory(device)),
                  csvCell(device.identification?.confidence ?? 'none'),
                ].join(','),
              )
              .join('\r\n'),
        );
    }
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      devices,
      scans: store.scans(),
      snapshots: store.scans().flatMap((scan) => {
        const snapshot = store.snapshot(scan.id);
        return snapshot ? [snapshot] : [];
      }),
    };
  });
  app.addHook('onClose', async () => {
    await coordinator.close();
    await intelligence.close();
  });
  return app;
}
