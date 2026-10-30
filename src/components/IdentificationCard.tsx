import { Fingerprint } from 'lucide-react';
import type { Device, IdentificationEvidence } from '../../shared/types';
import { categoryLabels, dateTime, deviceTypeLabel } from '../lib';
const sources: Record<IdentificationEvidence['source'], string> = {
  local: 'Cet ordinateur',
  hostname: 'Nom annoncé',
  'mdns-model': 'Modèle annoncé via mDNS',
  'mdns-service': 'Service annoncé via mDNS',
};
export function IdentificationCard({ device }: { device: Device }) {
  const result = device.identification;
  return (
    <section className="identification-card" aria-label="Identification du type d’appareil">
      <div className="identification-heading">
        <Fingerprint size={18} />
        <h3>Identification</h3>
      </div>
      <strong className="identification-result">{deviceTypeLabel(device)}</strong>
      {device.category !== 'unknown' && <p>Votre choix manuel est prioritaire sur la détection.</p>}
      {!result ? (
        <p>Ce relevé ne contient pas encore d’identification automatique.</p>
      ) : (
        <>
          <span className="identification-confidence">
            {result.confidence === 'high'
              ? 'Confiance élevée · information locale'
              : result.confidence === 'medium'
                ? 'Confiance modérée · type probable'
                : result.confidence === 'low'
                  ? 'Indice faible · type possible'
                  : 'Indices insuffisants pour conclure'}
          </span>
          {device.category !== 'unknown' && (
            <p>Suggestion automatique : {categoryLabels[result.category]}.</p>
          )}
          {result.reason === 'conflicting' && (
            <p>
              Les indices suggèrent plusieurs types d’appareils. Aucune catégorie automatique n’est
              retenue.
            </p>
          )}
          {result.evidence.length > 0 && (
            <ul>
              {result.evidence.map((item, index) => (
                <li key={index}>
                  <span>{sources[item.source]}</span>
                  <code>{item.value}</code>
                </li>
              ))}
            </ul>
          )}
          {result.confidence !== 'high' && (
            <p>
              Les noms et services sont déclarés par le réseau ; ils ne prouvent pas le modèle
              physique. Vous pouvez corriger le type ci-dessous.
            </p>
          )}
        </>
      )}
      {device.role === 'gateway' && (
        <p>
          Passerelle est un rôle réseau : il peut être assuré par un routeur, un ordinateur ou un
          téléphone.
        </p>
      )}
      {Boolean(device.services?.length) && (
        <details>
          <summary>Services annoncés ({device.services!.length})</summary>
          <ul>
            {device.services!.map((service, index) => (
              <li key={index}>
                <span>{service.name || service.host}</span>
                <code>
                  _{service.type}._tcp{service.model ? ` · ${service.model}` : ''}
                </code>
              </li>
            ))}
          </ul>
        </details>
      )}
      <small>Indices du relevé du {dateTime(device.lastSeen)}.</small>
    </section>
  );
}
