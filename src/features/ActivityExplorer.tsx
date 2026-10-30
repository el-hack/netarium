import { serviceHint } from '../../shared/services';
import { useMemo } from 'react';
import { Activity, ArrowDownLeft, ArrowUpRight, Database } from 'lucide-react';
import type { Device } from '../../shared/types';
import type { ActivityRecord, Intelligence } from '../../shared/activity';
import { activitySummary } from '../../shared/activity';
import { dateTime, deviceName, deviceTypeLabel } from '../lib';
import { DeviceIcon } from '../components/Icons';
import { Empty, Metric, Panel, SourceBadge, bytes, rate } from '../ui/primitives';
import { TrafficChart } from '../ui/TrafficChart';
export const activityTabs = [
  ['summary', 'Vue générale'],
  ['applications', 'Applications'],
  ['domains', 'Websites & Domains'],
  ['connections', 'Connections'],
  ['bandwidth', 'Bandwidth'],
  ['timeline', 'Timeline'],
] as const;
export function ActivityExplorer({
  devices,
  deviceId,
  tab,
  records,
  total,
  offset,
  search,
  protocol,
  source,
  remotePort,
  onChange,
  onSources,
}: {
  devices: Device[];
  deviceId: string;
  tab: string;
  records: ActivityRecord[];
  total: number;
  offset: number;
  search: string;
  protocol: string;
  source: string;
  remotePort: string;
  onChange: (v: Record<string, string | null>) => void;
  onSources: () => void;
}) {
  const device = devices.find((d) => d.id === deviceId);
  const summary = useMemo(() => activitySummary(records), [records]);
  if (!device)
    return (
      <Panel title="Choisissez un appareil" kicker="DEVICE ACTIVITY">
        <Empty
          title="Une activité, un appareil, une source."
          action={
            <button className="button secondary" onClick={onSources}>
              Comprendre la visibilité
            </button>
          }
        >
          Sélectionnez un appareil pour explorer ses observations réelles.
        </Empty>
        <div className="device-picker">
          {devices.map((d) => (
            <button
              key={d.id}
              onClick={() => onChange({ device: d.id, tab: 'summary', offset: null })}
            >
              <DeviceIcon device={d} />
              <span>
                {deviceName(d)}
                <small>
                  {d.ip} · {deviceTypeLabel(d)}
                </small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </div>
      </Panel>
    );
  const selectedTab = activityTabs.some((t) => t[0] === tab) ? tab : 'summary';
  return (
    <div className="activity-explorer">
      <div className="device-masthead">
        <span className="device-icon large">
          <DeviceIcon device={device} size={27} />
        </span>
        <div>
          <span className="eyebrow">DEVICE INTELLIGENCE / NETWORK INTELLIGENCE</span>
          <h2>{deviceName(device)}</h2>
          <p>
            <code>{device.ip}</code> · {deviceTypeLabel(device)}
          </p>
        </div>
        <label className="device-select">
          <span className="sr-only">Appareil analysé</span>
          <select
            aria-label="Appareil analysé"
            value={deviceId}
            onChange={(e) => onChange({ device: e.target.value, offset: null })}
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {deviceName(d)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <nav className="activity-tabs" aria-label="Vues de l’activité">
        {activityTabs.map(([id, label]) => (
          <button
            key={id}
            aria-current={selectedTab === id ? 'page' : undefined}
            className={selectedTab === id ? 'active' : ''}
            onClick={() => onChange({ tab: id, offset: null, q: null })}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="activity-context">
        <span>
          <Database size={14} />
          {new Set(records.map((r) => r.source.sourceId)).size} source(s) dans cette vue
        </span>
        <span>
          {total} observations · {records.length} affichées
        </span>
        <button className="text-button" onClick={onSources}>
          Voir les capacités
        </button>
      </div>
      {selectedTab === 'summary' && (
        <>
          <div className="metric-strip">
            <Metric
              label="Débit entrant mesuré"
              value={rate(summary.latestBandwidth?.rateIn)}
              detail={
                summary.latestBandwidth
                  ? `Dernier échantillon · ${dateTime(summary.latestBandwidth.timestamp)}`
                  : 'Source de débit absente'
              }
            />
            <Metric
              label="Débit sortant mesuré"
              value={rate(summary.latestBandwidth?.rateOut)}
              detail="Mesure locale, pas le trafic de tout le LAN"
            />
            <Metric
              label="Sockets échantillonnés"
              value={summary.connections || '—'}
              detail="Observations cumulées, pas sessions uniques"
            />
            <Metric
              label="Domaines observés"
              value={summary.domains || '—'}
              detail="DNS ≠ visites web"
            />
          </div>
          <div className="analysis-columns">
            <Panel title="Trafic mesuré" kicker="BANDWIDTH">
              <TrafficChart records={records} />
            </Panel>
            <Panel title="Ce que cette vue permet" kicker="VISIBILITY">
              <div className="capability-explanation">
                <Activity size={26} />
                <h3>
                  {records.some((r) => r.source.sourceKind === 'agent')
                    ? 'Les processus sont observables.'
                    : 'L’activité applicative est partielle.'}
                </h3>
                <p>
                  La découverte identifie des équipements. Un agent local peut associer des sockets
                  à un processus. Les volumes par application restent inconnus sans compteur dédié.
                </p>
                <button className="button secondary" onClick={onSources}>
                  Configurer les sources
                </button>
              </div>
            </Panel>
          </div>
          <RecordTimeline records={records.slice(0, 12)} />
        </>
      )}
      {selectedTab === 'bandwidth' && (
        <Panel title="Évolution du débit" kicker="MESURES D’INTERFACE">
          <TrafficChart records={records} />
          <div className="metric-strip">
            <Metric
              label="Volume entrant"
              value={bytes(summary.bytesIn)}
              detail="Somme des intervalles affichés"
            />
            <Metric
              label="Volume sortant"
              value={bytes(summary.bytesOut)}
              detail="Les intervalles manquants ne sont pas interpolés"
            />
          </div>
        </Panel>
      )}
      {['applications', 'connections'].includes(selectedTab) && (
        <div className="filter-bar">
          <label>
            Protocole
            <select
              value={protocol}
              onChange={(e) => onChange({ protocol: e.target.value || null, offset: null })}
            >
              <option value="">Tous</option>
              {['TCP', 'UDP', 'ICMP'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Source
            <select
              value={source}
              onChange={(e) => onChange({ source: e.target.value || null, offset: null })}
            >
              <option value="">Toutes</option>
              <option value="agent">Agent local</option>
              <option value="flow-import">Flux importés</option>
            </select>
          </label>
          <label>
            Port distant
            <input
              type="number"
              min="0"
              max="65535"
              value={remotePort}
              onChange={(e) => onChange({ port: e.target.value || null, offset: null })}
              placeholder="Tous"
            />
          </label>
        </div>
      )}
      {selectedTab === 'applications' && (
        <ApplicationTable records={records} onSources={onSources} />
      )}
      {selectedTab === 'domains' && (
        <>
          <p className="notice">
            Une observation DNS ne prouve ni une visite volontaire, ni une page consultée. Aucun
            contenu HTTPS n’est collecté.
          </p>
          <Search value={search} onChange={(q) => onChange({ q, offset: null })} />
          <DomainTable records={records} onSources={onSources} />
        </>
      )}
      {selectedTab === 'connections' && (
        <>
          <Search value={search} onChange={(q) => onChange({ q, offset: null })} />
          <ConnectionTable records={records} onSources={onSources} />
        </>
      )}
      {selectedTab === 'timeline' && <RecordTimeline records={records} />}
      <div className="pagination">
        <span>Observations de la période sélectionnée · sources indiquées sur chaque ligne</span>
        <button
          className="button secondary"
          disabled={offset === 0}
          onClick={() => onChange({ offset: String(Math.max(0, offset - 200)) })}
        >
          Précédent
        </button>
        <span>{Math.floor(offset / 200) + 1}</span>
        <button
          className="button secondary"
          disabled={offset + 200 >= total}
          onClick={() => onChange({ offset: String(offset + 200) })}
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
function Search({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="activity-search">
      Filtrer les observations
      <input
        type="search"
        placeholder="Domaine, processus, destination…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function RecordTimeline({
  records,
  onDevice,
}: {
  records: ActivityRecord[];
  onDevice?: (id: string) => void;
}) {
  return (
    <Panel title="Fil des observations" kicker="TIMELINE">
      {records.length ? (
        <ol className="event-timeline">
          {records.map((r) => (
            <li key={`${r.source.sourceId}:${r.id}`}>
              <span className={`event-symbol ${r.kind}`}>
                <Activity size={15} />
              </span>
              <div>
                <strong>
                  {r.kind === 'dns'
                    ? r.domain
                    : r.kind === 'connection'
                      ? `${r.process ?? 'Flux réseau'} → ${r.remoteIp ?? 'Destination non disponible'}`
                      : r.detail}
                </strong>
                <p>
                  {r.kind === 'connection'
                    ? `${r.protocol ?? '—'} · ${r.state} · ports ${r.localPort ?? '—'} → ${r.remotePort ?? '—'}`
                    : r.kind === 'dns'
                      ? 'Requête déclarée par la source DNS'
                      : ((
                          {
                            observed: 'Observation conservée',
                            'first-seen': 'Première observation',
                            'not-observed': 'Non revu dans ce relevé',
                          } as Record<string, string>
                        )[r.state] ?? r.state)}
                </p>
                <SourceBadge record={r} />
              </div>
              <div className="event-time">
                <time>{dateTime(r.timestamp)}</time>
                {onDevice && (
                  <button className="text-button" onClick={() => onDevice(r.deviceId)}>
                    Explorer <ArrowUpRight size={13} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <Empty title="Aucune observation sur cette période">
          Aucune activité n’a été conservée par les sources disponibles.
        </Empty>
      )}
    </Panel>
  );
}
function ApplicationTable({
  records,
  onSources,
}: {
  records: ActivityRecord[];
  onSources: () => void;
}) {
  const groups = new Map<string, ActivityRecord[]>();
  for (const r of records)
    if (r.source.sourceKind === 'agent' && r.process) {
      groups.set(r.process, [...(groups.get(r.process) ?? []), r]);
    }
  return (
    <Panel title="Applications observées" kicker="IDENTIFICATION PAR PROCESSUS">
      {groups.size ? (
        <>
          <p className="table-note">
            Noms de processus issus de l’agent local. Ce tableau n’est pas un inventaire des
            logiciels installés.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Processus</th>
                  <th>Observations</th>
                  <th>Destinations</th>
                  <th>Première / dernière observation</th>
                  <th>Volume</th>
                  <th>Provenance</th>
                </tr>
              </thead>
              <tbody>
                {[...groups].map(([name, rows]) => (
                  <tr key={name}>
                    <td>
                      <strong>{name}</strong>
                      <small>Processus identifié · confiance élevée</small>
                    </td>
                    <td>{rows.length}</td>
                    <td>{new Set(rows.map((r) => r.remoteIp).filter(Boolean)).size}</td>
                    <td>
                      {dateTime(rows.at(-1)!.timestamp)}
                      <small>{dateTime(rows[0].timestamp)}</small>
                    </td>
                    <td>Non mesuré</td>
                    <td>
                      <SourceBadge record={rows[0]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <Empty
          title="Aucune application identifiée"
          action={
            <button className="button secondary" onClick={onSources}>
              Activer un agent local
            </button>
          }
        >
          Les services supposés depuis le réseau ne sont pas présentés comme des applications.
          L’agent ne couvre que cet ordinateur.
        </Empty>
      )}
    </Panel>
  );
}
function DomainTable({ records, onSources }: { records: ActivityRecord[]; onSources: () => void }) {
  const groups = new Map<string, ActivityRecord[]>();
  for (const r of records) if (r.domain) groups.set(r.domain, [...(groups.get(r.domain) ?? []), r]);
  return (
    <Panel title="Domaines observés" kicker="DNS OBSERVATION">
      {groups.size ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Domaine</th>
                <th>Observations</th>
                <th>Première / dernière</th>
                <th>Volume associé</th>
                <th>Provenance</th>
              </tr>
            </thead>
            <tbody>
              {[...groups].map(([domain, rows]) => (
                <tr key={domain}>
                  <td>
                    <strong>{domain}</strong>
                    <small>Observation déclarée · confiance modérée</small>
                  </td>
                  <td>{rows.length}</td>
                  <td>
                    {dateTime(rows.at(-1)!.timestamp)}
                    <small>{dateTime(rows[0].timestamp)}</small>
                  </td>
                  <td>Non mesuré</td>
                  <td>
                    <SourceBadge record={rows[0]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Aucune source DNS pour ces observations"
          action={
            <button className="button secondary" onClick={onSources}>
              Importer des observations DNS
            </button>
          }
        >
          Les adresses IP ne sont pas transformées arbitrairement en domaines.
        </Empty>
      )}
    </Panel>
  );
}
function ConnectionTable({
  records,
  onSources,
}: {
  records: ActivityRecord[];
  onSources: () => void;
}) {
  const rows = records.filter((r) => r.kind === 'connection');
  return (
    <Panel title="Connexions observées" kicker="SOCKETS & FLOWS">
      {rows.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Source → destination</th>
                <th>Protocole / état</th>
                <th>Processus</th>
                <th>Observé à</th>
                <th>Volume</th>
                <th>Provenance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code>
                      {r.localIp ?? '—'}:{r.localPort ?? '—'}
                    </code>
                    <small>
                      → {r.remoteIp ?? '—'}:{r.remotePort ?? '—'}
                    </small>
                  </td>
                  <td>
                    {r.protocol ?? '—'}
                    <small>{r.state}</small>
                    <small>
                      {serviceHint(r.remotePort, r.protocol) ?? 'Service non déterminé'}
                    </small>
                  </td>
                  <td>{r.process ?? 'Non identifié'}</td>
                  <td>
                    {dateTime(r.timestamp)}
                    <small>
                      {r.endAt
                        ? `Fin : ${dateTime(r.endAt)} · ${Math.max(0, Math.round((Date.parse(r.endAt) - Date.parse(r.timestamp)) / 1000))} s déclarées`
                        : 'Début réel / durée inconnus'}
                    </small>
                  </td>
                  <td>
                    <ArrowDownLeft size={12} />
                    {bytes(r.bytesIn)}
                    <small>
                      <ArrowUpRight size={12} />
                      {bytes(r.bytesOut)}
                    </small>
                  </td>
                  <td>
                    <SourceBadge record={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Les connexions ne sont pas encore observables"
          action={
            <button className="button secondary" onClick={onSources}>
              Configurer une source
            </button>
          }
        >
          Activez l’agent local ou importez des flux pour cet appareil.
        </Empty>
      )}
    </Panel>
  );
}
export function scopedRecords(data: Intelligence | null, ids: Set<string>) {
  return data?.records.filter((r) => ids.has(r.deviceId)) ?? [];
}
