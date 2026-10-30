import { effectiveCategory } from '../../shared/identification';
import { Network, Radio, Clock3, Fingerprint } from 'lucide-react';
import type { Device } from '../../shared/types';
export function Metrics({ devices }: { devices: Device[] }) {
  const stats = [
    {
      label: 'Appareils connus',
      value: devices.length,
      note: 'Dans votre périmètre',
      icon: Network,
      tone: 'neutral',
    },
    {
      label: 'Présence observée',
      value: devices.filter((device) => device.status === 'observed').length,
      note: 'Au dernier relevé',
      icon: Radio,
      tone: 'green',
    },
    {
      label: 'Dans le cache',
      value: devices.filter((device) => device.status === 'cached').length,
      note: 'Présence à confirmer',
      icon: Clock3,
      tone: 'sand',
    },
    {
      label: 'À identifier',
      value: devices.filter((device) => effectiveCategory(device) === 'unknown').length,
      note: 'Type encore inconnu',
      icon: Fingerprint,
      tone: 'blue',
    },
  ];
  return (
    <section className="metrics" aria-label="Résumé du réseau">
      {stats.map((stat) => (
        <div className={`metric ${stat.tone}`} key={stat.label}>
          <div className="metric-top">
            <span>{stat.label}</span>
            <span className="metric-icon">
              <stat.icon size={19} />
            </span>
          </div>
          <strong>{stat.value.toString().padStart(2, '0')}</strong>
          <span className="metric-note">
            {stat.tone === 'green' && <i className="tiny-dot" />}
            {stat.note}
          </span>
        </div>
      ))}
    </section>
  );
}
