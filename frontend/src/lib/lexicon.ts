// Mirror of LEXICON_CATEGORIES in backend/models/reference.py — keep in sync by hand.
export const LEXICON_CATEGORIES: { key: string; label: string; accent: string }[] = [
  { key: "general", label: "Transversal", accent: "bg-primary" },
  { key: "medecine", label: "Médecine", accent: "bg-sky-500" },
  { key: "chirurgie", label: "Chirurgie / Bloc", accent: "bg-violet-500" },
  { key: "urgences", label: "Urgences / Réa", accent: "bg-rose-500" },
  { key: "psychiatrie", label: "Psychiatrie", accent: "bg-amber-500" },
  { key: "ehpad", label: "EHPAD / Gériatrie", accent: "bg-teal-500" },
  { key: "pediatrie", label: "Pédiatrie / Maternité", accent: "bg-fuchsia-500" },
];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  LEXICON_CATEGORIES.map((c) => [c.key, c.label]),
);
