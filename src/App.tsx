import { useCallback, useMemo, useState } from 'react';
import {
  Orbit,
  ArrowUpRight,
  ScanLine,
  ChevronDown,
  Download,
  CircleHelp,
  Radio,
  Check,
  ArrowRight,
  X,
  LoaderCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { Device, Scan } from '../shared/types';
import { api, dateTime } from './lib';
import { useOverview } from './useOverview';
import type { Page } from './navigation';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Metrics } from './components/Metrics';
import { DeviceList } from './components/DeviceList';
import { DeviceDrawer } from './components/DeviceDrawer';
import { NetworkMap } from './components/NetworkMap';
import { History } from './components/History';
import { Settings } from './components/Settings';
import { Activity } from './components/Activity';
export default function App() {
  const { data, error, refresh } = useOverview();
  const [page, setPage] = useState<Page>('overview');
  const [interfaceId, setInterfaceId] = useState('');
  const [selected, setSelected] = useState<Device | null>(null);
  const [actionError, setActionError] = useState('');
  const [starting, setStarting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [optimisticScan, setOptimisticScan] = useState<Scan | null>(null);
  function navigate(next: Page) {
    setPage(next);
    setSelected(null);
    setMenuOpen(false);
  }
  const selectDevice = useCallback((device: Device) => setSelected(device), []);
  const network =
    data?.interfaces.find((n) => n.id === (interfaceId || data.settings.interfaceId)) ??
    data?.interfaces[0];
  const currentScan =
    data?.activeScan ??
    (optimisticScan &&
    !data?.scans.some((scan) => scan.id === optimisticScan.id && scan.status !== 'running')
      ? optimisticScan
      : null);
  const scanning = Boolean(currentScan) || starting;
  const devices =
    data?.devices.filter((device) => !network || device.network === network.scanCidr) ?? [];
  const latest = data?.scans.find(
    (scan) => scan.status === 'complete' && (!network || scan.network === network.scanCidr),
  );
  // Keep WebGL resources and the user's camera stable across polling responses.
  const deviceSignature = JSON.stringify(devices);
  const mapDevices = useMemo<Device[]>(() => JSON.parse(deviceSignature), [deviceSignature]);
  async function scan(passive = false) {
    if (!network) return;
    setStarting(true);
    setActionError('');
    try {
      const scan = await api<Scan>('/scans', {
        method: 'POST',
        body: JSON.stringify({ interfaceId: network.id, mode: passive ? 'passive' : 'discovery' }),
      });
      setOptimisticScan(scan);
      await refresh();
    } catch (error) {
      setActionError((error as Error).message);
    } finally {
      setStarting(false);
    }
  }
  async function cancel() {
    try {
      await api('/scans/cancel', { method: 'POST' });
      await refresh();
    } catch (error) {
      setActionError((error as Error).message);
    }
  }
  const title =
    page === 'overview' ? (
      <>
        Votre réseau, <em>sous un nouveau jour.</em>
      </>
    ) : page === 'devices' ? (
      <>
        Chaque appareil <em>a sa place.</em>
      </>
    ) : page === 'history' ? (
      <>
        Le réseau change. <em>Gardez le fil.</em>
      </>
    ) : (
      <>
        Un observatoire <em>à votre mesure.</em>
      </>
    );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <Sidebar
        page={page}
        menuOpen={menuOpen}
        deviceCount={devices.length}
        help={help}
        onNavigate={navigate}
        onHelp={() => setHelp(!help)}
      />
      <div className="app-content">
        <Topbar page={page} onMenu={() => setMenuOpen(!menuOpen)} />
        <main id="main">
          <div className="page-heading">
            <div>
              <div className="page-kicker">
                <span className="little-line" />
                LE SENS DES CONNEXIONS
              </div>
              <h1>{title}</h1>
              <p>
                {page === 'overview'
                  ? 'Explorez, comprenez et retrouvez les appareils qui vous entourent.'
                  : page === 'devices'
                    ? 'Des observations réelles, des identités que vous pouvez enrichir.'
                    : page === 'history'
                      ? 'Des instantanés pour comprendre ce qui évolue chez vous.'
                      : 'Une collecte maîtrisée, des données qui restent chez vous.'}
              </p>
            </div>
            <div className="heading-actions">
              <a
                className="button secondary export-top"
                href="/api/export?format=json"
                download
                aria-label="Exporter les données JSON"
              >
                <Download size={16} />
                <span>Exporter</span>
              </a>
              <button
                className="button primary"
                disabled={scanning || !network || Boolean(error)}
                onClick={() => void scan()}
              >
                {scanning ? <LoaderCircle className="spin" size={16} /> : <ScanLine size={16} />}
                <span>{scanning ? 'Découverte en cours' : 'Découvrir le réseau'}</span>
                {!scanning && <ArrowUpRight size={15} />}
              </button>
            </div>
          </div>
          {help && (
            <section className="help-banner">
              <div>
                <h2>Quelques repères, simplement.</h2>
                <p>
                  <strong>Observé</strong> : l’appareil a répondu à la collecte.{' '}
                  <strong>Dans le cache</strong> : le système connaît son adresse.{' '}
                  <strong>Non revu</strong> : il était absent de la dernière collecte de ce
                  périmètre.
                </p>
                <p>
                  La carte représente un regroupement logique. Elle ne mesure ni les câbles, ni la
                  position dans la maison, ni le trafic des autres appareils.
                </p>
              </div>
              <button
                className="icon-button"
                aria-label="Fermer l’aide"
                onClick={() => setHelp(false)}
              >
                <X size={18} />
              </button>
            </section>
          )}
          {(error || actionError) && (
            <div className="error-banner" role="alert">
              <AlertCircle size={18} />
              <span>{error ? `Service local indisponible. ${error}` : actionError}</span>
              <button
                className="text-button"
                onClick={() => {
                  setActionError('');
                  void refresh();
                }}
              >
                Réessayer
                <RefreshCw size={14} />
              </button>
            </div>
          )}
          {!data && !error && (
            <div className="loading-state" role="status">
              <LoaderCircle size={26} className="spin" />
              <h2>Ouverture de votre observatoire…</h2>
              <p>Connexion au service local.</p>
            </div>
          )}
          {data && (
            <>
              <div className="network-toolbar">
                <div className="network-selector">
                  <span className="network-state-icon">
                    <Radio size={15} />
                  </span>
                  <label>
                    <span className="sr-only">Interface réseau</span>
                    <select
                      value={network?.id ?? ''}
                      onChange={(event) => setInterfaceId(event.target.value)}
                      disabled={scanning}
                    >
                      {!data.interfaces.length && (
                        <option value="">Aucun réseau privé disponible</option>
                      )}
                      {data.interfaces.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name} · {n.address}
                        </option>
                      ))}
                    </select>
                  </label>
                  <ChevronDown size={13} />
                  <span className="network-cidr mono">{network?.scanCidr}</span>
                </div>
                <span className="last-scan">
                  {scanning ? (
                    <>
                      <i className="tiny-dot pulse" />
                      Collecte en cours
                      <button className="text-button" onClick={() => void cancel()}>
                        Annuler
                      </button>
                    </>
                  ) : latest ? (
                    <>
                      <Check size={13} />
                      Dernière collecte : {dateTime(latest.finishedAt!)}
                    </>
                  ) : (
                    'Prêt pour votre première découverte'
                  )}
                </span>
              </div>
              {!network && (
                <div className="notice">
                  <InfoIcon />
                  <div>
                    Connectez cet ordinateur à un réseau privé IPv4 pour démarrer. Les réseaux
                    publics, IPv6 seuls et les adresses locales automatiques ne sont pas couverts
                    par cette version.
                  </div>
                </div>
              )}
              {page === 'overview' && (
                <>
                  <Metrics devices={devices} />
                  <div className="observatory-grid">
                    <NetworkMap
                      devices={mapDevices}
                      network={network}
                      onSelect={selectDevice}
                      scanning={scanning}
                    />
                    <Activity
                      scans={data.scans.filter(
                        (scan) => !network || scan.network === network.scanCidr,
                      )}
                      scanning={scanning}
                      onHistory={() => setPage('history')}
                    />
                  </div>
                  {latest?.warnings.length ? (
                    <div className="collection-note">
                      <InfoIcon />
                      <span>{latest.warnings.join(' ')}</span>
                      <button className="text-button" onClick={() => setPage('settings')}>
                        Diagnostic
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  ) : null}
                  <DeviceList devices={devices} onSelect={selectDevice} compact />
                </>
              )}
              {page === 'devices' && <DeviceList devices={devices} onSelect={selectDevice} />}
              {page === 'history' && <History scans={data.scans} onSelect={selectDevice} />}
              {page === 'settings' && (
                <Settings data={data} onSaved={refresh} onPassive={() => void scan(true)} />
              )}
              <footer className="main-footer">
                <span>
                  <Orbit size={13} />
                  Un peu plus de clarté dans votre quotidien.
                </span>
                <span>Local. Privé. Open source.</span>
              </footer>
            </>
          )}
        </main>
      </div>
      {selected && (
        <DeviceDrawer
          key={`${selected.id}-${page}`}
          device={selected}
          onClose={() => setSelected(null)}
          onSaved={refresh}
          readOnly={page === 'history'}
        />
      )}
    </div>
  );
}
function InfoIcon() {
  return <CircleHelp size={15} aria-hidden="true" />;
}
