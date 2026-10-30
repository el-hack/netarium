import { ArrowUpRight, Download, LoaderCircle, ScanLine } from 'lucide-react';
import type { Page } from '../navigation';
const content: Record<
  Page,
  { eyebrow: string; title: string; accent: string; description: string }
> = {
  overview: {
    eyebrow: 'VOTRE OBSERVATOIRE PERSONNEL',
    title: 'Votre réseau,',
    accent: 'en perspective.',
    description: 'Un espace pour explorer les connexions de votre quotidien.',
  },
  devices: {
    eyebrow: 'INVENTAIRE DU RÉSEAU',
    title: 'Tous vos',
    accent: 'appareils.',
    description: 'Retrouvez un appareil, identifiez-le et donnez-lui un nom.',
  },
  history: {
    eyebrow: 'LA MÉMOIRE DES CONNEXIONS',
    title: 'Gardez',
    accent: 'le fil.',
    description: 'Revenez sur vos collectes et comprenez ce qui a changé.',
  },
  settings: {
    eyebrow: 'PRÉFÉRENCES & CONFIDENTIALITÉ',
    title: 'À votre rythme.',
    accent: 'Chez vous.',
    description: 'Une collecte maîtrisée, des données qui vous appartiennent.',
  },
};
export function PageHeader({
  page,
  scanning,
  disabled,
  onScan,
}: {
  page: Page;
  scanning: boolean;
  disabled: boolean;
  onScan: () => void;
}) {
  const text = content[page];
  return (
    <div className="page-heading">
      <div className="page-heading-copy">
        <span className="page-kicker">
          <i />
          {text.eyebrow}
        </span>
        <h1>
          {text.title} <em>{text.accent}</em>
        </h1>
        <p>{text.description}</p>
      </div>
      <div className="heading-actions">
        <a
          className="button secondary export-top"
          href="/api/export?format=json"
          download
          aria-label="Exporter les données JSON"
        >
          <Download size={17} />
          <span>Exporter</span>
        </a>
        <button className="button primary" disabled={disabled || scanning} onClick={onScan}>
          {scanning ? <LoaderCircle className="spin" size={17} /> : <ScanLine size={17} />}
          <span>{scanning ? 'Découverte en cours' : 'Découvrir le réseau'}</span>
          {!scanning && <ArrowUpRight size={16} />}
        </button>
      </div>
    </div>
  );
}
