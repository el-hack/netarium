import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minus, Plus, Box, Layers, Orbit, Move, Info } from 'lucide-react';
import type { Device, NetworkInterface } from '../../shared/types';
import type { SceneHandle } from './scene';
export function NetworkMap({
  devices,
  network,
  onSelect,
  scanning,
}: {
  devices: Device[];
  network?: NetworkInterface;
  onSelect: (device: Device) => void;
  scanning: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneHandle | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const [flat, setFlat] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setError(false);
    void import('./scene')
      .then(({ createScene }) => {
        if (cancelled || !container.current) return;
        try {
          scene.current = createScene(
            container.current,
            devices,
            (device) => select.current(device),
            flat,
          );
        } catch {
          setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [devices, flat]);
  return (
    <section
      className={`panel map-panel ${scanning ? 'is-scanning' : ''}`}
      aria-label="Carte du réseau"
    >
      <div className="map-top">
        <div>
          <span className="eyebrow">VOTRE CONSTELLATION</span>
          <h2>
            Une autre vue du réseau <span className="soft-tag">{flat ? '2D' : '3D'}</span>
          </h2>
        </div>
        <div className="segmented">
          <button
            className={!flat ? 'selected' : ''}
            onClick={() => setFlat(false)}
            aria-pressed={!flat}
          >
            <Box size={14} />
            3D
          </button>
          <button
            className={flat ? 'selected' : ''}
            onClick={() => setFlat(true)}
            aria-pressed={flat}
          >
            <Layers size={14} />
            2D
          </button>
        </div>
      </div>
      <div className="map-surface" ref={container} />
      {!devices.length && !error && (
        <div className="map-welcome">
          <span className="welcome-icon">
            <Orbit size={24} />
          </span>
          <h3>Tout commence par une découverte.</h3>
          <p>
            Votre réseau prendra forme ici,
            <br />
            un appareil à la fois.
          </p>
        </div>
      )}
      {error && (
        <div className="map-welcome">
          <Info size={26} />
          <h3>La vue graphique n’est pas disponible.</h3>
          <p>
            Votre navigateur doit prendre en charge WebGL 2.
            <br />
            L’inventaire reste entièrement accessible.
          </p>
        </div>
      )}
      <div className="map-controls">
        <button
          className="icon-button"
          aria-label="Zoom avant"
          onClick={() => scene.current?.zoom(1)}
        >
          <Plus size={17} />
        </button>
        <button
          className="icon-button"
          aria-label="Zoom arrière"
          onClick={() => scene.current?.zoom(-1)}
        >
          <Minus size={17} />
        </button>
        <span />
        <button
          className="icon-button"
          aria-label="Recentrer la carte"
          onClick={() => scene.current?.reset()}
        >
          <Maximize2 size={16} />
        </button>
      </div>
      <div className="map-bottom">
        <span>
          <i className="tiny-dot" />
          {network?.scanCidr ?? 'Réseau local'}
          <span className="map-divider">/</span>
          {devices.length} appareil{devices.length > 1 ? 's' : ''}
        </span>
        <span>
          <Move size={13} />
          Glisser pour explorer
        </span>
      </div>
      <div className="map-disclaimer">
        <Info size={12} /> Les liens représentent l’appartenance au périmètre, pas le câblage
        physique.{devices.length > 100 ? ' Les 100 premiers appareils sont affichés.' : ''}
      </div>
    </section>
  );
}
