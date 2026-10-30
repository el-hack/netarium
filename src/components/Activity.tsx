import { ArrowUpRight, Check, CircleDashed, ScanLine, ShieldCheck } from 'lucide-react';
import type { Scan } from '../../shared/types';
import { timeOnly } from '../lib';
export function Activity({
  scans,
  scanning,
  onHistory,
}: {
  scans: Scan[];
  scanning: boolean;
  onHistory: () => void;
}) {
  return (
    <aside className="activity-column">
      <section className="panel activity-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">AU FIL DU TEMPS</span>
            <h2>L’activité récente</h2>
          </div>
          <span className="live-dot" />
        </div>
        <ol className="activity-list">
          {scanning && (
            <li>
              <span className="activity-symbol scanning">
                <ScanLine size={15} />
              </span>
              <div>
                <strong>À la rencontre du réseau</strong>
                <p>La découverte est en cours…</p>
              </div>
            </li>
          )}
          {scans
            .filter((scan) => scan.status !== 'running')
            .slice(0, 4)
            .map((scan) => (
              <li key={scan.id}>
                <span className={`activity-symbol ${scan.status === 'complete' ? '' : 'warning'}`}>
                  {scan.status === 'complete' ? <Check size={15} /> : <CircleDashed size={15} />}
                </span>
                <div>
                  <strong>
                    {scan.status === 'complete'
                      ? 'Un instantané enregistré'
                      : scan.status === 'cancelled'
                        ? 'Découverte annulée'
                        : 'Collecte interrompue'}
                  </strong>
                  <p>
                    {scan.status === 'complete'
                      ? `${scan.count} appareil${scan.count > 1 ? 's' : ''} dans le périmètre.`
                      : scan.error}
                  </p>
                  <time>{timeOnly(scan.finishedAt ?? scan.startedAt)}</time>
                </div>
              </li>
            ))}
          {!scans.length && (
            <li>
              <span className="activity-symbol">
                <CircleDashed size={16} />
              </span>
              <div>
                <strong>Votre observatoire est prêt</strong>
                <p>La première découverte lancera l’historique de votre réseau.</p>
                <time>À vous de jouer</time>
              </div>
            </li>
          )}
        </ol>
        <button className="text-button" onClick={onHistory}>
          Ouvrir la chronologie
          <ArrowUpRight size={15} />
        </button>
      </section>
      <section className="quiet-card">
        <span className="quiet-illustration">
          <ShieldCheck size={30} strokeWidth={1.2} />
          <span />
          <span />
        </span>
        <span className="eyebrow">LOCAL PAR NATURE</span>
        <h3>
          Votre réseau.
          <br />
          Vos données.
        </h3>
        <p>
          Tout reste sur cet ordinateur.
          <br />
          Le calme, aussi.
        </p>
        <span className="privacy-note">
          <i />
          Sans cloud · Sans compte
        </span>
      </section>
    </aside>
  );
}
