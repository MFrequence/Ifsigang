import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, BookMarked, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { CATEGORY_LABEL, LEXICON_CATEGORIES } from "@/lib/lexicon";
import type { LexiconEntry, Sheet, User } from "@/lib/types";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface LexiqueProps {
  user: User;
}

// Lexique infirmier : abréviations et termes de terrain, classés par lieu de stage.
// Base fournie avec la plateforme + ajouts de la promo.
export default function Lexique({ user }: LexiqueProps) {
  const [category, setCategory] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const queryClient = useQueryClient();

  const entriesQuery = useQuery({
    queryKey: ["lexicon"],
    queryFn: () => apiGet<LexiconEntry[]>("/lexicon"),
    refetchOnWindowFocus: false,
  });
  const sheetsQuery = useQuery({
    queryKey: ["sheets"],
    queryFn: () => apiGet<Sheet[]>("/sheets"),
    refetchOnWindowFocus: false,
  });

  const entries = entriesQuery.data ?? [];

  const counts = useMemo(() => {
    const next: Record<string, number> = { ALL: entries.length };
    for (const entry of entries) next[entry.category] = (next[entry.category] ?? 0) + 1;
    return next;
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter(
      (entry) =>
        (category === "ALL" || entry.category === category) &&
        (!q || `${entry.term} ${entry.definition}`.toLowerCase().includes(q)),
    );
  }, [entries, category, search]);

  const addEntry = useMutation({
    mutationFn: () =>
      apiPost<LexiconEntry>("/lexicon", {
        term,
        definition,
        category: newCategory,
      }),
    onSuccess: () => {
      setTerm("");
      setDefinition("");
      setAddOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["lexicon"] });
      toast.success("Terme ajouté au lexique de la promo");
    },
    onError: () => toast.error("Ajout impossible — ce terme existe peut-être déjà"),
  });

  const removeEntry = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/lexicon/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lexicon"] });
      toast.success("Terme retiré");
    },
    onError: () => toast.error("Suppression impossible"),
  });

  return (
    <div className="min-h-svh bg-background">
      <AppHeader user={user} totalSheets={(sheetsQuery.data ?? []).length} />

      <main className="clinical-grid mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          to="/"
          data-testid="lexique-back-link"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Accueil
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              <BookMarked className="h-7 w-7 text-primary" /> Lexique infirmier
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Les abréviations et le vocabulaire qu'on entend en stage, classés par service.
              Ajoute ce que tu découvres : la promo en profite.
            </p>
          </div>
          <Button data-testid="lexicon-add-button" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Ajouter un terme
          </Button>
        </div>

        <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-border bg-card/70 p-4 backdrop-blur-md shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
            {[{ key: "ALL", label: "Tous", accent: "bg-foreground" }, ...LEXICON_CATEGORIES].map(
              (item) => {
                const active = category === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    data-testid={`lexicon-category-${item.key.toLowerCase()}`}
                    onClick={() => setCategory(item.key)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors duration-200",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/50",
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", item.accent)} aria-hidden />
                    {item.label}
                    <span className="font-mono text-xs opacity-70">{counts[item.key] ?? 0}</span>
                  </button>
                );
              },
            )}
          </div>
          <div className="relative md:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
              aria-hidden
            />
            <Input
              data-testid="lexicon-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un terme…"
              aria-label="Rechercher un terme"
              className="pl-9"
            />
          </div>
        </div>

        {entriesQuery.isPending ? (
          <div className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Chargement du lexique…
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-sm text-muted-foreground" data-testid="lexicon-empty">
            Aucun terme ne correspond — ajoute-le, il servira à toute la promo.
          </p>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2" data-testid="lexicon-list">
            {filtered.map((entry) => (
              <div
                key={entry.id}
                data-testid={`lexicon-entry-${entry.id}`}
                className="group flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors duration-200 hover:border-primary/40"
              >
                <div className="min-w-0">
                  <p className="font-heading text-base font-bold text-foreground">{entry.term}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {entry.definition}
                  </p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    {CATEGORY_LABEL[entry.category] ?? entry.category}
                    {entry.author_name ? ` · ajouté par ${entry.author_name}` : " · base IFSI"}
                  </p>
                </div>
                {entry.editable ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Supprimer ce terme"
                    data-testid={`lexicon-delete-${entry.id}`}
                    disabled={removeEntry.isPending}
                    onClick={() => removeEntry.mutate(entry.id)}
                    className="text-muted-foreground/70 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent
          data-testid="lexicon-add-dialog"
          className="flex max-h-[92svh] max-w-md flex-col overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="pr-8">Ajouter un terme au lexique</DialogTitle>
            <DialogDescription>
              Une abréviation ou un mot entendu en stage, expliqué simplement.
            </DialogDescription>
          </DialogHeader>

          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              addEntry.mutate();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="lexicon-term">Terme ou abréviation</Label>
              <Input
                id="lexicon-term"
                data-testid="lexicon-term-input"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                maxLength={80}
                placeholder="Ex. : SSPI"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lexicon-definition">Définition</Label>
              <Textarea
                id="lexicon-definition"
                data-testid="lexicon-definition-input"
                value={definition}
                onChange={(e) => setDefinition(e.target.value)}
                maxLength={600}
                rows={3}
                placeholder="Salle de surveillance post-interventionnelle…"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lexicon-category">Lieu de stage</Label>
              <select
                id="lexicon-category"
                data-testid="lexicon-category-select"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground"
              >
                {LEXICON_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="submit"
              data-testid="lexicon-submit-button"
              disabled={addEntry.isPending || !term.trim() || definition.trim().length < 2}
            >
              {addEntry.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Ajout…
                </>
              ) : (
                "Ajouter au lexique"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
