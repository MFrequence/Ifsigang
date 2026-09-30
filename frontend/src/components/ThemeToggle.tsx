import { Moon, Sun } from "lucide-react";
import type { Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  theme: Theme;
  onChange: (theme: Theme) => void;
}

// Bascule Jour / Nuit en capsule segmentée. L'état vit dans AppHeader (voir lib/theme.ts).
export default function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  const segment = (value: Theme, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      data-testid={`theme-toggle-${value}`}
      aria-pressed={theme === value}
      onClick={() => onChange(value)}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors duration-200",
        theme === value
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      <span className="hidden 2xl:inline">{label}</span>
    </button>
  );

  return (
    <div
      data-testid="theme-toggle-button"
      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-secondary/70 p-1"
    >
      {segment("light", "Jour", <Sun className="h-3.5 w-3.5" />)}
      {segment("dark", "Nuit", <Moon className="h-3.5 w-3.5" />)}
    </div>
  );
}
