import { useState } from 'react';
import { Check, ShieldCheck, HardDrive, Terminal, Radar, Info, Save, Download } from 'lucide-react';
import type { Overview, Settings as SettingsType } from '../../shared/types';
import { api } from '../lib';
export function Settings({
  data,
  onSaved,
  onPassive,
}: {
  data: Overview;
  onSaved: () => Promise<void>;
  onPassive: () => void;
}) {
  const [form, setForm] = useState<SettingsType>(data.settings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api('/settings', { method: 'PUT', body: JSON.stringify(form) });
      await onSaved();
      setMessage('Vos préférences ont été enregistrées.');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const tools = [
    {
      title: 'Découverte Nmap',
      ready: data.capabilities.nmap,
      detail: 'Découverte d’hôtes, sans scan de ports.',
    },
    {
      title: 'Sondes ICMP',
      ready: data.capabilities.ping,
      detail: 'Solution de repli pour les appareils qui répondent.',
    },
    {
      title: 'Table des voisins',
      ready: data.capabilities.neighbor,
      detail: 'Adresses connues du système, sans garantie de présence.',
    },
  ];
  return (
    <div className="settings-layout">
      <form className="panel settings-form" onSubmit={save}>
        <span className="eyebrow">À VOTRE RYTHME</span>
        <h2>Préférences de collecte</h2>
        <p className="muted">Vous gardez la main sur votre observatoire.</p>
        <label className="field">
          Interface de collecte automatique
          <select
            value={form.interfaceId ?? ''}
            onChange={(event) => setForm({ ...form, interfaceId: event.target.value || null })}
          >
            <option value="">Sélectionner une interface</option>
            {data.interfaces.map((network) => (
              <option key={network.id} value={network.id}>
                {network.name} · {network.address} · {network.scanCidr}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Fréquence de découverte
          <select
            value={form.intervalMinutes}
            onChange={(event) => setForm({ ...form, intervalMinutes: Number(event.target.value) })}
          >
            <option value={0}>Manuelle uniquement</option>
            <option value={5}>Toutes les 5 minutes</option>
            <option value={15}>Toutes les 15 minutes</option>
            <option value={30}>Toutes les 30 minutes</option>
            <option value={60}>Toutes les heures</option>
          </select>
        </label>
        <label className="field">
          Conservation de l’historique
          <select
            value={form.retentionDays}
            onChange={(event) => setForm({ ...form, retentionDays: Number(event.target.value) })}
          >
            {[7, 30, 90, 365].map((days) => (
              <option key={days} value={days}>
                {days} jours
              </option>
            ))}
          </select>
        </label>
        <p className="hint">
          <Info size={15} />
          Le dernier instantané de chaque réseau est conservé. La collecte automatique fonctionne
          tant que Netarium est lancé.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="success-message">
            <Check size={16} />
            {message}
          </p>
        )}
        <button className="button primary" disabled={busy} type="submit">
          <Save size={16} />
          {busy ? 'Enregistrement…' : 'Enregistrer les préférences'}
        </button>
      </form>
      <div className="settings-right">
        <section className="panel capabilities">
          <span className="eyebrow">DIAGNOSTIC LOCAL</span>
          <h2>Tout sous les yeux.</h2>
          {tools.map((tool) => (
            <div className="capability" key={tool.title}>
              <span className={`capability-icon ${tool.ready ? 'ready' : ''}`}>
                {tool.ready ? <Check size={17} /> : <Terminal size={17} />}
              </span>
              <div>
                <strong>{tool.title}</strong>
                <p>{tool.detail}</p>
              </div>
              <span className={`soft-tag ${tool.ready ? 'green' : ''}`}>
                {tool.ready ? 'Disponible' : 'Absent'}
              </span>
            </div>
          ))}
          {!data.capabilities.nmap && (
            <div className="notice">
              <Info size={16} />
              <div>
                Nmap est optionnel. La découverte utilise ICMP et les voisins locaux. Pour l’ajouter
                sur macOS : <code>brew install nmap</code>, puis relancez Netarium.
              </div>
            </div>
          )}
          <button
            className="button secondary"
            disabled={Boolean(data.activeScan) || !data.interfaces.length}
            onClick={onPassive}
          >
            <Radar size={16} />
            Observer le cache local uniquement
          </button>
        </section>
        <section className="panel privacy">
          <span className="privacy-icon">
            <ShieldCheck size={22} />
          </span>
          <div>
            <h2>Chez vous. Et c’est tout.</h2>
            <p>
              Aucun compte, aucune télémétrie, aucun envoi vers le cloud. Le service écoute
              uniquement sur cet ordinateur.
            </p>
            <div className="storage-path">
              <HardDrive size={14} />
              <code>{data.capabilities.dataDirectory}</code>
            </div>
            <div className="export-buttons">
              <a className="button secondary" href="/api/export?format=json" download>
                <Download size={15} />
                Exporter JSON
              </a>
              <a className="button secondary" href="/api/export?format=csv" download>
                <Download size={15} />
                Exporter CSV
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
