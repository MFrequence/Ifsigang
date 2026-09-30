import type { DomainKey } from "@/lib/types";

export interface DomainInfo {
  key: DomainKey;
  label: string;
  description: string;
  badge: string;
  chipActive: string;
  dot: string;
  borderAccent: string;
}

// Mirror of backend/models/sheet.py DOMAINS — keep the two in sync by hand.
// Les classes couleur restent lisibles en thème clair ET sombre (teintes /15 + texte 700/300).
export const DOMAINS: DomainInfo[] = [
  {
    key: "A",
    label: "Domaine A",
    description: "Sciences humaines, sociales et droit",
    badge: "bg-emerald-500/12 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
    chipActive: "bg-emerald-600 text-white shadow-sm dark:bg-emerald-500 dark:text-emerald-950",
    dot: "bg-emerald-500",
    borderAccent: "border-l-emerald-500",
  },
  {
    key: "B",
    label: "Domaine B",
    description: "Sciences biologiques et médicales",
    badge: "bg-sky-500/12 text-sky-700 border-sky-500/30 dark:text-sky-300",
    chipActive: "bg-sky-600 text-white shadow-sm dark:bg-sky-500 dark:text-sky-950",
    dot: "bg-sky-500",
    borderAccent: "border-l-sky-500",
  },
  {
    key: "C",
    label: "Domaine C",
    description: "Sciences et techniques infirmières : fondements",
    badge: "bg-amber-500/14 text-amber-800 border-amber-500/30 dark:text-amber-300",
    chipActive: "bg-amber-600 text-white shadow-sm dark:bg-amber-500 dark:text-amber-950",
    dot: "bg-amber-500",
    borderAccent: "border-l-amber-500",
  },
  {
    key: "D",
    label: "Domaine D",
    description: "Sciences et techniques infirmières : interventions",
    badge: "bg-violet-500/12 text-violet-700 border-violet-500/30 dark:text-violet-300",
    chipActive: "bg-violet-600 text-white shadow-sm dark:bg-violet-500 dark:text-violet-950",
    dot: "bg-violet-500",
    borderAccent: "border-l-violet-500",
  },
  {
    key: "E",
    label: "Domaine E",
    description: "Intégration des savoirs et posture professionnelle",
    badge: "bg-rose-500/12 text-rose-700 border-rose-500/30 dark:text-rose-300",
    chipActive: "bg-rose-600 text-white shadow-sm dark:bg-rose-500 dark:text-rose-950",
    dot: "bg-rose-500",
    borderAccent: "border-l-rose-500",
  },
];

export const DOMAIN_MAP: Record<DomainKey, DomainInfo> = Object.fromEntries(
  DOMAINS.map((d) => [d.key, d]),
) as Record<DomainKey, DomainInfo>;
