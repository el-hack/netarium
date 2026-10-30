import { Network, Radio, Clock3, CircleHelp } from 'lucide-react';
import type { Device } from '../../shared/types';
export function Metrics({ devices }: { devices: Device[] }) {
  const observed = devices.filter((device) => device.status === 'observed').length;
  const cached = devices.filter((device) => device.status === 'cached').length;
  const unidentified = devices.filter(
    (device) => device.category === 'unknown' && device.role === 'device' && !device.label,
  ).length;
  return (
    <section className="metrics" aria-label="Résumé du réseau">
      <div className="metric">
        <span className="metric-icon">
          <Network size={19} />
        </span>
        <div>
          <span>Appareils connus</span>
          <strong>
            {devices.length}
            <small>dans ce périmètre</small>
          </strong>
        </div>
      </div>
      <div className="metric">
        <span className="metric-icon green">
          <Radio size={19} />
        </span>
        <div>
          <span>Observés au dernier relevé</span>
          <strong>
            {observed}
            <small>
              <i className="tiny-dot" />
              présence constatée
            </small>
          </strong>
        </div>
      </div>
      <div className="metric">
        <span className="metric-icon sand">
          <Clock3 size={19} />
        </span>
        <div>
          <span>Dans le cache local</span>
          <strong>
            {cached}
            <small>présence à confirmer</small>
          </strong>
        </div>
      </div>
      <div className="metric">
        <span className="metric-icon">
          <CircleHelp size={19} />
        </span>
        <div>
          <span>À mieux connaître</span>
          <strong>
            {unidentified}
            <small>identités à enrichir</small>
          </strong>
        </div>
      </div>
    </section>
  );
}
