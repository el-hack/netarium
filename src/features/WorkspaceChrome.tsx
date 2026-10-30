import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Orbit,
  Search,
  Sun,
  Moon,
  Menu,
  X,
  ArrowUpRight,
  FlaskConical,
  Radio,
  House,
  LockKeyhole,
} from 'lucide-react';
import { navigation, type Page } from '../navigation';
import type { Device } from '../../shared/types';
import { CommandPalette } from './CommandPalette';
export function WorkspaceChrome({
  page,
  devices,
  demo,
  onNavigate,
  onDevice,
  onDemo,
  children,
}: {
  page: Page;
  devices: Device[];
  demo: boolean;
  onNavigate: (p: Page) => void;
  onDevice: (id: string) => void;
  onDemo: () => void;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('netarium.theme') === 'dark' ? 'dark' : 'light',
  );
  const [menu, setMenu] = useState(false);
  const [command, setCommand] = useState(false);
  const commandOpener = useRef<HTMLElement | null>(null);
  const commandTrigger = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const [mobile, setMobile] = useState(() => matchMedia('(max-width:760px)').matches);
  useEffect(() => {
    const media = matchMedia('(max-width:760px)');
    const update = () => {
      setMobile(media.matches);
      if (!media.matches) setMenu(false);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!mobile || !menu) return;
    const previous = document.activeElement as HTMLElement | null;
    const buttons = () =>
      Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>('button,a,[tabindex="0"]') ?? [],
      ).filter((e) => e.getClientRects().length > 0);
    buttons()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = buttons();
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault();
        items[0]?.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, [mobile, menu]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('netarium.theme', theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#121212' : '#fafafa');
  }, [theme]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setMenu(false);
        if (!command)
          commandOpener.current = menu
            ? commandTrigger.current
            : (document.activeElement as HTMLElement);
        setCommand(!command);
      }
      if (e.key === 'Escape') setMenu(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [command, menu]);
  const go = (p: Page) => {
    onNavigate(p);
    setMenu(false);
    setCommand(false);
  };
  return (
    <div className="workspace">
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Aller au contenu
      </a>
      {menu && (
        <button
          className="nav-backdrop"
          aria-label="Fermer la navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        className={`workspace-sidebar ${menu ? 'is-open' : ''}`}
        ref={sidebar}
        inert={mobile && !menu}
        aria-hidden={mobile && !menu ? true : undefined}
        role={mobile && menu ? 'dialog' : undefined}
        aria-modal={mobile && menu ? true : undefined}
        aria-label="Navigation principale"
      >
        <div className="brand">
          <span className="brand-mark">
            <Orbit size={24} strokeWidth={1.5} />
          </span>
          <span>Netarium</span>
          <button
            className="icon-button mobile-only"
            aria-label="Fermer la navigation"
            onClick={() => setMenu(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-avatar">
            <House size={17} strokeWidth={1.5} />
          </span>
          <div>
            <strong>Espace personnel</strong>
            <small>Observatoire local</small>
          </div>
          <LockKeyhole size={14} aria-label="Espace privé" />
        </div>
        <nav>
          {navigation.map((item, index) => (
            <div key={item.id}>
              {[0, 3, 7].includes(index) && (
                <span className="nav-group">
                  {index === 0 ? 'Explorer' : index === 3 ? 'Observer' : 'Configurer'}
                </span>
              )}
              <button
                aria-current={page === item.id ? 'page' : undefined}
                className={page === item.id ? 'active' : ''}
                onClick={() => go(item.id)}
              >
                <item.icon size={18} strokeWidth={1.5} />
                <span>{item.label}</span>
                {item.id === 'devices' && <small>{devices.length}</small>}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            onClick={() => {
              onDemo();
              setMenu(false);
            }}
          >
            <FlaskConical size={17} />
            {demo ? 'Quitter la démo' : 'Explorer la démo'}
            <ArrowUpRight size={14} />
          </button>
          <div>
            <Radio size={14} />
            <span>{demo ? 'Données simulées' : 'Hébergé sur cet ordinateur'}</span>
            <i />
          </div>
          <small>Netarium · Open source</small>
        </div>
      </aside>
      <div className="workspace-content" inert={mobile && menu}>
        <header className="workspace-topbar">
          <div>
            <button
              className="icon-button mobile-only"
              aria-expanded={menu}
              aria-label="Ouvrir la navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb">
              <House size={15} strokeWidth={1.5} aria-hidden="true" />
              <span className="breadcrumb-workspace">Espace local</span>
              <span>/</span> <strong>{navigation.find((n) => n.id === page)?.label}</strong>
            </span>
          </div>
          <div>
            <button
              className="command-trigger"
              ref={commandTrigger}
              onClick={(event) => {
                commandOpener.current = event.currentTarget;
                setCommand(true);
              }}
              aria-label="Recherche globale"
            >
              <Search size={16} />
              <span>Rechercher…</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="icon-button"
              aria-label={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <FlaskConical size={16} />
            <strong>MODE DÉMO</strong>
            <span>Données simulées · aucune collecte ni écriture sur votre réseau</span>
            <button
              onClick={() => {
                onDemo();
                setMenu(false);
              }}
            >
              Revenir au réseau réel
            </button>
          </div>
        )}
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer className="workspace-footer">
          <span>
            <i />
            Stockage local · Espace privé
          </span>
          <span>{demo ? 'Simulation isolée' : 'Observations sourcées. Aucune télémétrie.'}</span>
        </footer>
      </div>
      {command && (
        <CommandPalette
          returnFocus={commandOpener.current}
          devices={devices}
          onClose={() => setCommand(false)}
          onNavigate={go}
          onDevice={(id) => {
            onDevice(id);
            setCommand(false);
          }}
        />
      )}
    </div>
  );
}
