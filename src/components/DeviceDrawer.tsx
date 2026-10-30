import { useEffect, useRef, useState } from 'react';
import { X, Check, Fingerprint, Info } from 'lucide-react';
import { categories, type Category, type Device } from '../../shared/types';
import { api, categoryLabels, dateTime, deviceName, sourceLabels, statusLabel } from '../lib';
import { DeviceIcon } from './Icons';
export function DeviceDrawer({
  device,
  onClose,
  onSaved,
  readOnly = false,
}: {
  device: Device;
  onClose: () => void;
  onSaved: () => Promise<void>;
  readOnly?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [label, setLabel] = useState(device.label);
  const [category, setCategory] = useState<Category>(device.category);
  const [notes, setNotes] = useState(device.notes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirty = label !== device.label || category !== device.category || notes !== device.notes;
  function requestClose() {
    if (busy) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/devices/${device.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ label, category, notes }),
      });
      await onSaved();
      onClose();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="drawer"
      aria-labelledby="device-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) requestClose();
      }}
    >
      <div className="drawer-content">
        <div className="drawer-top">
          <span className="eyebrow">FICHE APPAREIL</span>
          <button
            className="icon-button"
            onClick={requestClose}
            disabled={busy}
            aria-label="Fermer les détails"
          >
            <X size={20} />
          </button>
        </div>
        <div className="drawer-identity">
          <span className="device-icon large sage">
            <DeviceIcon device={device} size={30} />
          </span>
          <h2 id="device-dialog-title">{deviceName(device)}</h2>
          <span className={`status ${device.status}`}>
            <i />
            {statusLabel(device)}
          </span>
        </div>
        <div className="evidence-box">
          <Fingerprint size={18} />
          <div>
            <strong>{sourceLabels[device.source]}</strong>
            <p>
              {device.source === 'neighbor'
                ? 'Une entrée du cache ne garantit pas que l’appareil répond actuellement.'
                : 'Présence constatée au moment de cette observation.'}
            </p>
          </div>
        </div>
        <dl className="properties">
          <div>
            <dt>Adresse IPv4</dt>
            <dd className="mono">{device.ip}</dd>
          </div>
          <div>
            <dt>Adresse MAC</dt>
            <dd className="mono">{device.mac || 'Non disponible'}</dd>
          </div>
          <div>
            <dt>Nom observé</dt>
            <dd>{device.hostname || 'Non disponible'}</dd>
          </div>
          <div>
            <dt>Fabricant observé</dt>
            <dd>{device.vendor || 'Non disponible'}</dd>
          </div>
          <div>
            <dt>Première observation</dt>
            <dd>{dateTime(device.firstSeen)}</dd>
          </div>
          <div>
            <dt>Dernière observation</dt>
            <dd>{dateTime(device.lastSeen)}</dd>
          </div>
          <div>
            <dt>Périmètre</dt>
            <dd className="mono">{device.network}</dd>
          </div>
        </dl>
        {confirmDiscard && (
          <div className="discard-notice" role="alert">
            <strong>Conserver vos modifications ?</strong>
            <p>Cette fiche contient des changements non enregistrés.</p>
            <div>
              <button
                className="button secondary"
                onClick={() => setConfirmDiscard(false)}
                autoFocus
              >
                Continuer l’édition
              </button>
              <button className="text-button" onClick={onClose}>
                Abandonner les modifications
              </button>
            </div>
          </div>
        )}
        <form onSubmit={save}>
          <div className="form-section-title">
            <h3>Votre organisation</h3>
            <span>Renseignée manuellement</span>
          </div>
          <label className="field">
            Nom personnalisé
            <input
              value={label}
              maxLength={80}
              disabled={readOnly || busy}
              placeholder="Ex. MacBook du bureau"
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <label className="field">
            Catégorie
            <select
              aria-label="Catégorie"
              value={category}
              disabled={readOnly || busy}
              onChange={(event) => setCategory(event.target.value as Category)}
            >
              {categories.map((value) => (
                <option key={value} value={value}>
                  {categoryLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Notes
            <textarea
              value={notes}
              disabled={readOnly || busy}
              maxLength={2000}
              placeholder="Pièce, usage, informations utiles…"
              rows={3}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          {readOnly ? (
            <p className="hint">
              <Info size={15} /> Instantané historique en lecture seule.
            </p>
          ) : (
            <>
              <p className="hint">
                <Info size={15} /> Vos annotations restent sur cet ordinateur.
              </p>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <div className="drawer-savebar">
                <span>{dirty ? 'Modifications non enregistrées' : 'Votre fiche est à jour'}</span>
                <button className="button primary full" disabled={busy || !dirty} type="submit">
                  <Check size={16} />
                  {busy ? 'Enregistrement…' : 'Enregistrer les modifications'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </dialog>
  );
}
