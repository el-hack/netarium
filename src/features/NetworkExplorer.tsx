import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Layers, Maximize2, Minus, Plus, ArrowUpRight, Info } from 'lucide-react';
import { SearchField } from '../ui/SearchField';
import { normalizeSearch } from '../search';
import {
  categories,
  type Device,
  type NetworkInterface,
  type Scan,
  type Snapshot,
} from '../../shared/types';
import { allocatePositions, defaultPosition, type Position } from '../../shared/layout';
import { effectiveCategory } from '../../shared/identification';
import { api, categoryLabels, dateTime, deviceName, deviceTypeLabel } from '../lib';
import { DeviceIcon } from '../components/Icons';
import type { SceneHandle } from '../components/scene';
import { useResource } from './useWorkspace';
const demoPositions: Record<string, Position> = {};
export function NetworkExplorer({
  devices,
  network,
  scans,
  demo,
  onSelect,
  onActivity,
  onHistory,
}: {
  devices: Device[];
  network?: NetworkInterface;
  scans: Scan[];
  demo: boolean;
  onSelect: (d: Device, historical?: boolean) => void;
  onActivity: (id: string) => void;
  onHistory: () => void;
}) {
  const [mode, setMode] = useState<'3d' | '2d'>('3d');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [snapshotId, setSnapshotId] = useState('');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [status, setStatus] = useState('');
  const layout = useResource<Record<string, Position>>('/layout', demo ? demoPositions : undefined);
  const [overrides, setOverrides] = useState<Record<string, Position>>({});
  useEffect(() => {
    if (!snapshotId) {
      setSnapshot(null);
      return;
    }
    if (demo) {
      setSnapshot({ scan: scans[0], devices });
      return;
    }
    const controller = new AbortController();
    setSnapshot(null);
    setError('');
    void api<Snapshot>(`/snapshots/${encodeURIComponent(snapshotId)}`, {
      signal: controller.signal,
    })
      .then(setSnapshot)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [snapshotId, demo, scans, devices]);
  const actual = snapshotId ? (snapshot?.devices ?? []) : devices;
  const filtered = actual.filter(
    (d) =>
      (category === 'all' || effectiveCategory(d) === category) &&
      normalizeSearch(`${deviceName(d)} ${d.ip}`).includes(normalizeSearch(query)),
  );
  const signature = JSON.stringify(filtered);
  const stable = useMemo<Device[]>(() => JSON.parse(signature), [signature]);
  const positionsSignature = JSON.stringify(
    allocatePositions(
      actual.map((d) => d.id),
      { ...layout.data, ...overrides },
    ),
  );
  const positions = useMemo<Record<string, Position>>(
    () => JSON.parse(positionsSignature),
    [positionsSignature],
  );
  const current = actual.find((d) => d.id === selected);
  async function move(id: string, p: Position) {
    setOverrides((v) => ({ ...v, [id]: p }));
    if (demo) {
      setStatus('Position ajustée dans la démo.');
      return;
    }
    try {
      await api(`/layout/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(p) });
      setStatus('Position enregistrée.');
    } catch (e) {
      setError((e as Error).message);
      setOverrides((v) => {
        const n = { ...v };
        delete n[id];
        return n;
      });
    }
  }
  return (
    <>
      <div className="filter-bar">
        <SearchField
          label="Rechercher sur la carte"
          value={query}
          placeholder="Nom ou adresse IP…"
          onChange={setQuery}
        />
        <label>
          Catégorie
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">Tous les équipements</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabels[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Observation
          <select value={snapshotId} onChange={(e) => setSnapshotId(e.target.value)}>
            <option value="">Inventaire actuel</option>
            {scans
              .filter((s) => s.status === 'complete')
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {dateTime(s.finishedAt!)}
                </option>
              ))}
          </select>
        </label>
        <button className="button secondary" onClick={onHistory}>
          Comparer deux états
        </button>
      </div>
      {(error || layout.error) && (
        <p className="form-error" role="alert">
          {error || layout.error}
        </p>
      )}
      <div className="explorer-layout">
        <section className="panel explorer-map" aria-label="Carte du réseau">
          <header className="map-top">
            <div>
              <span className="eyebrow">
                {snapshotId ? 'INSTANTANÉ HISTORIQUE' : 'NETWORK EXPLORER'}
              </span>
              <h2>{network?.scanCidr ?? 'Réseau local'}</h2>
            </div>
            <div className="segmented">
              <button
                aria-pressed={mode === '3d'}
                className={mode === '3d' ? 'selected' : ''}
                onClick={() => setMode('3d')}
              >
                <Box size={15} />
                3D
              </button>
              <button
                aria-pressed={mode === '2d'}
                className={mode === '2d' ? 'selected' : ''}
                onClick={() => setMode('2d')}
              >
                <Layers size={15} />
                2D
              </button>
            </div>
          </header>
          {mode === '3d' ? (
            <ThreeMap
              devices={stable}
              positions={positions}
              onSelect={(d) => setSelected(d.id)}
              onFallback={() => setMode('2d')}
            />
          ) : (
            <FlatMap
              devices={stable}
              positions={positions}
              selected={selected}
              onSelect={setSelected}
              onMove={move}
              readOnly={Boolean(snapshotId)}
            />
          )}
          <div className="map-bottom">
            <span>
              <Info size={14} />
              Liens = appartenance au même périmètre observé. Ni câblage ni flux mesuré.
            </span>
            <span>
              {filtered.length} appareils{filtered.length > 100 ? ' · 100 sur la carte' : ''}
            </span>
          </div>
        </section>
        <aside className="explorer-inspector">
          <span className="eyebrow">SELECTION INSPECTOR</span>
          {current ? (
            <>
              <span className="device-icon large">
                <DeviceIcon device={current} size={30} />
              </span>
              <h2>{deviceName(current)}</h2>
              <p>{deviceTypeLabel(current)}</p>
              <dl className="properties">
                <div>
                  <dt>Adresse</dt>
                  <dd>
                    <code>{current.ip}</code>
                  </dd>
                </div>
                <div>
                  <dt>Dernière observation</dt>
                  <dd>{dateTime(current.lastSeen)}</dd>
                </div>
                <div>
                  <dt>Relation affichée</dt>
                  <dd>Appartenance à {current.network}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{current.source}</dd>
                </div>
              </dl>
              <button className="button primary" onClick={() => onActivity(current.id)}>
                Activity Explorer <ArrowUpRight size={15} />
              </button>
              <button
                className="button secondary"
                onClick={() => onSelect(current, Boolean(snapshotId))}
              >
                Ouvrir la fiche
              </button>
              {mode === '2d' && !snapshotId && (
                <p className="hint">
                  Déplacez le nœud à la souris ou avec les flèches du clavier. Sa position sera
                  conservée.
                </p>
              )}
            </>
          ) : (
            <>
              <h2>Explorez un appareil.</h2>
              <p>
                Sélectionnez un nœud ou un nom pour afficher son identité et ouvrir ses
                observations.
              </p>
            </>
          )}
          <div className="map-device-list">
            {filtered.slice(0, 100).map((d) => (
              <button
                key={d.id}
                className={d.id === selected ? 'active' : ''}
                onClick={() => setSelected(d.id)}
              >
                <DeviceIcon device={d} size={16} />
                <span>
                  {deviceName(d)}
                  <small>{d.ip}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>
      </div>
      <p role="status" className="hint">
        {status}
      </p>
    </>
  );
}
function ThreeMap({
  devices,
  positions,
  onSelect,
  onFallback,
}: {
  devices: Device[];
  positions: Record<string, Position>;
  onSelect: (d: Device) => void;
  onFallback: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneHandle | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void import('../components/scene')
      .then(({ createScene }) => {
        if (cancelled || !ref.current) return;
        try {
          scene.current = createScene(
            ref.current,
            devices,
            (d) => select.current(d),
            false,
            positions,
          );
        } catch {
          setError(true);
        }
      })
      .catch(() => setError(true));
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [devices, positions]);
  return (
    <div className="map-stage">
      <div className="map-surface" ref={ref} />
      {error && (
        <div className="map-welcome">
          <h3>Le rendu 3D n’est pas disponible.</h3>
          <p>La vue 2D fonctionne sans accélération graphique.</p>
          <button className="button primary" onClick={onFallback}>
            Ouvrir la vue 2D
          </button>
        </div>
      )}
      <div className="map-controls">
        <button
          disabled={error}
          className="icon-button"
          aria-label="Zoom avant"
          onClick={() => scene.current?.zoom(1)}
        >
          <Plus size={18} />
        </button>
        <button
          disabled={error}
          className="icon-button"
          aria-label="Zoom arrière"
          onClick={() => scene.current?.zoom(-1)}
        >
          <Minus size={18} />
        </button>
        <button
          disabled={error}
          className="icon-button"
          aria-label="Recentrer la carte"
          onClick={() => scene.current?.reset()}
        >
          <Maximize2 size={18} />
        </button>
      </div>
      <span className="map-gesture">
        Rotation : glisser · Déplacement : clic droit · Zoom : molette
      </span>
    </div>
  );
}
function FlatMap({
  devices,
  positions,
  selected,
  onSelect,
  onMove,
  readOnly,
}: {
  devices: Device[];
  positions: Record<string, Position>;
  selected: string;
  onSelect: (id: string) => void;
  onMove: (id: string, p: Position) => Promise<void>;
  readOnly: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; p: Position } | null>(null);
  const [zoom, setZoom] = useState(1);
  const clamp = (n: number) => Math.max(-20, Math.min(20, n));
  const extent = Math.max(
    9,
    ...devices.map((d) => Math.abs((positions[d.id] ?? defaultPosition(d.id)).y)),
  );
  const unit = Math.min(22, 190 / extent);
  const center = (e: React.PointerEvent) => {
    const svg = ref.current!;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: clamp((p.x - 500) / (unit * zoom)), y: clamp((p.y - 260) / (unit * zoom)) };
  };
  return (
    <div className="map-stage flat-map">
      <svg ref={ref} viewBox="0 0 1000 520" aria-label="Carte 2D du réseau">
        <g transform={`translate(500 260) scale(${zoom})`}>
          {[100, 170, 240].map((r) => (
            <circle key={r} r={r} className="map-ring" />
          ))}
          {devices.slice(0, 100).map((d) => {
            const p = drag?.id === d.id ? drag.p : (positions[d.id] ?? defaultPosition(d.id));
            return (
              <line
                key={`link-${d.id}`}
                x1="0"
                y1="0"
                x2={p.x * unit}
                y2={p.y * unit}
                className="map-link"
              >
                <title>
                  Appartenance de {deviceName(d)} au périmètre {d.network}. Aucun flux de trafic
                  mesuré.
                </title>
              </line>
            );
          })}
          <circle r="28" className="map-core" />
          <text className="map-core-text" textAnchor="middle" y="5">
            LAN
          </text>
          {devices.slice(0, 100).map((d) => {
            const p = drag?.id === d.id ? drag.p : (positions[d.id] ?? defaultPosition(d.id));
            return (
              <g
                key={d.id}
                role="button"
                tabIndex={0}
                aria-label={`Sélectionner ${deviceName(d)}`}
                aria-pressed={selected === d.id}
                className={`flat-node ${selected === d.id ? 'selected' : ''} ${d.status}`}
                transform={`translate(${p.x * unit} ${p.y * unit})`}
                onClick={() => onSelect(d.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(d.id);
                  }
                  if (
                    !readOnly &&
                    ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
                  ) {
                    e.preventDefault();
                    void onMove(d.id, {
                      x: clamp(
                        p.x + (e.key === 'ArrowRight' ? 0.5 : e.key === 'ArrowLeft' ? -0.5 : 0),
                      ),
                      y: clamp(
                        p.y + (e.key === 'ArrowDown' ? 0.5 : e.key === 'ArrowUp' ? -0.5 : 0),
                      ),
                    });
                  }
                }}
                onPointerDown={(e) => {
                  onSelect(d.id);
                  if (!readOnly) {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setDrag({ id: d.id, p });
                  }
                }}
                onPointerMove={(e) => {
                  if (drag?.id === d.id) setDrag({ id: d.id, p: center(e) });
                }}
                onPointerUp={(e) => {
                  if (drag?.id === d.id) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                    void onMove(d.id, drag.p);
                    setDrag(null);
                  }
                }}
                onPointerCancel={() => setDrag(null)}
              >
                <circle r="21" />
                <text textAnchor="middle" y="5" className="node-glyph">
                  {categoryLabels[effectiveCategory(d)].slice(0, 1)}
                </text>
                <text textAnchor="middle" y="43">
                  {deviceName(d).slice(0, 24)}
                </text>
                <text textAnchor="middle" y="59" className="node-ip">
                  {d.ip}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="map-controls">
        <button
          className="icon-button"
          aria-label="Zoom avant"
          onClick={() => setZoom((v) => Math.min(2, v + 0.2))}
        >
          <Plus size={18} />
        </button>
        <button
          className="icon-button"
          aria-label="Zoom arrière"
          onClick={() => setZoom((v) => Math.max(0.4, v - 0.2))}
        >
          <Minus size={18} />
        </button>
        <button className="icon-button" aria-label="Recentrer la carte" onClick={() => setZoom(1)}>
          <Maximize2 size={18} />
        </button>
      </div>
      <span className="map-gesture">
        Sélectionnez · Déplacez les nœuds · Positions enregistrées
      </span>
    </div>
  );
}
