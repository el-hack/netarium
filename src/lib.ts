import type { Category, Device, EvidenceSource } from '../shared/types';
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Netarium-Client': '1', ...options?.headers },
  });
  if (!response.ok) {
    let message = `Le service a répondu ${response.status}.`;
    try {
      message = (await response.json()).message ?? message;
    } catch {
      /* Preserve the HTTP error when the response isn't JSON. */
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
export const categoryLabels: Record<Category, string> = {
  unknown: 'À identifier',
  computer: 'Ordinateur',
  phone: 'Téléphone',
  media: 'Multimédia',
  storage: 'Stockage',
  iot: 'Objet connecté',
  network: 'Équipement réseau',
};
export const sourceLabels: Record<EvidenceSource, string> = {
  local: 'Interface locale',
  neighbor: 'Table des voisins',
  ping: 'Réponse ICMP',
  nmap: 'Découverte Nmap',
};
export const deviceName = (device: Device) =>
  device.label ||
  device.hostname ||
  (device.role === 'gateway'
    ? 'Passerelle réseau'
    : device.role === 'self'
      ? 'Cet ordinateur'
      : `Appareil ${device.ip.split('.').at(-1)}`);
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
export const timeOnly = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
export const statusLabel = (device: Device) =>
  device.status === 'observed'
    ? 'Observé'
    : device.status === 'cached'
      ? 'Dans le cache'
      : 'Non revu';
