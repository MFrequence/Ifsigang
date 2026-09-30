import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "d MMM yyyy", { locale: fr });
}

export function isPreviewable(mime: string): boolean {
  return mime === "application/pdf" || mime.startsWith("image/");
}
