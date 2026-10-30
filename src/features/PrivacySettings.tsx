import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { api } from '../lib';
import { Panel } from '../ui/primitives';
import { Modal } from '../ui/Modal';
export function PrivacySettings({
  demo,
  onRefresh,
}: {
  demo: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function clear() {
    setBusy(true);
    setError('');
    try {
      await api('/activity', {
        method: 'DELETE',
        body: JSON.stringify({ confirm: 'DELETE_ACTIVITY' }),
      });
      setOpen(false);
      setConfirm('');
      setMessage('Journal supprimé et collecteurs locaux arrêtés.');
      await onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title="Journal d’activité et confidentialité" kicker="DATA CONTROL">
      <p>
        Les connexions et les domaines sont des métadonnées privées. La conservation du journal suit
        la durée configurée ci-dessus. L’inventaire et les instantanés de découverte sont conservés
        séparément.
      </p>
      <div className="privacy-actions">
        {!demo && (
          <a className="button secondary" href="/api/activity/export" download>
            <Download size={16} />
            Exporter l’activité JSON
          </a>
        )}
        <button className="button danger" disabled={demo} onClick={() => setOpen(true)}>
          <Trash2 size={16} />
          Supprimer le journal d’activité
        </button>
      </div>
      <p className="hint">
        Export : 1 000 observations les plus récentes au maximum ; le fichier indique s’il est
        tronqué. Les exports peuvent contenir des domaines et des noms de processus.
      </p>
      {message && (
        <p role="status" className="success-message">
          {message}
        </p>
      )}
      {open && (
        <Modal title="Supprimer le journal d’activité ?" onClose={() => setOpen(false)} busy={busy}>
          <p>
            Cette action supprime définitivement les observations et alertes du journal et arrête
            les deux collecteurs locaux. Vos appareils, annotations et instantanés restent
            conservés.
          </p>
          <label className="field">
            Saisissez SUPPRIMER pour confirmer
            <input autoFocus value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button
            className="button danger"
            disabled={busy || confirm !== 'SUPPRIMER'}
            onClick={() => void clear()}
          >
            Supprimer définitivement
          </button>
        </Modal>
      )}
    </Panel>
  );
}
