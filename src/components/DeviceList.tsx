import { ArrowUpRight, ArrowDownUp, Search, Monitor, X, List, LayoutGrid } from 'lucide-react';
import { useState } from 'react';
import type { Device } from '../../shared/types';
import { categoryLabels, deviceName, sourceLabels, statusLabel, dateTime } from '../lib';
import { selectDevices, type DeviceFilter, type DeviceSort } from '../device-view';
import { DeviceIcon } from './Icons';
const filters: { id: DeviceFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'observed', label: 'Observés' },
  { id: 'cached', label: 'Dans le cache' },
  { id: 'unseen', label: 'Non revus' },
];
function subtitle(device: Device) {
  return device.role === 'self'
    ? 'Cet ordinateur'
    : device.role === 'gateway' && device.category === 'unknown'
      ? 'Passerelle'
      : categoryLabels[device.category];
}
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
  const [filter, setFilter] = useState<DeviceFilter>('all');
  const [sort, setSort] = useState<DeviceSort>('name');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const filtered = selectDevices(devices, { query, status: filter, sort });
  return (
    <section
      className={`panel device-panel ${compact ? 'compact' : ''} ${view === 'grid' ? 'grid-view' : ''}`}
      aria-label="Inventaire des appareils"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">À PORTÉE DE CLIC</span>
          <h2>
            Vos appareils <span className="count-pill">{devices.length}</span>
          </h2>
        </div>
        <div className="list-tools">
          <label className="search-field">
            <Search size={18} />
            <input
              type="search"
              aria-label="Rechercher un appareil"
              placeholder="Rechercher un appareil…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button
                className="clear-search"
                onClick={() => setQuery('')}
                aria-label="Effacer la recherche"
              >
                <X size={15} />
              </button>
            )}
          </label>
          <div className="segmented view-switch" aria-label="Présentation de l’inventaire">
            <button
              className={view === 'list' ? 'selected' : ''}
              aria-pressed={view === 'list'}
              aria-label="Vue liste"
              onClick={() => setView('list')}
            >
              <List size={17} />
            </button>
            <button
              className={view === 'grid' ? 'selected' : ''}
              aria-pressed={view === 'grid'}
              aria-label="Vue cartes"
              onClick={() => setView('grid')}
            >
              <LayoutGrid size={17} />
            </button>
          </div>
        </div>
      </div>
      <div className="inventory-toolbar">
        <div className="filter-tabs" aria-label="Filtrer les appareils">
          {filters.map((item) => (
            <button
              key={item.id}
              aria-pressed={filter === item.id}
              className={filter === item.id ? 'active' : ''}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
              <span>
                {item.id === 'all'
                  ? devices.length
                  : devices.filter((device) => device.status === item.id).length}
              </span>
            </button>
          ))}
        </div>
        <label className="sort-field">
          <ArrowDownUp size={14} />
          <select
            aria-label="Trier les appareils"
            value={sort}
            onChange={(event) => setSort(event.target.value as DeviceSort)}
          >
            <option value="name">Par nom</option>
            <option value="ip">Par adresse IP</option>
            <option value="recent">Plus récents</option>
          </select>
        </label>
      </div>
      {filtered.length ? (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Appareil</th>
                  <th>Adresse IP</th>
                  <th>Observation</th>
                  <th>Dernier relevé</th>
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
                          <DeviceIcon device={device} size={21} />
                        </span>
                        <span>
                          <strong>{deviceName(device)}</strong>
                          <small>{subtitle(device)}</small>
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
                    <td className="muted last-seen-cell">{dateTime(device.lastSeen)}</td>
                    <td>
                      <button
                        className="icon-button"
                        onClick={() => onSelect(device)}
                        aria-label={`Détails de ${deviceName(device)}`}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="device-cards">
            {filtered.map((device) => (
              <button
                className="device-card"
                key={device.id}
                onClick={() => onSelect(device)}
                aria-label={`Fiche de ${deviceName(device)}`}
              >
                <span className="device-card-top">
                  <span className={`device-icon ${device.role === 'self' ? 'sage' : ''}`}>
                    <DeviceIcon device={device} size={24} />
                  </span>
                  <ArrowUpRight size={17} />
                </span>
                <strong>{deviceName(device)}</strong>
                <span className="device-card-type">{subtitle(device)}</span>
                <span className="device-card-bottom">
                  <span className="mono">{device.ip}</span>
                  <span className={`status ${device.status}`}>
                    <i />
                    {statusLabel(device)}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="inventory-footer">
            <span>
              {filtered.length} appareil{filtered.length > 1 ? 's' : ''}
              {filtered.length !== devices.length ? ` sur ${devices.length}` : ''}
            </span>
            <span>Chaque observation garde sa source.</span>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">
            {query || filter !== 'all' ? <Search size={28} /> : <Monitor size={28} />}
          </span>
          <h3>
            {query || filter !== 'all'
              ? 'Aucun appareil ne correspond'
              : 'Votre inventaire commence ici'}
          </h3>
          <p>
            {query || filter !== 'all'
              ? 'Essayez un autre nom, une adresse IP ou un état différent.'
              : 'Lancez une découverte pour retrouver les appareils de votre réseau.'}
          </p>
          {(query || filter !== 'all') && (
            <button
              className="button secondary"
              onClick={() => {
                setQuery('');
                setFilter('all');
              }}
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}
    </section>
  );
}
