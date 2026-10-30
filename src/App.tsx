import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Radio, RefreshCw, Square, ShieldCheck, Network, Clock3 } from 'lucide-react';
import type { Device, Overview, Scan } from '../shared/types';
import type { ActivityKind, Intelligence, Analytics } from '../shared/activity';
import { api, dateTime } from './lib';
import { navigation, type Page } from './navigation';
import { useNavigation, useResource } from './features/useWorkspace';
import { WorkspaceChrome } from './features/WorkspaceChrome';
import { OverviewPage, TrafficAnalytics, SecurityAlerts } from './features/Insights';
import { ActivityExplorer, RecordTimeline } from './features/ActivityExplorer';
import { DataSources } from './features/DataSources';
import { NetworkExplorer } from './features/NetworkExplorer';
import { PrivacySettings } from './features/PrivacySettings';
import { demoOverview, demoIntelligence } from './features/demo';
import { DeviceList } from './components/DeviceList';
import { DeviceDrawer } from './components/DeviceDrawer';
import { History } from './components/History';
import { Settings } from './components/Settings';
import { Panel, Skeleton } from './ui/primitives';
import { Button, IconButton } from './ui/Button';
const emptyIntelligence: Intelligence = {
  records: [],
  total: 0,
  truncated: false,
  sources: [],
  alerts: [],
  coverage: [],
  thresholdMbps: 100,
};
const emptyAnalytics: Analytics = { bandwidth: [], flows: [], domains: [] };
const periods: Record<string, number> = {
  '1h': 3600000,
  '24h': 86400000,
  '7d': 604800000,
  '30d': 2592000000,
};
const tabKinds: Record<string, ActivityKind | undefined> = {
  applications: 'connection',
  connections: 'connection',
  domains: 'dns',
  bandwidth: 'bandwidth',
};
export default function App() {
  const { page, params, navigate } = useNavigation();
  const demo = params.get('demo') === '1';
  const overview = useResource<Overview>('/overview', demo ? demoOverview : undefined);
  const [selected, setSelected] = useState<{ device: Device; historical: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [optimisticScan, setOptimisticScan] = useState<Scan | null>(null);
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const network =
    overview.data?.interfaces.find(
      (n) => n.id === (params.get('network') || overview.data?.settings.interfaceId),
    ) ?? overview.data?.interfaces[0];
  const devicesJSON = JSON.stringify(
    overview.data?.devices.filter((d) => !network || d.network === network.scanCidr) ?? [],
  );
  const devices = useMemo<Device[]>(() => JSON.parse(devicesJSON), [devicesJSON]);
  const scansJSON = JSON.stringify(
    overview.data?.scans.filter((s) => !network || s.network === network.scanCidr) ?? [],
  );
  const scans = useMemo<Scan[]>(() => JSON.parse(scansJSON), [scansJSON]);
  const period = periods[params.get('period') ?? ''] ? params.get('period')! : '24h';
  const since = new Date(clock - periods[period]).toISOString();
  const until = new Date(clock + 60000).toISOString();
  const previousSince = new Date(clock - periods[period] * 2).toISOString();
  const deviceId = params.get('device') ?? '';
  const tab = params.get('tab') ?? 'summary';
  const search = params.get('q') ?? '';
  const offset = Math.max(0, Number(params.get('offset')) || 0);
  const protocol = params.get('protocol') ?? '';
  const source = params.get('source') ?? '';
  const remotePort = params.get('port') ?? '';
  const kind = page === 'activity' ? tabKinds[tab] : page === 'traffic' ? 'bandwidth' : undefined;
  const query = new URLSearchParams({
    since,
    limit: page === 'activity' ? '200' : '1000',
    offset: page === 'activity' ? String(offset) : '0',
  });
  if (network) query.set('network', network.scanCidr);
  if (kind) query.set('kind', kind);
  if (page === 'activity' && deviceId) query.set('deviceId', deviceId);
  if (page === 'activity' && search) query.set('search', search);
  if (page === 'activity' && ['connections', 'applications'].includes(tab)) {
    if (protocol) query.set('protocol', protocol);
    if (source) query.set('source', source);
    if (remotePort) query.set('remotePort', remotePort);
  }
  const demoData = useMemo(() => {
    if (!demo) return undefined;
    let rows = demoIntelligence.records.filter(
      (r) =>
        r.timestamp >= since &&
        (!kind || r.kind === kind) &&
        (page !== 'activity' || !deviceId || r.deviceId === deviceId) &&
        (page !== 'activity' ||
          !['connections', 'applications'].includes(tab) ||
          ((!protocol || r.protocol === protocol) &&
            (!source || r.source.sourceKind === source) &&
            (!remotePort || r.remotePort === Number(remotePort)))) &&
        (!search ||
          page !== 'activity' ||
          JSON.stringify(r).toLowerCase().includes(search.toLowerCase())),
    );
    const total = rows.length;
    rows = rows.slice(
      page === 'activity' ? offset : 0,
      (page === 'activity' ? offset : 0) + (page === 'activity' ? 200 : 1000),
    );
    return { ...demoIntelligence, records: rows, total, truncated: rows.length < total };
  }, [demo, since, kind, page, deviceId, search, offset, tab, protocol, source, remotePort]);
  const intelligence = useResource<Intelligence>(`/intelligence?${query}`, demoData);
  const analyticsQuery = new URLSearchParams({ network: network?.scanCidr ?? '', since, until });
  const previousQuery = new URLSearchParams({
    network: network?.scanCidr ?? '',
    since: previousSince,
    until: since,
  });
  const demoAnalytics = useMemo<Analytics | undefined>(() => {
    if (!demo) return undefined;
    const r = demoIntelligence.records.filter((r) => r.kind === 'bandwidth');
    return {
      ...emptyAnalytics,
      bandwidth: [
        {
          deviceId: 'demo-studio',
          bytesIn: r.reduce((n, v) => n + (v.bytesIn ?? 0), 0),
          bytesOut: r.reduce((n, v) => n + (v.bytesOut ?? 0), 0),
          peakIn: Math.max(...r.map((v) => v.rateIn ?? 0)),
          peakOut: Math.max(...r.map((v) => v.rateOut ?? 0)),
          intervals: r.length,
          seconds: r.length * 10,
          first: r.at(-1)!.timestamp,
          last: r[0].timestamp,
        },
      ],
      domains: demoIntelligence.records
        .filter((r) => r.domain)
        .map((r) => ({ domain: r.domain!, observations: 1 })),
    };
  }, [demo]);
  const analytics = useResource<Analytics>(
    `/analytics?${analyticsQuery}`,
    demo ? demoAnalytics : page === 'traffic' && network ? undefined : emptyAnalytics,
  );
  const previous = useResource<Analytics>(
    `/analytics?${previousQuery}`,
    demo || page !== 'traffic' || !network ? emptyAnalytics : undefined,
  );
  const ids = new Set(devices.map((d) => d.id));
  const raw = intelligence.data ?? emptyIntelligence;
  const data = {
    ...raw,
    records: raw.records.filter((r) => ids.has(r.deviceId)),
    coverage: raw.coverage.filter((c) => ids.has(c.deviceId)),
    alerts: raw.alerts.filter((a) => (!a.deviceId || ids.has(a.deviceId)) && a.timestamp >= since),
  };
  const { refresh: refreshOverview } = overview;
  const { refresh: refreshIntelligence } = intelligence;
  const { refresh: refreshAnalytics } = analytics;
  const { refresh: refreshPrevious } = previous;
  const refresh = useCallback(async () => {
    await Promise.all([
      refreshOverview(),
      refreshIntelligence(),
      refreshAnalytics(),
      refreshPrevious(),
    ]);
  }, [refreshOverview, refreshIntelligence, refreshAnalytics, refreshPrevious]);
  const go = (next: Page) => {
    navigate({ page: next, offset: null });
    setSelected(null);
  };
  const openActivity = (id: string) => {
    navigate({ page: 'activity', device: id, offset: null, tab: 'summary', q: null });
    setSelected(null);
  };
  const currentScan = demo
    ? null
    : (overview.data?.activeScan ??
      (optimisticScan &&
      !overview.data?.scans.some((s) => s.id === optimisticScan.id && s.status !== 'running')
        ? optimisticScan
        : null));
  const scanning = Boolean(currentScan) || busy;
  async function scan(passive = false) {
    if (!network || demo) return;
    setBusy(true);
    setActionError('');
    try {
      const scan = await api<Scan>('/scans', {
        method: 'POST',
        body: JSON.stringify({ interfaceId: network.id, mode: passive ? 'passive' : 'discovery' }),
      });
      setOptimisticScan(scan);
      await refresh();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (demo) return;
    try {
      await api('/scans/cancel', { method: 'POST' });
      await refresh();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  const meta = navigation.find((n) => n.id === page)!;
  const latest = scans.find((s) => s.status === 'complete');
  const error =
    overview.error ||
    intelligence.error ||
    (page === 'traffic' && (analytics.error || previous.error)) ||
    actionError;
  return (
    <WorkspaceChrome
      page={page}
      devices={devices}
      demo={demo}
      onNavigate={go}
      onDevice={openActivity}
      onDemo={() => {
        setSelected(null);
        setOptimisticScan(null);
        navigate({ demo: demo ? null : '1', device: null, network: null, offset: null });
      }}
    >
      <div className="page-heading">
        <div>
          <h1>{meta.label}</h1>
          <p>{meta.description}</p>
        </div>
        <div className="heading-actions">
          <IconButton
            className="secondary"
            onClick={() => void refresh()}
            label="Actualiser les observations"
          >
            <RefreshCw size={16} />
          </IconButton>
          <Button
            variant="primary"
            busy={scanning}
            disabled={demo || scanning || !network || Boolean(overview.error)}
            onClick={() => void scan()}
          >
            {!scanning && <Radio size={16} />}
            {scanning ? 'Découverte en cours…' : 'Découvrir le réseau'}
          </Button>
        </div>
      </div>
      <div className="context-bar">
        <label>
          <Network size={15} />
          <span className="sr-only">Interface réseau</span>
          <select
            aria-label="Interface réseau"
            value={network?.id ?? ''}
            onChange={(e) => navigate({ network: e.target.value, device: null, offset: null })}
          >
            {overview.data?.interfaces.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} · {n.scanCidr}
              </option>
            ))}
          </select>
        </label>
        <span className="context-divider" />
        <label>
          <Clock3 size={15} />
          <span className="sr-only">Période d’analyse</span>
          <select
            aria-label="Période d’analyse"
            value={period}
            onChange={(e) => navigate({ period: e.target.value, offset: null })}
          >
            <option value="1h">Dernière heure</option>
            <option value="24h">Dernières 24 heures</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
          </select>
        </label>
        <span className="last-sync">
          {latest ? `Découverte : ${dateTime(latest.finishedAt!)}` : 'Aucune découverte conservée'}
        </span>
      </div>
      {intelligence.loading && overview.data && (
        <p className="hint" role="status">
          Mise à jour des observations…
        </p>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button
            className="text-button"
            onClick={() => {
              setActionError('');
              void refresh();
            }}
          >
            Réessayer
          </button>
        </div>
      )}
      {currentScan && (
        <div className="scan-progress" role="status">
          <Radio className="pulse" size={18} />
          <span>
            Découverte du périmètre {currentScan.network}. Les résultats apparaîtront à la fin.
          </span>
          <button className="button secondary" onClick={() => void cancel()}>
            <Square size={13} />
            Arrêter
          </button>
        </div>
      )}
      {latest?.warnings.map((w) => (
        <p className="notice" key={w}>
          {w}
        </p>
      ))}
      {!overview.data ? (
        <Skeleton />
      ) : (
        <>
          {!demo && !devices.length && page === 'overview' && (
            <section className="onboarding">
              <div>
                <span className="eyebrow">BIENVENUE DANS VOTRE OBSERVATOIRE</span>
                <h2>
                  Comprendre votre réseau.
                  <br />
                  Une observation à la fois.
                </h2>
                <p>
                  Choisissez votre interface ci-dessus et lancez la première découverte. Aucun agent
                  n’est activé automatiquement.
                </p>
                <button
                  className="button primary"
                  disabled={!network || scanning}
                  onClick={() => void scan()}
                >
                  Commencer la découverte <ArrowRight size={16} />
                </button>
              </div>
              <div className="onboarding-levels">
                <div>
                  <Network size={22} />
                  <h3>Network Intelligence</h3>
                  <p>
                    Découverte, identité et historique. Ajoutez des journaux DNS ou des flux pour
                    enrichir la visibilité.
                  </p>
                </div>
                <div>
                  <ShieldCheck size={22} />
                  <h3>Device Intelligence</h3>
                  <p>
                    Agent optionnel et explicite sur cet ordinateur. Processus observés, sans
                    collecter le contenu des communications.
                  </p>
                </div>
              </div>
            </section>
          )}
          {page === 'overview' && (
            <OverviewPage
              devices={devices}
              data={data}
              onDevice={openActivity}
              onSources={() => go('sources')}
              onNetwork={() => go('network')}
            />
          )}
          {page === 'network' && (
            <NetworkExplorer
              key={demo ? 'demo' : network?.id}
              devices={devices}
              network={network}
              scans={scans}
              demo={demo}
              onSelect={(device, historical = false) => setSelected({ device, historical })}
              onActivity={openActivity}
              onHistory={() => go('history')}
            />
          )}
          {page === 'activity' && (
            <ActivityExplorer
              devices={devices}
              deviceId={deviceId}
              tab={tab}
              records={data.records}
              total={data.total}
              offset={offset}
              search={search}
              protocol={protocol}
              source={source}
              remotePort={remotePort}
              onChange={navigate}
              onSources={() => go('sources')}
            />
          )}
          {page === 'devices' && (
            <>
              <DeviceList
                devices={devices}
                onSelect={(device) => setSelected({ device, historical: false })}
                onActivity={openActivity}
              />
              {!demo && (
                <div className="export-buttons">
                  <a className="button secondary" href="/api/export?format=json" download>
                    Exporter l’inventaire JSON
                  </a>
                  <a className="button secondary" href="/api/export?format=csv" download>
                    Exporter CSV
                  </a>
                </div>
              )}
            </>
          )}
          {page === 'traffic' && (
            <TrafficAnalytics
              devices={devices}
              data={data}
              analytics={analytics.data}
              previous={previous.data}
              deviceId={deviceId}
              onDevice={openActivity}
              onSelect={(id) => navigate({ device: id })}
            />
          )}
          {page === 'history' && (
            <>
              <RecordTimeline records={data.records.slice(0, 100)} onDevice={openActivity} />
              <p className="table-note">
                100 dernières observations affichées au maximum. Explorez l’activité d’un appareil
                pour parcourir le journal paginé.
              </p>
              {demo ? (
                <Panel title="Instantané simulé" kicker="HISTORIQUE">
                  <DeviceList
                    devices={devices}
                    onSelect={(device) => setSelected({ device, historical: true })}
                    onActivity={openActivity}
                  />
                </Panel>
              ) : (
                <History
                  scans={scans}
                  onSelect={(device) => setSelected({ device, historical: true })}
                />
              )}
            </>
          )}
          {page === 'security' && (
            <SecurityAlerts
              data={data}
              devices={devices}
              demo={demo}
              onRefresh={refresh}
              onDevice={openActivity}
            />
          )}
          {page === 'sources' && (
            <DataSources
              data={data}
              devices={devices}
              demo={demo}
              onRefresh={refresh}
              onDevice={openActivity}
            />
          )}
          {page === 'settings' && (
            <>
              {demo ? (
                <Panel title="Préférences de la démo" kicker="ESPACE ISOLÉ">
                  <p>
                    Les réglages de collecte et les écritures sont désactivés dans la simulation. Le
                    thème reste personnalisable avec le bouton de la barre supérieure.
                  </p>
                </Panel>
              ) : (
                <Settings
                  data={overview.data}
                  onSaved={refresh}
                  onPassive={() => void scan(true)}
                />
              )}
              <PrivacySettings demo={demo} onRefresh={refresh} />
            </>
          )}
          {data.truncated && page !== 'activity' && (
            <p className="table-note">
              Cette vue présente les 1 000 observations les plus récentes de la période. Les totaux
              analytiques sont calculés sur l’historique conservé.
            </p>
          )}
        </>
      )}
      {selected && (
        <DeviceDrawer
          key={selected.device.id}
          device={selected.device}
          readOnly={demo || selected.historical}
          onClose={() => setSelected(null)}
          onSaved={refresh}
          onActivity={() => openActivity(selected.device.id)}
        />
      )}
    </WorkspaceChrome>
  );
}
