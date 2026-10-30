import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minus, Plus, Box, Layers, Orbit, Move, Info, Network } from 'lucide-react';
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
          <span className="eyebrow">EXPLORER LES CONNEXIONS</span>
          <h2>Votre constellation</h2>
        </div>
        <div className="segmented" aria-label="Perspective de la carte">
          <button
            className={!flat ? 'selected' : ''}
            onClick={() => setFlat(false)}
            aria-pressed={!flat}
          >
            <Box size={15} />
            3D
          </button>
          <button
            className={flat ? 'selected' : ''}
            onClick={() => setFlat(true)}
            aria-pressed={flat}
          >
            <Layers size={15} />
            2D
          </button>
        </div>
      </div>
      <div className="map-stage">
        <div className="map-surface" ref={container} />
        <span className="map-scope">
          <Network size={13} />
          {network?.scanCidr ?? 'Réseau local'}
        </span>
        <div className="map-legend">
          <span>
            <i />
            Observé
          </span>
          <span>
            <i className="cached" />
            Cache
          </span>
          <span>
            <i className="unseen" />
            Non revu
          </span>
        </div>
        {!devices.length && !error && (
          <div className="map-welcome">
            <span className="welcome-icon">
              <Orbit size={27} />
            </span>
            <h3>Votre réseau n’attend que vous.</h3>
            <p>
              Lancez une découverte.
              <br />
              Vos appareils prendront place ici.
            </p>
          </div>
        )}
        {error && (
          <div className="map-welcome">
            <Info size={27} />
            <h3>La vue graphique est indisponible.</h3>
            <p>
              WebGL 2 est nécessaire pour afficher la carte.
              <br />
              Vous pouvez consulter tous vos appareils dans l’inventaire.
            </p>
          </div>
        )}
        <div className="map-controls">
          <button
            className="icon-button"
            disabled={error}
            aria-label="Zoom avant"
            onClick={() => scene.current?.zoom(1)}
          >
            <Plus size={18} />
          </button>
          <button
            className="icon-button"
            disabled={error}
            aria-label="Zoom arrière"
            onClick={() => scene.current?.zoom(-1)}
          >
            <Minus size={18} />
          </button>
          <span />
          <button
            className="icon-button"
            disabled={error}
            aria-label="Recentrer la carte"
            onClick={() => scene.current?.reset()}
          >
            <Maximize2 size={17} />
          </button>
        </div>
        <span className="map-gesture">
          <Move size={14} />
          Glissez pour explorer · Cliquez sur un appareil
        </span>
      </div>
      <div className="map-bottom">
        <span className="map-disclaimer">
          <Info size={14} />
          Vue logique du réseau. Les liens ne représentent pas le câblage physique.
        </span>
        <span>
          {devices.length} appareil{devices.length > 1 ? 's' : ''}
          {devices.length > 100 ? ' · 100 affichés' : ''}
        </span>
      </div>
    </section>
  );
}
