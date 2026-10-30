import type { Device } from '../shared/types';
import { deviceTypeLabel, deviceName } from './lib';
import { normalizeSearch as normalize } from './search';
export type DeviceFilter = 'all' | Device['status'];
export type DeviceSort = 'name' | 'ip' | 'recent';
export function selectDevices(
  devices: Device[],
  options: { query: string; status: DeviceFilter; sort: DeviceSort },
) {
  const query = normalize(options.query.trim());
  const filtered = devices.filter(
    (device) =>
      (options.status === 'all' || device.status === options.status) &&
      normalize(
        `${deviceName(device)} ${device.ip} ${device.mac ?? ''} ${deviceTypeLabel(device)} ${(device.tags ?? []).join(' ')}`,
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
