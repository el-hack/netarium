import type { Device } from '../shared/types';
import { categoryLabels, deviceName } from './lib';
export type DeviceFilter = 'all' | Device['status'];
export type DeviceSort = 'name' | 'ip' | 'recent';
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr');
export function selectDevices(
  devices: Device[],
  options: { query: string; status: DeviceFilter; sort: DeviceSort },
) {
  const query = normalize(options.query.trim());
  const filtered = devices.filter(
    (device) =>
      (options.status === 'all' || device.status === options.status) &&
      normalize(
        `${deviceName(device)} ${device.ip} ${device.mac ?? ''} ${categoryLabels[device.category]}`,
      ).includes(query),
  );
  return filtered.sort((a, b) => {
    if (options.sort === 'ip') return a.ip.localeCompare(b.ip, 'en', { numeric: true });
    if (options.sort === 'recent')
      return (
        b.lastSeen.localeCompare(a.lastSeen) || deviceName(a).localeCompare(deviceName(b), 'fr')
      );
    return deviceName(a).localeCompare(deviceName(b), 'fr', { numeric: true });
  });
}
