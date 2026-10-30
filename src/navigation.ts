import { Orbit, LayoutGrid, Clock3, Settings2 } from 'lucide-react';
export type Page = 'overview' | 'devices' | 'history' | 'settings';
export const navigation = [
  { id: 'overview', label: 'Observatoire', icon: Orbit },
  { id: 'devices', label: 'Appareils', icon: LayoutGrid },
  { id: 'history', label: 'Chronologie', icon: Clock3 },
  { id: 'settings', label: 'Réglages', icon: Settings2 },
] as const;
