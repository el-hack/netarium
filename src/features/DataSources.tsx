import { useState } from 'react';
import { Database, Radio, ShieldCheck, Upload, Check, Info, Power } from 'lucide-react';
import type { Intelligence, SourceState } from '../../shared/activity';
import type { Device } from '../../shared/types';
import { api, dateTime, deviceName } from '../lib';
import { Panel, Empty } from '../ui/primitives';
import { Modal } from '../ui/Modal';
const descriptions: Record<string, { access: string; missing: string; permission: string }> = {
  discovery: {
    access: 'Adresses IPv4, MAC disponibles, noms et annonces mDNS.',
    missing: 'Trafic, processus, pages web et câblage physique.',
    permission: 'Découverte manuelle sur l’interface choisie.',
  },
  interface: {
    access: 'Octets entrants/sortants et débits de l’interface de cet ordinateur.',
    missing: 'Consommation des autres appareils ou par application.',
    permission: 'Activation explicite. Lecture des compteurs système toutes les 10 s.',
  },
  agent: {
    access:
      'Sockets, ports, adresses IP, PID et noms de processus accessibles à votre utilisateur.',
    missing: 'Logiciels installés, contenu des communications, volumes par application.',
    permission: 'Consentement explicite. lsof sur macOS/Linux, sans élévation de privilèges.',
  },
  'dns-import': {
    access: 'Domaines et horodatages d’un journal DNS normalisé importé.',
    missing: 'Pages consultées, URL complètes et consommation associée.',
    permission: 'Fichier choisi manuellement et association à un appareil confirmée.',
  },
  'flow-import': {
    access: 'Adresses, ports, protocole et octets déclarés par des flux normalisés.',
    missing: 'Processus responsables et collecte NetFlow/IPFIX directe.',
    permission: 'Fichier choisi manuellement. La source reste déclarative.',
  },
};
export function DataSources({
  data,
  devices,
  demo,
  onRefresh,
  onDevice,
}: {
  data: Intelligence;
  devices: Device[];
  demo: boolean;
  onRefresh: () => Promise<void>;
  onDevice: (id: string) => void;
}) {
  const [consent, setConsent] = useState<'interface' | 'agent' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function configure(kind: 'interface' | 'agent', enabled: boolean) {
    setBusy(true);
    setError('');
    try {
      await api('/sources/local', {
        method: 'POST',
        body: JSON.stringify({ kind, enabled, consent: enabled }),
      });
      setConsent(null);
      setMessage(
        enabled
          ? 'Activation demandée. Consultez l’état de la source et ses observations dans Activity Explorer.'
          : 'Collecteur arrêté. Son historique est conservé.',
      );
      await onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="source-center">
      <div className="visibility-banner">
        <ShieldCheck size={25} />
        <div>
          <h2>Votre visibilité est partielle, et explicable.</h2>
          <p>
            Une machine sur le Wi-Fi ne voit pas automatiquement les échanges des autres appareils.
            Chaque capacité dépend d’une source réellement disponible.
          </p>
        </div>
        <span className="soft-tag">LOCAL FIRST</span>
      </div>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="success-message">
          <Check size={16} />
          {message}
        </p>
      )}
      <div className="source-list">
        {data.sources.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            busy={busy}
            demo={demo}
            onToggle={() => {
              if (source.id === 'interface' || source.id === 'agent') {
                if (source.enabled) void configure(source.id, false);
                else setConsent(source.id);
              }
            }}
          />
        ))}
      </div>
      <Panel title="Visibility Matrix" kicker="CAPACITÉS CONSERVÉES PAR APPAREIL">
        <p className="table-note">
          Présence d’observations dans l’historique conservé. Une source arrêtée peut avoir des
          données historiques ; ce n’est pas une promesse de visibilité en direct.
        </p>
        {devices.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Appareil</th>
                  <th>Identité</th>
                  <th>Débit local</th>
                  <th>Processus</th>
                  <th>DNS</th>
                  <th>Flux importés</th>
                  <th>Volume / application</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <button className="text-button" onClick={() => onDevice(d.id)}>
                        {deviceName(d)}
                      </button>
                      <small>{d.ip}</small>
                    </td>
                    <td>
                      <span className="matrix-yes">Observée</span>
                    </td>
                    {['interface', 'agent', 'dns-import', 'flow-import'].map((source) => {
                      const c = data.coverage.find(
                        (c) => c.deviceId === d.id && c.source === source,
                      );
                      return (
                        <td key={source}>
                          {c ? (
                            <span
                              className="matrix-yes"
                              title={`${c.count} observations · dernière ${dateTime(c.lastSeen)}`}
                            >
                              <Check size={14} />
                              Historique
                            </span>
                          ) : (
                            <span className="muted">Non disponible</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="muted">Non mesuré</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Découvrez d’abord votre réseau">
            Les capacités apparaîtront pour chaque appareil connu.
          </Empty>
        )}
      </Panel>
      <ImportObservations devices={devices} demo={demo} onRefresh={onRefresh} />
      <Panel title="Extensions prévues" kicker="TRANSPARENCE SUR LE PÉRIMÈTRE">
        <div className="extension-grid">
          {[
            [
              'Router Integration',
              'Connecteurs propres à chaque routeur, avec authentification explicite.',
            ],
            [
              'NetFlow / IPFIX',
              'Réception et décodage natifs des exports de flux. L’import JSON est déjà disponible.',
            ],
            [
              'Packet Metadata Collector',
              'Sonde dédiée et permissions système. Aucun paquet n’est capturé actuellement.',
            ],
            [
              'Agents distants & Windows',
              'Transport authentifié et agents par système. L’agent intégré couvre uniquement cet ordinateur.',
            ],
          ].map(([title, description]) => (
            <div key={title}>
              <span className="soft-tag">Non intégré</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </Panel>
      {consent && (
        <Modal
          title={
            consent === 'agent' ? 'Activer l’agent local' : 'Activer les compteurs d’interface'
          }
          busy={busy}
          onClose={() => setConsent(null)}
        >
          <div className="consent-copy">
            <ShieldCheck size={28} />
            <p>{descriptions[consent].access}</p>
            <p>{descriptions[consent].permission}</p>
            <p>
              Ces métadonnées peuvent révéler des usages privés. Elles restent dans la base locale,
              selon votre durée de conservation. Aucune inspection du contenu ni interception HTTPS.
            </p>
            <p>
              Vous pourrez arrêter la collecte ici et supprimer l’historique dans Settings.
              L’activation n’est pas conservée après le redémarrage du service.
            </p>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button
              disabled={busy || demo}
              className="button primary"
              onClick={() => void configure(consent, true)}
            >
              J’autorise la collecte sur cet ordinateur
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function SourceCard({
  source,
  busy,
  demo,
  onToggle,
}: {
  source: SourceState;
  busy: boolean;
  demo: boolean;
  onToggle: () => void;
}) {
  const description = descriptions[source.id];
  return (
    <article className="source-row">
      <div className={`source-icon ${source.error ? 'warning' : ''}`}>
        {source.id === 'agent' ? (
          <ShieldCheck size={22} />
        ) : source.id.endsWith('import') ? (
          <Upload size={22} />
        ) : (
          <Radio size={22} />
        )}
      </div>
      <div className="source-details">
        <div className="source-title">
          <h3>{source.name}</h3>
          <span
            className={`status ${source.error ? 'cached' : source.enabled ? 'observed' : 'unseen'}`}
          >
            <i />
            {source.error
              ? 'En erreur'
              : source.enabled
                ? source.id.endsWith('import')
                  ? 'Import disponible'
                  : 'Activée'
                : 'Désactivée'}
          </span>
        </div>
        <p>{source.scope}</p>
        <dl>
          <div>
            <dt>Accessible</dt>
            <dd>{description.access}</dd>
          </div>
          <div>
            <dt>Indisponible</dt>
            <dd>{description.missing}</dd>
          </div>
          <div>
            <dt>Permissions</dt>
            <dd>{description.permission}</dd>
          </div>
        </dl>
        {source.error && <p className="form-error">{source.error}</p>}
        <small>
          Dernier relevé réussi : {source.lastSync ? dateTime(source.lastSync) : 'aucun'}
        </small>
      </div>
      {['interface', 'agent'].includes(source.id) ? (
        <button
          className={`button ${source.enabled ? 'secondary' : 'primary'}`}
          disabled={busy || demo}
          onClick={onToggle}
        >
          <Power size={14} />
          {source.enabled ? 'Arrêter' : 'Configurer'}
        </button>
      ) : (
        <Database size={17} className="muted" />
      )}
    </article>
  );
}
function ImportObservations({
  devices,
  demo,
  onRefresh,
}: {
  devices: Device[];
  demo: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [deviceId, setDeviceId] = useState('');
  const [kind, setKind] = useState<'dns' | 'flow'>('dns');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const records = JSON.parse(text) as unknown;
      if (!Array.isArray(records)) throw new Error('Le fichier doit contenir un tableau JSON.');
      const result = await api<{ inserted: number }>('/activity/import', {
        method: 'POST',
        body: JSON.stringify({ deviceId, kind, records }),
      });
      setMessage(`${result.inserted} observations ajoutées ; les doublons ont été ignorés.`);
      setText('');
      setFileName('');
      setConfirmed(false);
      await onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title="Importer des observations" kicker="DNS & FLUX NORMALISÉS">
      <div className="import-layout">
        <form onSubmit={submit}>
          <div className="form-row">
            <label className="field">
              Type de source
              <select
                disabled={demo || busy}
                value={kind}
                onChange={(e) => setKind(e.target.value as 'dns' | 'flow')}
              >
                <option value="dns">Journal DNS</option>
                <option value="flow">Flux réseau</option>
              </select>
            </label>
            <label className="field">
              Appareil associé
              <select
                required
                disabled={demo || busy}
                value={deviceId}
                onChange={(e) => {
                  setDeviceId(e.target.value);
                  setConfirmed(false);
                }}
              >
                <option value="">Choisir l’appareil source</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {deviceName(d)} · {d.ip}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="file-field">
            <Upload size={20} />
            <span>
              {fileName || 'Choisir un fichier JSON'}
              <small>Maximum 500 observations · 1 Mo</small>
            </span>
            <input
              aria-label="Fichier d’observations JSON"
              type="file"
              accept=".json,application/json"
              disabled={demo || busy}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                setError('');
                if (!f) return;
                if (f.size > 1000000) {
                  setError('Le fichier dépasse 1 Mo.');
                  return;
                }
                try {
                  setText(await f.text());
                  setFileName(f.name);
                } catch {
                  setError('Lecture du fichier impossible.');
                }
              }}
            />
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={demo || busy}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Je confirme que ce journal concerne l’appareil sélectionné.
          </label>
          <p className="hint">
            <Info size={15} />
            Les adresses ne sont pas utilisées pour fusionner automatiquement des identités.
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="success-message">
              {message}
            </p>
          )}
          <button
            className="button primary"
            disabled={demo || busy || !deviceId || !text || !confirmed}
          >
            <Upload size={15} />
            {busy ? 'Import en cours…' : 'Valider et importer'}
          </button>
        </form>
        <div className="import-schema">
          <h3>Format attendu</h3>
          <p>
            Tableau JSON normalisé. Convertissez le journal de votre résolveur ou de votre
            collecteur en conservant les horodatages d’origine.
          </p>
          <pre>
            {kind === 'dns'
              ? '[\n  {\n    "timestamp": "2026-10-30T12:00:00Z",\n    "domain": "example.org"\n  }\n]'
              : '[\n  {\n    "timestamp": "2026-10-30T12:00:00Z",\n    "endAt": "2026-10-30T12:01:00Z",\n    "localIp": "192.168.1.10",\n    "remoteIp": "203.0.113.10",\n    "remotePort": 443,\n    "protocol": "TCP",\n    "bytesOut": 2048\n  }\n]'}
          </pre>
          <small>
            Exemple de schéma uniquement. Aucun import automatique. Les valeurs omises restent
            inconnues.
          </small>
        </div>
      </div>
    </Panel>
  );
}
