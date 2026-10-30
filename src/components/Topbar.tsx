import { Menu } from 'lucide-react';
import { navigation, type Page } from '../navigation';
export function Topbar({
  page,
  menuOpen,
  onMenu,
}: {
  page: Page;
  menuOpen: boolean;
  onMenu: () => void;
}) {
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <button
          className="icon-button mobile-menu"
          aria-label="Ouvrir la navigation"
          aria-expanded={menuOpen}
          aria-controls="primary-sidebar"
          onClick={onMenu}
        >
          <Menu size={20} />
        </button>
        <span>Espace personnel</span>
        <span>/</span>
        <strong>{navigation.find((item) => item.id === page)?.label}</strong>
      </div>
      <div className="topbar-right">
        <span className="local-indicator">
          <i />
          Session locale
        </span>
        <span className="topbar-separator" />
        <span className="avatar" title="Espace local">
          N
        </span>
      </div>
    </header>
  );
}
