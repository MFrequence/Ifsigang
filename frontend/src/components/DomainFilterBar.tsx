import { DOMAINS } from "@/lib/domains";
import type { DomainFilter } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DomainFilterBarProps {
  active: DomainFilter;
  counts: Record<DomainFilter, number>;
  onSelect: (value: DomainFilter) => void;
}

export default function DomainFilterBar({ active, counts, onSelect }: DomainFilterBarProps) {
  const items: { key: DomainFilter; label: string; dot: string; activeChip: string }[] = [
    { key: "ALL", label: "Tous", dot: "bg-sky-600", activeChip: "bg-sky-700 text-white shadow-sm" },
    ...DOMAINS.map((d) => ({
      key: d.key as DomainFilter,
      label: d.label,
      dot: d.dot,
      activeChip: d.chipActive,
    })),
  ];

  return (
    <div
      role="tablist"
      aria-label="Filtrer par domaine"
      className="scrollbar-none flex gap-2 overflow-x-auto pb-1"
    >
      {items.map((item) => {
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={`domain-tab-${item.key.toLowerCase()}`}
            onClick={() => onSelect(item.key)}
            className={cn(
              "inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors duration-200 sm:min-h-[36px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
              isActive
                ? cn(item.activeChip, "border-transparent")
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            <span
              className={cn("h-2 w-2 rounded-full", isActive ? "bg-white/80" : item.dot)}
              aria-hidden
            />
            {item.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs",
                isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500",
              )}
            >
              {counts[item.key] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
