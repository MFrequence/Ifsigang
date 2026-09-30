import { DOMAINS } from "@/lib/domains";
import type { DomainFilter } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DomainFilterBarProps {
  active: DomainFilter;
  counts: Record<DomainFilter, number>;
  onSelect: (value: DomainFilter) => void;
  units: string[];
  activeUnit: string | null;
  onUnitSelect: (unit: string | null) => void;
}

const chipBase =
  "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function DomainFilterBar({
  active,
  counts,
  onSelect,
  units,
  activeUnit,
  onUnitSelect,
}: DomainFilterBarProps) {
  const items: { key: DomainFilter; label: string; dot: string; activeChip: string }[] = [
    { key: "ALL", label: "Tous", dot: "bg-primary", activeChip: "bg-primary text-white shadow-sm" },
    ...DOMAINS.map((d) => ({
      key: d.key as DomainFilter,
      label: d.label,
      dot: d.dot,
      activeChip: d.chipActive,
    })),
  ];

  return (
    <div className="flex min-w-0 flex-col gap-2">
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
                chipBase,
                "min-h-[44px] sm:min-h-[36px]",
                isActive
                  ? cn(item.activeChip, "border-transparent")
                  : "border-border bg-card text-muted-foreground hover:border-border hover:bg-secondary",
              )}
            >
              <span
                className={cn("h-2 w-2 rounded-full", isActive ? "bg-card/80" : item.dot)}
                aria-hidden
              />
              {item.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs",
                  isActive ? "bg-card/20 text-white" : "bg-secondary text-muted-foreground",
                )}
              >
                {counts[item.key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {active !== "ALL" && units.length > 0 && (
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1 pl-1" aria-label="Filtrer par UE">
          <button
            type="button"
            data-testid="unit-tab-all"
            onClick={() => onUnitSelect(null)}
            className={cn(
              chipBase,
              "min-h-[34px] px-3 text-xs",
              activeUnit === null
                ? "border-transparent bg-primary text-white shadow-sm"
                : "border-border bg-card text-muted-foreground hover:bg-secondary",
            )}
          >
            Toutes les UE
          </button>
          {units.map((u) => (
            <button
              key={u}
              type="button"
              data-testid={`unit-tab-${u}`}
              onClick={() => onUnitSelect(u)}
              className={cn(
                chipBase,
                "min-h-[34px] px-3 text-xs",
                activeUnit === u
                  ? "border-transparent bg-primary text-white shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary",
              )}
            >
              {u}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
