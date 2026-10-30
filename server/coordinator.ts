import type { NetworkInterface, Scan } from '../shared/types.js';
import { collect, interfaces, type CollectResult } from './network.js';
import { Store } from './store.js';
export class AppError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}
export type Collector = (network: NetworkInterface, active: boolean, signal: AbortSignal) => Promise<CollectResult>;
export class Coordinator {
  private controller: AbortController | null = null;
  private running: Promise<void> | null = null;
  private scanId: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastStart = 0;
  constructor(private store: Store, private discover: Collector = collect, private listInterfaces = interfaces, private report: (error: unknown) => void = console.error) {}
  get active(): Scan | null { return this.scanId ? this.store.scan(this.scanId) : null; }
  async start(interfaceId: string, active = true): Promise<Scan> {
    const networks = await this.listInterfaces();
    const network = networks.find(n => n.id === interfaceId);
    if (!network) throw new AppError(400,'Cette interface n’est plus disponible. Actualisez la page.');
    if (this.controller) throw new AppError(409,'Une collecte est déjà en cours.');
    if (Date.now()-this.lastStart < 3000) throw new AppError(429,'Patientez quelques secondes entre deux collectes.');
    const scan = this.store.beginScan(interfaceId,network.scanCidr,active?'discovery':'passive');
    this.lastStart = Date.now();
    const controller = new AbortController();
    this.controller = controller;
    this.scanId = scan.id;
    this.running = (async () => {
      try {
        const result = await this.discover(network, active, controller.signal);
        if (controller.signal.aborted) this.store.failScan(scan.id,'Collecte annulée.',true);
        else this.store.finishScan(scan.id,result.observations,result.warnings);
        this.store.prune(this.store.settings().retentionDays);
      } catch (error) {
        this.store.failScan(scan.id,controller.signal.aborted ? 'Collecte annulée.' : 'La collecte a échoué. Vérifiez les outils réseau dans les réglages.',controller.signal.aborted);
        if (!controller.signal.aborted) this.report(error);
      } finally { this.controller = null; this.scanId = null; }
    })();
    return scan;
  }
  cancel() { this.controller?.abort(); }
  schedule() {
    if (this.timer) clearTimeout(this.timer);
    const {intervalMinutes, interfaceId} = this.store.settings();
    if (!intervalMinutes || !interfaceId) return;
    this.timer = setTimeout(async () => {
      try { if (!this.active) await this.start(interfaceId); } catch (error) { this.report(error); }
      this.schedule();
    }, intervalMinutes * 60000);
    this.timer.unref();
  }
  async close() {
    if (this.timer) clearTimeout(this.timer);
    this.cancel();
    await this.running;
  }
}
