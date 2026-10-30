import { ArrowUpRight, ArrowDownUp, Search, Monitor, List, LayoutGrid } from 'lucide-react';
import { useState } from 'react';
import type { Device } from '../../shared/types';
import { deviceTypeLabel, deviceName, sourceLabels, statusLabel, dateTime } from '../lib';
import { selectDevices, type DeviceFilter, type DeviceSort } from '../device-view';
import { DeviceIcon } from './Icons';
import { SearchField } from '../ui/SearchField';
import { Button } from '../ui/Button';
const filters: { id: DeviceFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'observed', label: 'Observés' },
  { id: 'cached', label: 'Dans le cache' },
  { id: 'unseen', label: 'Non revus' },
];
function subtitle(device: Device) {
  const type = deviceTypeLabel(device);
  return device.role === 'gateway' ? `${type} · passerelle` : type;
}
export function DeviceList({
  devices,
  onSelect,
  compact = false,
  onActivity,
}: {
  devices: Device[];
  onSelect: (device: Device) => void;
  compact?: boolean;
  onActivity?: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DeviceFilter>('all');
  const [sort, setSort] = useState<DeviceSort>('name');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [page, setPage] = useState(0);
  const filtered = selectDevices(devices, { query, status: filter, sort });
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 50) - 1));
  const visible = filtered.slice(currentPage * 50, currentPage * 50 + 50);
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
          <SearchField
            label="Rechercher un appareil"
            placeholder="Rechercher un appareil…"
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(0);
            }}
          />
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
              onClick={() => {
                setFilter(item.id);
                setPage(0);
              }}
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
            onChange={(event) => {
              setSort(event.target.value as DeviceSort);
              setPage(0);
            }}
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
                {visible.map((device) => (
                  <tr key={device.id}>
                    <td>
                      <button className="device-link" onClick={() => onSelect(device)}>
                        <span className={`device-icon ${device.role === 'self' ? 'sage' : ''}`}>
                          <DeviceIcon device={device} size={21} />
                        </span>
                        <span>
                          <strong>{deviceName(device)}</strong>
                          <small>{subtitle(device)}</small>
                          {Boolean(device.tags?.length) && (
                            <small>{device.tags!.join(' · ')}</small>
                          )}
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
                      {onActivity && (
                        <button
                          className="text-button"
                          onClick={() => onActivity(device.id)}
                          aria-label={`Activité de ${deviceName(device)}`}
                        >
                          Activité
                        </button>
                      )}
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
            {visible.map((device) => (
              <article className="device-card" key={device.id}>
                <button
                  className="device-card-open"
                  type="button"
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
                </button>
                {Boolean(device.tags?.length) && (
                  <div className="device-tags">
                    {device.tags!.map((tag) => (
                      <span key={tag} className="soft-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <span className="device-card-bottom">
                  <span className="mono">{device.ip}</span>
                  <span className={`status ${device.status}`}>
                    <i />
                    {statusLabel(device)}
                  </span>
                </span>
                <small>Dernier relevé · {dateTime(device.lastSeen)}</small>
                {onActivity && (
                  <Button
                    onClick={() => onActivity(device.id)}
                    aria-label={`Activité de ${deviceName(device)}`}
                  >
                    Explorer l’activité <ArrowUpRight size={14} />
                  </Button>
                )}
              </article>
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
      {filtered.length > 50 && (
        <div className="pagination">
          <button
            className="button secondary"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Précédent
          </button>
          <span>
            {currentPage + 1} / {Math.ceil(filtered.length / 50)}
          </span>
          <button
            className="button secondary"
            disabled={(currentPage + 1) * 50 >= filtered.length}
            onClick={() => setPage(currentPage + 1)}
          >
            Suivant
          </button>
        </div>
      )}
    </section>
  );
}
