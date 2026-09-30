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
export const DOMAINS: DomainInfo[] = [
  {
    key: "A",
    label: "Domaine A",
    description: "Sciences humaines, sociales et droit",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
    chipActive: "bg-emerald-700 text-white shadow-sm",
    dot: "bg-emerald-600",
    borderAccent: "border-l-emerald-600",
  },
  {
    key: "B",
    label: "Domaine B",
    description: "Sciences biologiques et médicales",
    badge: "bg-blue-50 text-blue-800 border-blue-200",
    chipActive: "bg-blue-700 text-white shadow-sm",
    dot: "bg-blue-600",
    borderAccent: "border-l-blue-600",
  },
  {
    key: "C",
    label: "Domaine C",
    description: "Sciences et techniques infirmières : fondements",
    badge: "bg-amber-50 text-amber-900 border-amber-200",
    chipActive: "bg-amber-700 text-white shadow-sm",
    dot: "bg-amber-600",
    borderAccent: "border-l-amber-600",
  },
  {
    key: "D",
    label: "Domaine D",
    description: "Sciences et techniques infirmières : interventions",
    badge: "bg-purple-50 text-purple-900 border-purple-200",
    chipActive: "bg-purple-700 text-white shadow-sm",
    dot: "bg-purple-600",
    borderAccent: "border-l-purple-600",
  },
  {
    key: "E",
    label: "Domaine E",
    description: "Intégration des savoirs et posture professionnelle",
    badge: "bg-rose-50 text-rose-900 border-rose-200",
    chipActive: "bg-rose-700 text-white shadow-sm",
    dot: "bg-rose-600",
    borderAccent: "border-l-rose-600",
  },
];

export const DOMAIN_MAP: Record<DomainKey, DomainInfo> = Object.fromEntries(
  DOMAINS.map((d) => [d.key, d]),
) as Record<DomainKey, DomainInfo>;
