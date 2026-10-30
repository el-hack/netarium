import type { ReactNode } from 'react';
import { ArrowRight, Database, SearchX } from 'lucide-react';
import type { ActivityRecord } from '../../shared/activity';
export const bytes = (n: number | null | undefined) =>
  n === null || n === undefined
    ? '—'
    : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, notation: 'compact' }).format(n) +
      ' o';
export const rate = (n: number | null | undefined) =>
  n === null || n === undefined
    ? '—'
    : n >= 1e6
      ? `${(n / 1e6).toFixed(1)} Mbit/s`
      : `${(n / 1000).toFixed(1)} kbit/s`;
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <SearchX size={28} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Panel({
  title,
  kicker,
  actions,
  children,
  className = '',
}: {
  title: string;
  kicker?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="section-heading">
        <div>
          {kicker && <span className="eyebrow">{kicker}</span>}
          <h2>{title}</h2>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
export function SourceBadge({ record }: { record: ActivityRecord }) {
  const s = record.source;
  return (
    <details className="provenance">
      <summary className="source-badge">
        <Database size={12} />
        {s.sourceId}
      </summary>
      <dl>
        <div>
          <dt>Collecté</dt>
          <dd>{new Date(s.collectedAt).toLocaleString('fr-FR')}</dd>
        </div>
        <div>
          <dt>Précision</dt>
          <dd>
            {
              { sample: 'Échantillonné', reported: 'Déclaré par import', observed: 'Observé' }[
                s.precision
              ]
            }
          </dd>
        </div>
        <div>
          <dt>Confiance</dt>
          <dd>{{ high: 'Élevée', medium: 'Modérée', low: 'Faible' }[s.confidence]}</dd>
        </div>
        <div>
          <dt>Validité</dt>
          <dd>
            {s.expiresAt
              ? `Jusqu’au ${new Date(s.expiresAt).toLocaleString('fr-FR')} · historique ensuite`
              : 'Observation historique'}
          </dd>
        </div>
      </dl>
    </details>
  );
}
export function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail: string;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-button" onClick={onClick}>
      {children}
      <ArrowRight size={14} />
    </button>
  );
}
export function Skeleton() {
  return (
    <div className="skeleton" role="status" aria-label="Chargement des observations">
      <div />
      <div />
      <div />
    </div>
  );
}
