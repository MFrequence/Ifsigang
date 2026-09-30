export type Theme = "dark" | "light";

const STORAGE_KEY = "ifsi-theme-preference";

export function storedTheme(): Theme {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === "light" || raw === "dark" ? raw : "dark"; // sombre par défaut
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(STORAGE_KEY, theme);
}
