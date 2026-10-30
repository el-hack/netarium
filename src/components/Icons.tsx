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
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? 'brand-small' : ''}`}>
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <ellipse cx="18" cy="18" rx="16" ry="7" transform="rotate(-38 18 18)" />
        <circle cx="18" cy="18" r="4" />
      </svg>
      <span>
        netarium<span className="brand-dot">.</span>
      </span>
    </span>
  );
}
