import {
  LayoutDashboard,
  Orbit,
  Activity,
  Laptop,
  ChartNoAxesCombined,
  History,
  ShieldCheck,
  Database,
  Settings2,
} from 'lucide-react';
export type Page =
  | 'overview'
  | 'network'
  | 'activity'
  | 'devices'
  | 'traffic'
  | 'history'
  | 'security'
  | 'sources'
  | 'settings';
export const navigation = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    description: 'Une lecture précise de votre réseau.',
  },
  {
    id: 'network',
    label: 'Network Explorer',
    icon: Orbit,
    description: 'Les appareils et leurs relations observées.',
  },
  {
    id: 'activity',
    label: 'Activity Explorer',
    icon: Activity,
    description: 'De l’observation à la compréhension.',
  },
  {
    id: 'devices',
    label: 'Devices',
    icon: Laptop,
    description: 'L’inventaire durable de votre réseau.',
  },
  {
    id: 'traffic',
    label: 'Traffic Analytics',
    icon: ChartNoAxesCombined,
    description: 'Des mesures, avec leur périmètre.',
  },
  {
    id: 'history',
    label: 'Network Timeline',
    icon: History,
    description: 'Les changements conservés, dans leur contexte.',
  },
  {
    id: 'security',
    label: 'Security & Alerts',
    icon: ShieldCheck,
    description: 'Des événements à examiner, jamais des verdicts.',
  },
  {
    id: 'sources',
    label: 'Data Sources',
    icon: Database,
    description: 'Comprendre exactement ce que vous pouvez voir.',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings2,
    description: 'Votre espace local, sous votre contrôle.',
  },
] as const;
