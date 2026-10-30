import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Search, ArrowUpRight, X } from 'lucide-react';
import type { Device } from '../../shared/types';
import { navigation, type Page } from '../navigation';
import { deviceName } from '../lib';
import { normalizeSearch } from '../search';
import { DeviceIcon } from '../components/Icons';
import { Empty } from '../ui/primitives';
import { IconButton } from '../ui/Button';

export function CommandPalette({
  devices,
  onClose,
  onNavigate,
  onDevice,
  returnFocus,
}: {
  devices: Device[];
  onClose: () => void;
  onNavigate: (page: Page) => void;
  onDevice: (id: string) => void;
  returnFocus: HTMLElement | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [returnFocus]);
  const match = (value: string) => normalizeSearch(value).includes(normalizeSearch(query));
  const pages = navigation.filter((page) => match(`${page.label} ${page.description}`));
  const matchedDevices = devices.filter((device) =>
    match(`${deviceName(device)} ${device.ip} ${(device.tags ?? []).join(' ')}`),
  );
  const visibleDevices = matchedDevices.slice(0, 30);
  const count = pages.length + matchedDevices.length;

  // Buttons keep native Tab/Enter behavior. Arrows offer an additional shortcut
  // without pretending these navigation actions are listbox selection options.
  function move(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const buttons = Array.from(
      results.current?.querySelectorAll<HTMLButtonElement>('button') ?? [],
    );
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const inInput = document.activeElement === input.current;
    if (!buttons.length || (!inInput && current < 0)) return;
    let next: number;
    if (event.key === 'ArrowDown') next = (current + 1) % buttons.length;
    else if (event.key === 'ArrowUp') next = current <= 0 ? buttons.length - 1 : current - 1;
    else if (!inInput && event.key === 'Home') next = 0;
    else if (!inInput && event.key === 'End') next = buttons.length - 1;
    else if (inInput && event.key === 'Enter' && !event.nativeEvent.isComposing) next = 0;
    else return;
    event.preventDefault();
    if (inInput && event.key === 'Enter') buttons[next].click();
    else buttons[next].focus();
  }

  return (
    <dialog
      ref={dialog}
      className="command-dialog"
      aria-label="Recherche et commandes"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={move}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="command-input">
        <Search size={19} aria-hidden="true" />
        <input
          ref={input}
          autoFocus
          aria-label="Rechercher dans Netarium"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Appareil, adresse IP, vue…"
        />
        <IconButton label="Fermer la recherche" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      <div className="command-results" ref={results}>
        {pages.length > 0 && (
          <>
            <span className="eyebrow">NAVIGATION</span>
            {pages.map((page) => (
              <button type="button" key={page.id} onClick={() => onNavigate(page.id)}>
                <page.icon size={18} aria-hidden="true" />
                <span>
                  {page.label}
                  <small>{page.description}</small>
                </span>
                <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            ))}
          </>
        )}
        {visibleDevices.length > 0 && (
          <>
            <span className="eyebrow">APPAREILS · ACTIVITY EXPLORER</span>
            {visibleDevices.map((device) => (
              <button type="button" key={device.id} onClick={() => onDevice(device.id)}>
                <DeviceIcon device={device} />
                <span>
                  {deviceName(device)}
                  <small>{device.ip}</small>
                </span>
                <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            ))}
            {matchedDevices.length > 30 && (
              <p className="table-note">
                30 appareils affichés. Précisez votre recherche pour retrouver les autres.
              </p>
            )}
          </>
        )}
        {count === 0 && (
          <Empty title="Aucun résultat">
            Essayez un nom d’appareil, une adresse IP ou le nom d’une vue.
          </Empty>
        )}
      </div>
      <div className="command-help">
        <span role="status">
          {count} résultat{count > 1 ? 's' : ''}
        </span>
        <span>↑ ↓ parcourir · Entrée ouvrir · Échap fermer</span>
      </div>
    </dialog>
  );
}
