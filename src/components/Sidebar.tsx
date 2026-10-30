import { Network, ShieldCheck, CircleHelp, ArrowUpRight } from 'lucide-react';
import { navigation, type Page } from '../navigation';
import { Brand } from './Icons';
export function Sidebar({
  page,
  menuOpen,
  deviceCount,
  help,
  onNavigate,
  onHelp,
}: {
  page: Page;
  menuOpen: boolean;
  deviceCount: number;
  help: boolean;
  onNavigate: (page: Page) => void;
  onHelp: () => void;
}) {
  return (
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <a
        className="brand-link"
        href="#"
        onClick={(event) => {
          event.preventDefault();
          onNavigate('overview');
        }}
        aria-label="Accueil Netarium"
      >
        <Brand />
      </a>
      <div className="workspace-badge">
        <span className="workspace-symbol">
          <Network size={18} />
        </span>
        <div>
          <strong>Mon réseau domestique</strong>
          <small>Espace personnel</small>
        </div>
        <span className="workspace-dot" />
      </div>
      <span className="nav-caption">EXPLORER</span>
      <nav aria-label="Navigation principale">
        {navigation.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${page === item.id ? 'active' : ''}`}
            aria-label={item.label}
            aria-current={page === item.id ? 'page' : undefined}
            onClick={() => {
              onNavigate(item.id);
            }}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
            {item.id === 'devices' && Boolean(deviceCount) && (
              <span className="nav-count">{deviceCount}</span>
            )}
            {item.id === 'overview' && <span className="nav-active-dot" />}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="local-note">
          <ShieldCheck size={17} />
          <span>
            Un petit monde privé.<small>100 % sur votre ordinateur.</small>
          </span>
        </div>
        <button className="nav-item help-button" onClick={onHelp} aria-expanded={help}>
          <CircleHelp size={17} />
          Prendre ses repères
          <ArrowUpRight size={14} />
        </button>
        <div className="sidebar-footer">
          <span>NETARIUM</span>
          <span>
            v0.1.0 <i />
          </span>
        </div>
      </div>
    </aside>
  );
}
