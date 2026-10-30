import { ArrowUpRight, Search, SlidersHorizontal, Monitor } from 'lucide-react';
import { useState } from 'react';
import type { Device } from '../../shared/types';
import { categoryLabels, deviceName, sourceLabels, statusLabel, timeOnly } from '../lib';
import { DeviceIcon } from './Icons';
export function DeviceList({
  devices,
  onSelect,
  compact = false,
}: {
  devices: Device[];
  onSelect: (device: Device) => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const filtered = devices.filter(
    (device) =>
      `${deviceName(device)} ${device.ip} ${device.mac ?? ''} ${categoryLabels[device.category]}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === 'all' || device.status === filter),
  );
  return (
    <section className={`panel device-panel ${compact ? 'compact' : ''}`}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">INVENTAIRE LOCAL</span>
          <h2>
            Les appareils <span className="count-pill">{devices.length}</span>
          </h2>
        </div>
        <div className="list-tools">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Rechercher un appareil"
              placeholder="Nom, adresse IP…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="filter-field">
            <SlidersHorizontal size={15} />
            <select
              aria-label="Filtrer les appareils"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">Tous les états</option>
              <option value="observed">Observés</option>
              <option value="cached">Dans le cache</option>
              <option value="unseen">Non revus</option>
            </select>
          </label>
        </div>
      </div>
      {filtered.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Appareil</th>
                <th>Adresse IP</th>
                <th>Observation</th>
                <th>Dernière présence</th>
                <th>
                  <span className="sr-only">Détails</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((device) => (
                <tr key={device.id}>
                  <td>
                    <button className="device-link" onClick={() => onSelect(device)}>
                      <span className={`device-icon ${device.role === 'self' ? 'sage' : ''}`}>
                        <DeviceIcon device={device} />
                      </span>
                      <span>
                        <strong>{deviceName(device)}</strong>
                        <small>
                          {device.role === 'self'
                            ? 'Cet ordinateur'
                            : device.role === 'gateway' && device.category === 'unknown'
                              ? 'Passerelle'
                              : categoryLabels[device.category]}
                        </small>
                      </span>
                    </button>
                  </td>
                  <td className="mono">{device.ip}</td>
                  <td>
                    <span className={`status ${device.status}`}>
                      <i />
                      {statusLabel(device)}
                    </span>
                    <small className="cell-subtitle">{sourceLabels[device.source]}</small>
                  </td>
                  <td className="muted">{timeOnly(device.lastSeen)}</td>
                  <td>
                    <button
                      className="icon-button"
                      onClick={() => onSelect(device)}
                      aria-label={`Détails de ${deviceName(device)}`}
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state small">
          <Monitor size={28} />
          <h3>{query || filter !== 'all' ? 'Aucun résultat' : 'Votre inventaire commence ici'}</h3>
          <p>
            {query || filter !== 'all'
              ? 'Essayez un autre nom ou un autre filtre.'
              : 'Lancez une découverte pour rencontrer vos appareils.'}
          </p>
        </div>
      )}
    </section>
  );
}
