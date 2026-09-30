import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { BookMarked, FileText, Loader2, Pill, Search } from "lucide-react";
import { apiGet } from "@/lib/api";
import { CATEGORY_LABEL } from "@/lib/lexicon";
import type { GlobalSearchResults, SearchHit } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SECTIONS: {
  key: "sheets" | "lexicon" | "drugs";
  label: string;
  icon: React.ReactNode;
}[] = [
  { key: "sheets", label: "Fiches de la promo", icon: <FileText className="h-3.5 w-3.5" /> },
  { key: "lexicon", label: "Lexique infirmier", icon: <BookMarked className="h-3.5 w-3.5" /> },
  { key: "drugs", label: "Pharmacologie", icon: <Pill className="h-3.5 w-3.5" /> },
];

// Recherche unique dans les fiches, le lexique et les fiches médicaments.
export default function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [term]);

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: () => apiGet<GlobalSearchResults>(`/search?q=${encodeURIComponent(debounced)}`),
    enabled: open && debounced.length >= 2,
    refetchOnWindowFocus: false,
  });

  const go = (hit: SearchHit) => {
    onOpenChange(false);
    if (hit.kind === "sheet") navigate(`/cours?fiche=${hit.id}`);
    else if (hit.kind === "lexicon") navigate(`/lexique?terme=${encodeURIComponent(hit.title)}`);
    else navigate(`/pharmacologie?cis=${hit.id}`);
  };

  const total =
    (data?.sheets.length ?? 0) + (data?.lexicon.length ?? 0) + (data?.drugs.length ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="global-search-dialog"
        className="flex max-h-[92svh] max-w-xl flex-col overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <Search className="h-5 w-5 text-primary" /> Rechercher partout
          </DialogTitle>
          <DialogDescription>
            Fiches de la promo, lexique de stage et fiches médicaments en une seule recherche.
          </DialogDescription>
        </DialogHeader>

        <Input
          data-testid="global-search-input"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Ex. : diabète, SSPI, amoxicilline…"
          aria-label="Rechercher partout"
          autoFocus
        />

        {debounced.length < 2 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Saisis au moins 2 caractères.
          </p>
        ) : isFetching ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Recherche…
          </div>
        ) : total === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground" data-testid="global-search-empty">
            Aucun résultat pour « {debounced} ».
          </p>
        ) : (
          <div className="flex flex-col gap-4" data-testid="global-search-results">
            {SECTIONS.map((section) => {
              const hits = data?.[section.key] ?? [];
              if (hits.length === 0) return null;
              return (
                <div key={section.key} className="flex flex-col gap-1.5">
                  <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {section.icon} {section.label}
                  </p>
                  {hits.map((hit) => (
                    <button
                      key={`${hit.kind}-${hit.id}`}
                      type="button"
                      data-testid={`global-search-hit-${hit.kind}-${hit.id}`}
                      onClick={() => go(hit)}
                      className="rounded-xl border border-border bg-card p-3 text-left transition-colors duration-200 hover:border-primary/50"
                    >
                      <p className="truncate text-sm font-semibold text-foreground">{hit.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {hit.kind === "lexicon" && hit.category
                          ? `${CATEGORY_LABEL[hit.category] ?? hit.category} · `
                          : ""}
                        {hit.subtitle}
                      </p>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
