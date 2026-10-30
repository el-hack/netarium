import { useEffect, useState } from 'react';
import {
  Camera,
  ArrowRight,
  Plus,
  Minus,
  RefreshCw,
  CircleCheck,
  CircleX,
  Clock3,
} from 'lucide-react';
import { compareSnapshots, type Device, type Scan, type Snapshot } from '../../shared/types';
import { api, dateTime, deviceName } from '../lib';
import { DeviceList } from './DeviceList';
export function History({
  scans,
  onSelect,
}: {
  scans: Scan[];
  onSelect: (device: Device) => void;
}) {
  const completed = scans.filter((scan) => scan.status === 'complete');
  const [selected, setSelected] = useState('');
  const [baseline, setBaseline] = useState('');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [before, setBefore] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const effective = selected || completed[0]?.id || '';
  useEffect(() => {
    let cancelled = false;
    setError('');
    setLoading(Boolean(effective));
    setSnapshot(null);
    setBefore(null);
    if (!effective) return;
    Promise.all([
      api<Snapshot>(`/snapshots/${effective}`),
      baseline ? api<Snapshot>(`/snapshots/${baseline}`) : Promise.resolve(null),
    ])
      .then(([current, previous]) => {
        if (!cancelled) {
          setSnapshot(current);
          setBefore(previous);
        }
      })
      .catch((error) => {
        if (!cancelled) setError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effective, baseline]);
  const diff = snapshot && before ? compareSnapshots(before.devices, snapshot.devices) : null;
  const differentScope = Boolean(
    snapshot && before && snapshot.scan.network !== before.scan.network,
  );
  return (
    <div className="history-layout">
      <section className="panel history-list">
        <div className="section-heading">
          <div>
            <span className="eyebrow">MÉMOIRE DU RÉSEAU</span>
            <h2>Les collectes</h2>
          </div>
          <Camera size={20} />
        </div>
        {scans.length ? (
          <ol className="scan-timeline">
            {scans.map((scan) => (
              <li key={scan.id}>
                <button
                  disabled={scan.status !== 'complete'}
                  className={effective === scan.id ? 'active' : ''}
                  onClick={() => setSelected(scan.id)}
                >
                  <span className={`timeline-symbol ${scan.status}`}>
                    {scan.status === 'complete' ? (
                      <CircleCheck size={17} />
                    ) : scan.status === 'running' ? (
                      <Clock3 size={17} />
                    ) : (
                      <CircleX size={17} />
                    )}
                  </span>
                  <span>
                    <strong>{dateTime(scan.startedAt)}</strong>
                    <small>
                      {scan.status === 'complete'
                        ? `${scan.count} appareils · ${scan.mode === 'passive' ? 'Observation locale' : 'Découverte'}`
                        : scan.status === 'running'
                          ? 'Collecte en cours'
                          : scan.status === 'cancelled'
                            ? 'Collecte annulée'
                            : 'Collecte échouée'}
                    </small>
                    <span className="mono">{scan.network}</span>
                    {scan.error && <small>{scan.error}</small>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-state">
            <Clock3 size={28} />
            <h3>Une histoire à écrire</h3>
            <p>Chaque collecte réussie créera un instantané consultable.</p>
          </div>
        )}
      </section>
      <div className="history-detail">
        <section className="panel comparison">
          <span className="eyebrow">VOYAGER DANS LE TEMPS</span>
          <h2>Ce qui a changé.</h2>
          <p className="muted">Comparez deux observations de votre réseau.</p>
          <label className="field">
            Comparer l’instantané sélectionné avec
            <select value={baseline} onChange={(event) => setBaseline(event.target.value)}>
              <option value="">Choisir un instantané de référence</option>
              {completed
                .filter((scan) => scan.id !== effective)
                .map((scan) => (
                  <option key={scan.id} value={scan.id}>
                    {dateTime(scan.startedAt)} · {scan.count} appareils · {scan.network}
                  </option>
                ))}
            </select>
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {loading && (
            <p role="status" className="muted">
              Chargement de l’instantané…
            </p>
          )}
          {differentScope ? (
            <p className="notice">
              Ces instantanés concernent des périmètres différents. Sélectionnez deux collectes du
              même réseau.
            </p>
          ) : diff ? (
            <>
              <div className="diff-stats">
                <span>
                  <Plus size={16} />
                  <strong>{diff.added.length}</strong> nouveaux
                </span>
                <span>
                  <Minus size={16} />
                  <strong>{diff.missing.length}</strong> non revus
                </span>
                <span>
                  <RefreshCw size={15} />
                  <strong>{diff.changed.length}</strong> modifiés
                </span>
              </div>
              <div className="diff-items">
                {diff.added.map((device) => (
                  <p key={`add-${device.id}`}>
                    <Plus size={14} />
                    {deviceName(device)}
                    <span>Nouvellement observé</span>
                  </p>
                ))}
                {diff.missing.map((device) => (
                  <p key={`missing-${device.id}`}>
                    <Minus size={14} />
                    {deviceName(device)}
                    <span>Absent de cet instantané</span>
                  </p>
                ))}
                {diff.changed.map(({ before, after }) => (
                  <p key={`change-${after.id}`}>
                    <RefreshCw size={14} />
                    {deviceName(after)}
                    <span>
                      {before.ip !== after.ip ? (
                        <>
                          {before.ip}
                          <ArrowRight size={12} />
                          {after.ip}
                        </>
                      ) : (
                        'Observation mise à jour'
                      )}
                    </span>
                  </p>
                ))}
              </div>
              {!diff.added.length && !diff.missing.length && !diff.changed.length && (
                <p className="hint">
                  <CircleCheck size={16} />
                  Aucun changement observé entre ces instantanés.
                </p>
              )}
            </>
          ) : (
            <div className="comparison-placeholder">
              <Camera size={26} />
              <p>Un état du réseau, conservé fidèlement.</p>
              <small>Les absences ne prouvent pas une déconnexion.</small>
            </div>
          )}
        </section>
        {snapshot && (
          <>
            <div className="snapshot-caption">
              <Camera size={14} />
              Instantané du {dateTime(snapshot.scan.finishedAt!)} · lecture seule
            </div>
            <DeviceList devices={snapshot.devices} onSelect={onSelect} />
          </>
        )}
      </div>
    </div>
  );
}
