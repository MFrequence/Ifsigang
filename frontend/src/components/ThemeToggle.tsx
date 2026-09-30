import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, storedTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

// Bascule Jour / Nuit en capsule segmentée. Le choix est mémorisé (localStorage).
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => storedTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const segment = (value: Theme, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      data-testid={`theme-toggle-${value}`}
      aria-pressed={theme === value}
      onClick={() => setTheme(value)}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors duration-200",
        theme === value
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
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
