import { effectiveCategory } from '../../shared/identification';
import {
  Monitor,
  Smartphone,
  Tablet,
  Printer,
  Router,
  HardDrive,
  Tv,
  Lightbulb,
  CircleHelp,
} from 'lucide-react';
import type { Device } from '../../shared/types';
export function DeviceIcon({
  device,
  size = 18,
}: {
  device: Pick<Device, 'category' | 'identification'>;
  size?: number;
}) {
  const icons = {
    computer: Monitor,
    phone: Smartphone,
    tablet: Tablet,
    printer: Printer,
    network: Router,
    storage: HardDrive,
    media: Tv,
    iot: Lightbulb,
    unknown: CircleHelp,
  };
  const Icon = icons[effectiveCategory(device)];
  return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />;
}
