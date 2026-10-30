import { useState } from 'react';
import type { ActivityRecord } from '../../shared/activity';
import { dateTime } from '../lib';
import { rate } from './primitives';
export function TrafficChart({ records }: { records: ActivityRecord[] }) {
  const samples = records
    .filter((r) => r.kind === 'bandwidth' && r.rateIn !== null && r.rateOut !== null)
    .slice(0, 120)
    .reverse();
  const [selected, setSelected] = useState<number | null>(null);
  const peak = Math.max(1, ...samples.map((r) => Math.max(r.rateIn!, r.rateOut!)));
  const selectedIndex = Math.min(selected ?? samples.length - 1, samples.length - 1);
  const current = samples[selectedIndex];
  const start = Date.parse(samples[0]?.timestamp ?? '') || 0;
  const end = Date.parse(samples.at(-1)?.endAt ?? samples.at(-1)?.timestamp ?? '') || start + 1;
  const x = (timestamp: string) =>
    30 + ((Date.parse(timestamp) - start) / Math.max(1, end - start)) * 940;
  // Draw each measured interval independently: no line bridges an unobserved gap.
  const path = (key: 'rateIn' | 'rateOut') =>
    samples
      .map((r) => {
        const y = 175 - ((r[key] ?? 0) / peak) * 140;
        return `M${x(r.timestamp)},${y}H${x(r.endAt ?? r.timestamp)}`;
      })
      .join(' ');
  return (
    <div className="traffic-chart">
      {samples.length ? (
        <>
          <div className="chart-readout">
            <span>
              <i className="legend-dot" />
              Entrant <b>{rate(current?.rateIn)}</b>
            </span>
            <span>
              <i className="legend-dot outgoing" />
              Sortant <b>{rate(current?.rateOut)}</b>
            </span>
            <small>{current ? dateTime(current.timestamp) : ''}</small>
          </div>
          <svg
            viewBox="0 0 1000 210"
            role="img"
            aria-label={`Débit mesuré : ${samples.length} intervalles. Maximum ${rate(peak)}.`}
          >
            {[35, 105, 175].map((y) => (
              <line key={y} x1="30" y1={y} x2="970" y2={y} className="chart-grid" />
            ))}
            <path d={path('rateIn')} className="chart-line" />
            <path d={path('rateOut')} className="chart-line outgoing" />
            <text x="30" y="207" className="chart-axis">
              {samples[0] ? dateTime(samples[0].timestamp) : ''}
            </text>
            <text x="970" y="207" textAnchor="end" className="chart-axis">
              {samples.at(-1) ? dateTime(samples.at(-1)!.endAt ?? samples.at(-1)!.timestamp) : ''}
            </text>
            {samples.map((r, i) => (
              <circle
                key={r.id}
                cx={x(r.timestamp)}
                cy={175 - (r.rateIn! / peak) * 140}
                r="4"
                className="chart-point"
                onMouseEnter={() => setSelected(i)}
              />
            ))}
          </svg>
          <label className="chart-scrubber">
            Explorer les intervalles
            <input
              type="range"
              aria-label="Intervalle du graphique"
              min="0"
              max={Math.max(0, samples.length - 1)}
              value={selectedIndex}
              onChange={(e) => setSelected(Number(e.target.value))}
            />
          </label>
        </>
      ) : (
        <div className="chart-empty">
          <div className="chart-empty-lines" />
          <strong>La mesure commence avec une source.</strong>
          <span>Deux échantillons d’interface sont nécessaires. Aucun débit n’est estimé.</span>
        </div>
      )}
    </div>
  );
}
