import { useEffect, useRef } from 'react';
import { Network, ShieldCheck, CircleHelp, ArrowUpRight, X } from 'lucide-react';
import { navigation, type Page } from '../navigation';
import { Brand } from './Icons';
export function Sidebar({
  page,
  menuOpen,
  deviceCount,
  help,
  onNavigate,
  onHelp,
  onClose,
}: {
  page: Page;
  menuOpen: boolean;
  deviceCount: number;
  help: boolean;
  onNavigate: (page: Page) => void;
  onHelp: () => void;
  onClose: () => void;
}) {
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const element = sidebar.current!;
    const focusable = () =>
      [...element.querySelectorAll<HTMLElement>('button, a[href]')].filter(
        (item) => item.offsetParent !== null,
      );
    focusable()[0]?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    const media = matchMedia('(min-width: 701px)');
    const resized = () => {
      if (media.matches) onClose();
    };
    document.addEventListener('keydown', keyboard);
    media.addEventListener('change', resized);
    return () => {
      document.removeEventListener('keydown', keyboard);
      media.removeEventListener('change', resized);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [menuOpen, onClose]);
  return (
    <aside
      ref={sidebar}
      id="primary-sidebar"
      className={`sidebar ${menuOpen ? 'open' : ''}`}
      role={menuOpen ? 'dialog' : undefined}
      aria-modal={menuOpen || undefined}
      aria-label={menuOpen ? 'Navigation' : undefined}
    >
      {menuOpen && (
        <button
          className="icon-button sidebar-close"
          onClick={onClose}
          aria-label="Fermer la navigation"
        >
          <X size={19} />
        </button>
      )}
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
