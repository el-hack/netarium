import { useState } from 'react';
import { ArrowUpRight, ShieldCheck, Radio, Check, BellOff } from 'lucide-react';
import type { Device } from '../../shared/types';
import {
  activitySummary,
  type Intelligence,
  type Analytics,
  type NetworkAlert,
} from '../../shared/activity';
import { api, deviceName, dateTime } from '../lib';
import { Panel, Metric, Empty, bytes, rate } from '../ui/primitives';
import { TrafficChart } from '../ui/TrafficChart';
import { RecordTimeline } from './ActivityExplorer';
export function OverviewPage({
  devices,
  data,
  onDevice,
  onSources,
  onNetwork,
}: {
  devices: Device[];
  data: Intelligence;
  onDevice: (id: string) => void;
  onSources: () => void;
  onNetwork: () => void;
}) {
  const self = devices.find((d) => d.role === 'self');
  const local = data.records.filter((r) => r.deviceId === self?.id);
  const summary = activitySummary(local);
  const activeSources = data.sources.filter((s) => s.enabled && !s.error).length;
  return (
    <>
      <div className="visibility-band">
        <span>
          <Radio size={18} />
          <strong>Visibilité partielle</strong>
          <span>Découverte réseau · télémétrie selon les sources</span>
        </span>
        <button className="text-button" onClick={onSources}>
          {activeSources} sources activées <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="metric-strip">
        <Metric
          label="Appareils connus"
          value={devices.length}
          detail="Inventaire du périmètre sélectionné"
        />
        <Metric
          label="Observés au dernier relevé"
          value={devices.filter((d) => d.status === 'observed').length}
          detail="Présence observée, pas une garantie en direct"
        />
        <Metric
          label="Dernier débit entrant"
          value={rate(summary.latestBandwidth?.rateIn)}
          detail={
            summary.latestBandwidth
              ? `${self ? deviceName(self) : 'Cet ordinateur'} · ${dateTime(summary.latestBandwidth.timestamp)}`
              : 'Aucune mesure locale disponible'
          }
        />
        <Metric
          label="Alertes à examiner"
          value={
            data.alerts.filter(
              (a) =>
                a.status === 'open' && (!a.mutedUntil || Date.parse(a.mutedUntil) < Date.now()),
            ).length
          }
          detail="Observations et seuils, pas verdicts de sécurité"
        />
      </div>
      <div className="overview-columns">
        <Panel
          title="Trafic de cet ordinateur"
          kicker="INTERFACE TELEMETRY"
          actions={
            <button
              className="text-button"
              disabled={!self}
              onClick={() => self && onDevice(self.id)}
            >
              Explorer <ArrowUpRight size={14} />
            </button>
          }
        >
          <TrafficChart records={local} />
        </Panel>
        <Panel title="État des sources" kicker="COLLECTION STATUS">
          <div className="collector-summary">
            {data.sources.map((s) => (
              <button key={s.id} onClick={onSources}>
                <span className={`source-dot ${s.error ? 'error' : s.enabled ? 'active' : ''}`} />
                <span>
                  {s.name}
                  <small>
                    {s.error
                      ? 'Une erreur demande votre attention'
                      : s.lastSync
                        ? dateTime(s.lastSync)
                        : 'Aucun relevé'}
                  </small>
                </span>
                <span>{s.error ? 'Erreur' : s.enabled ? 'Activée' : 'Inactive'}</span>
              </button>
            ))}
          </div>
        </Panel>
      </div>
      <div className="overview-columns lower">
        <Panel
          title="Les appareils du réseau"
          kicker="INVENTAIRE"
          actions={
            <button className="text-button" onClick={onNetwork}>
              Ouvrir la carte <ArrowUpRight size={14} />
            </button>
          }
        >
          <div className="overview-devices">
            {devices.slice(0, 8).map((d) => (
              <button key={d.id} onClick={() => onDevice(d.id)}>
                <span className={`source-dot ${d.status === 'observed' ? 'active' : ''}`} />
                <span>
                  <strong>{deviceName(d)}</strong>
                  <small>{d.ip}</small>
                </span>
                <span>{data.coverage.filter((c) => c.deviceId === d.id).length} sources</span>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
          {!devices.length && (
            <Empty title="Votre inventaire commence ici">
              Lancez une première découverte du périmètre sélectionné.
            </Empty>
          )}
        </Panel>
        <RecordTimeline
          records={data.records.filter((r) => r.kind !== 'bandwidth').slice(0, 5)}
          onDevice={onDevice}
        />
      </div>
    </>
  );
}
export function TrafficAnalytics({
  data,
  analytics,
  previous,
  devices,
  deviceId,
  onDevice,
  onSelect,
}: {
  data: Intelligence;
  analytics: Analytics | null;
  previous: Analytics | null;
  devices: Device[];
  deviceId: string;
  onDevice: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const device =
    devices.find((d) => d.id === deviceId) ?? devices.find((d) => d.role === 'self') ?? devices[0];
  const current = analytics?.bandwidth.find((r) => r.deviceId === device?.id);
  const before = previous?.bandwidth.find((r) => r.deviceId === device?.id);
  return (
    <>
      <div className="analysis-heading">
        <div>
          <h2>Une mesure, un périmètre.</h2>
          <p>
            Les compteurs locaux et les flux importés sont analysés séparément pour éviter tout
            double comptage.
          </p>
        </div>
        <label className="field">
          Interface de l’appareil
          <select value={device?.id ?? ''} onChange={(e) => onSelect(e.target.value)}>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {deviceName(d)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="metric-strip">
        <Metric
          label="Volume entrant · période"
          value={bytes(current?.bytesIn)}
          detail={`${current?.intervals ?? 0} intervalles mesurés · source interface`}
        />
        <Metric
          label="Volume sortant · période"
          value={bytes(current?.bytesOut)}
          detail={`${Math.round(current?.seconds ?? 0)} secondes couvertes`}
        />
        <Metric
          label="Pic entrant observé"
          value={rate(current?.peakIn)}
          detail="Maximum des intervalles, pas pic instantané"
        />
        <Metric
          label="Période précédente · entrant"
          value={bytes(before?.bytesIn)}
          detail={`${before?.intervals ?? 0} intervalles · couverture potentiellement différente`}
        />
      </div>
      <Panel
        title={`Débit · ${device ? deviceName(device) : 'aucun appareil'}`}
        kicker="ÉVOLUTION DES INTERVALLES"
        actions={
          <button
            className="text-button"
            disabled={!device}
            onClick={() => device && onDevice(device.id)}
          >
            Activity Explorer <ArrowUpRight size={14} />
          </button>
        }
      >
        <TrafficChart records={data.records.filter((r) => r.deviceId === device?.id)} />
        <p className="table-note">
          Graphique limité aux 120 derniers intervalles reçus. Les totaux ci-dessus sont calculés
          sur toute la période conservée. Les interruptions de collecte restent vides.
        </p>
      </Panel>
      <div className="analysis-columns">
        <Panel title="Volumes par appareil" kicker="COMPTEURS D’INTERFACE">
          {analytics?.bandwidth.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Appareil</th>
                    <th>Entrant</th>
                    <th>Sortant</th>
                    <th>Couverture</th>
                  </tr>
                </thead>
                <tbody>
                  {[...analytics.bandwidth]
                    .sort((a, b) => (b.bytesIn ?? 0) - (a.bytesIn ?? 0))
                    .map((r) => (
                      <tr key={r.deviceId}>
                        <td>
                          <button className="text-button" onClick={() => onDevice(r.deviceId)}>
                            {deviceName(devices.find((d) => d.id === r.deviceId)!)}
                          </button>
                        </td>
                        <td>{bytes(r.bytesIn)}</td>
                        <td>{bytes(r.bytesOut)}</td>
                        <td>{Math.round(r.seconds)} s</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Aucun volume mesuré">
              Les appareils découverts ne sont pas classés arbitrairement par consommation.
            </Empty>
          )}
        </Panel>
        <Panel title="Domaines observés" kicker="REQUÊTES DNS · PAS DES OCTETS">
          {analytics?.domains.length ? (
            <ol className="ranked-list">
              {analytics.domains.map((d) => (
                <li key={d.domain}>
                  <span>{d.domain}</span>
                  <strong>{d.observations} observations</strong>
                </li>
              ))}
            </ol>
          ) : (
            <Empty title="Aucune observation DNS">
              Importez un journal pour enrichir cette analyse.
            </Empty>
          )}
        </Panel>
      </div>
      <Panel title="Flux importés par protocole" kicker="MESURES DÉCLARÉES · SOURCE DISTINCTE">
        {analytics?.flows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Appareil</th>
                  <th>Protocole</th>
                  <th>Flux</th>
                  <th>Entrant déclaré</th>
                  <th>Sortant déclaré</th>
                </tr>
              </thead>
              <tbody>
                {analytics.flows.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <button className="text-button" onClick={() => onDevice(r.deviceId)}>
                        {devices.find((d) => d.id === r.deviceId)
                          ? deviceName(devices.find((d) => d.id === r.deviceId)!)
                          : r.deviceId}
                      </button>
                    </td>
                    <td>{r.protocol ?? 'Inconnu'}</td>
                    <td>{r.observations}</td>
                    <td>{bytes(r.bytesIn)}</td>
                    <td>{bytes(r.bytesOut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Aucun flux normalisé importé">
            La répartition par application reste indisponible sans mesure dédiée.
          </Empty>
        )}
      </Panel>
    </>
  );
}
export function SecurityAlerts({
  data,
  devices,
  demo,
  onRefresh,
  onDevice,
}: {
  data: Intelligence;
  devices: Device[];
  demo: boolean;
  onRefresh: () => Promise<void>;
  onDevice: (id: string) => void;
}) {
  const [filter, setFilter] = useState('open');
  const [severity, setSeverity] = useState('all');
  const [threshold, setThreshold] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const visible = data.alerts.filter(
    (a) =>
      (filter === 'all' ||
        (filter === 'muted'
          ? a.mutedUntil && Date.parse(a.mutedUntil) > Date.now()
          : a.status === filter && (!a.mutedUntil || Date.parse(a.mutedUntil) < Date.now()))) &&
      (severity === 'all' || a.severity === severity),
  );
  async function action(path: string, method: string, body: unknown) {
    setBusy(true);
    setError('');
    try {
      await api(path, { method, body: JSON.stringify(body) });
      await onRefresh();
      setMessage('Modification enregistrée.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const update = (a: NetworkAlert, mute: boolean) =>
    void action(`/alerts/${encodeURIComponent(a.id)}`, 'PATCH', {
      status: mute ? a.status : a.status === 'open' ? 'acknowledged' : 'open',
      mutedUntil: mute ? new Date(Date.now() + 3600000).toISOString() : null,
    });
  return (
    <>
      <div className="visibility-banner">
        <ShieldCheck size={25} />
        <div>
          <h2>Des signaux à examiner.</h2>
          <p>
            Ces règles détectent des changements et des dépassements de seuil. Elles n’analysent pas
            de contenu et ne prouvent pas une attaque.
          </p>
        </div>
      </div>
      <div className="filter-bar">
        <label>
          État
          <select
            aria-label="État des alertes"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="open">À examiner</option>
            <option value="acknowledged">Traitées</option>
            <option value="muted">En silence</option>
            <option value="all">Toutes</option>
          </select>
        </label>
        <label>
          Gravité
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="all">Toutes</option>
            <option value="info">Information</option>
            <option value="warning">Attention</option>
          </select>
        </label>
        <form
          className="threshold-form"
          onSubmit={(e) => {
            e.preventDefault();
            void action('/alerts/threshold', 'PUT', { mbps: threshold ?? data.thresholdMbps });
          }}
        >
          <label>
            Seuil de débit (Mbit/s)
            <input
              type="number"
              min="1"
              max="100000"
              required
              disabled={demo || busy}
              value={threshold ?? data.thresholdMbps}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </label>
          <button className="button secondary" disabled={demo || busy}>
            Enregistrer
          </button>
        </form>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="success-message">
          {message}
        </p>
      )}
      <section className="alert-list" aria-label="Alertes conservées">
        {visible.length ? (
          visible.map((a) => (
            <article key={a.id} className={`alert-row ${a.severity}`}>
              <span className="alert-marker" />
              <div>
                <div className="source-title">
                  <h3>{a.title}</h3>
                  <span className="soft-tag">
                    {a.severity === 'warning' ? 'Attention' : 'Information'}
                  </span>
                </div>
                <p>{a.explanation}</p>
                <div className="alert-meta">
                  <time>{dateTime(a.timestamp)}</time>
                  <span>Source : {a.sourceId}</span>
                  <span>{a.status === 'open' ? 'À examiner' : 'Traitée'}</span>
                  {a.mutedUntil && <span>Silence jusqu’à {dateTime(a.mutedUntil)}</span>}
                  {a.deviceId && (
                    <button className="text-button" onClick={() => onDevice(a.deviceId)}>
                      {devices.find((d) => d.id === a.deviceId)
                        ? deviceName(devices.find((d) => d.id === a.deviceId)!)
                        : 'Appareil historique'}
                      <ArrowUpRight size={13} />
                    </button>
                  )}
                </div>
              </div>
              <div className="alert-actions">
                <button
                  className="button secondary"
                  disabled={demo || busy}
                  onClick={() => update(a, false)}
                >
                  <Check size={14} />
                  {a.status === 'open' ? 'Traiter' : 'Rouvrir'}
                </button>
                <button
                  className="icon-button"
                  aria-label={`Silence 1 h : ${a.title}`}
                  disabled={demo || busy}
                  onClick={() => update(a, true)}
                >
                  <BellOff size={17} />
                </button>
              </div>
            </article>
          ))
        ) : (
          <Empty title="Aucune alerte dans cette vue">
            L’absence d’alerte ne garantit pas la sécurité du réseau. Seules les sources configurées
            sont analysées.
          </Empty>
        )}
      </section>
      <p className="table-note">
        Règles actives : première observation, changement d’IP, nouveau domaine importé, seuil de
        débit local et erreur de collecteur. Maximum 500 alertes affichées. L’analyse
        comportementale statistique n’est pas intégrée.
      </p>
    </>
  );
}
