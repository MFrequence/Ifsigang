import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Eye,
  Loader2,
  Pill,
  Search,
  Star,
  Stethoscope,
  Syringe,
} from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { DrugCard, DrugFavorite, DrugSearchResult, Sheet, User } from "@/lib/types";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PharmacoProps {
  user: User;
}

function CardBlock({
  title,
  icon,
  items,
  tone,
  testId,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  tone: string;
  testId: string;
}) {
  if (items.length === 0) return null;
  return (
    <div data-testid={testId} className="rounded-xl border border-border bg-card p-4">
      <p className={`flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider ${tone}`}>
        {icon} {title}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-relaxed text-foreground">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Pharmacologie : recherche dans la base publique des médicaments (ANSM) puis fiche
// de révision infirmière synthétisée depuis le RCP officiel (mise en cache côté serveur).
export default function Pharmaco({ user }: PharmacoProps) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [openCis, setOpenCis] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const sheetsQuery = useQuery({
    queryKey: ["sheets"],
    queryFn: () => apiGet<Sheet[]>("/sheets"),
    refetchOnWindowFocus: false,
  });
  const savedQuery = useQuery({
    queryKey: ["drug-cards"],
    queryFn: () => apiGet<DrugCard[]>("/pharmaco/cards"),
    refetchOnWindowFocus: false,
  });
  const favoritesQuery = useQuery({
    queryKey: ["drug-favorites"],
    queryFn: () => apiGet<DrugFavorite[]>("/pharmaco/favorites"),
    refetchOnWindowFocus: false,
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ cis, pinned }: { cis: string; pinned: boolean }) =>
      pinned
        ? apiDelete<void>(`/pharmaco/favorites/${cis}`)
        : apiPost<DrugFavorite>(`/pharmaco/favorites/${cis}`, {}),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["drug-favorites"] });
      void queryClient.invalidateQueries({ queryKey: ["drug-cards"] });
      toast.success(variables.pinned ? "Retiré de mes médicaments" : "Épinglé à mon stage");
    },
    onError: () => toast.error("Action impossible — réessaie"),
  });

  const searchQuery = useQuery({
    queryKey: ["pharmaco-search", submitted],
    queryFn: () => apiGet<DrugSearchResult[]>(`/pharmaco/search?q=${encodeURIComponent(submitted)}`),
    enabled: submitted.trim().length >= 3,
    refetchOnWindowFocus: false,
  });

  const cardQuery = useQuery({
    queryKey: ["drug-card", openCis],
    queryFn: () => apiGet<DrugCard>(`/pharmaco/cards/${openCis}`),
    enabled: Boolean(openCis),
    retry: false,
    staleTime: Infinity,
  });

  const loadCard = useMutation({
    mutationFn: async (cis: string) => {
      setOpenCis(cis);
      return cis;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["drug-cards"] });
    },
  });

  // Après un clic sur un résultat, on amène l'étudiant directement sur la fiche.
  useEffect(() => {
    if (!openCis) return;
    const timer = window.setTimeout(() => {
      document.getElementById("pharmaco-card-anchor")?.scrollIntoView({ behavior: "smooth" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [openCis]);

  const card = cardQuery.data;
  const saved = savedQuery.data ?? [];
  const favorites = favoritesQuery.data ?? [];
  const pinnedCis = new Set(favorites.map((f) => f.cis));

  return (
    <div className="min-h-svh bg-background">
      <AppHeader user={user} totalSheets={(sheetsQuery.data ?? []).length} />

      <main className="clinical-grid mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          to="/"
          data-testid="pharmaco-back-link"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Accueil
        </Link>
        <h1 className="flex items-center gap-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          <Pill className="h-7 w-7 text-primary" /> Pharmacologie
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Cherche un médicament : la fiche est construite à partir du RCP officiel de la base
          publique des médicaments (ANSM), avec indications, posologies, effets indésirables,
          contre-indications et surveillance infirmière.
        </p>
        <p
          data-testid="pharmaco-disclaimer"
          className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-700 dark:text-amber-300"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Synthèse pédagogique générée automatiquement depuis le RCP ANSM. Elle ne remplace ni le
          RCP officiel, ni la prescription, ni le protocole du service.
        </p>

        <form
          className="mt-8 flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim().length < 3) {
              toast.error("Saisis au moins 3 caractères");
              return;
            }
            setOpenCis(null);
            setSubmitted(query.trim());
          }}
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
              aria-hidden
            />
            <Input
              data-testid="pharmaco-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex. : paracétamol, amoxicilline, enoxaparine…"
              aria-label="Rechercher un médicament"
              className="pl-9"
            />
          </div>
          <Button type="submit" data-testid="pharmaco-search-button">
            Rechercher
          </Button>
        </form>

        {searchQuery.isFetching ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Recherche dans la base ANSM…
          </div>
        ) : submitted && (searchQuery.data ?? []).length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground" data-testid="pharmaco-no-result">
            Aucun médicament trouvé pour « {submitted} ».
          </p>
        ) : (searchQuery.data ?? []).length > 0 ? (
          <div className="mt-6 flex flex-col gap-2" data-testid="pharmaco-results">
            {(searchQuery.data ?? []).map((result) => (
              <button
                key={result.cis}
                type="button"
                data-testid={`pharmaco-result-${result.cis}`}
                onClick={() => loadCard.mutate(result.cis)}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors duration-200 hover:border-primary/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-heading text-sm font-bold text-foreground">
                    {result.label}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {result.substances.join(" + ") || result.form}
                    {result.holder ? ` · ${result.holder}` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-primary">
                  {result.cached ? "fiche prête" : "générer la fiche"}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {openCis ? (
          <section id="pharmaco-card-anchor" className="mt-8 scroll-mt-24" data-testid="pharmaco-card">
            {cardQuery.isPending ? (
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Lecture du RCP et mise en fiche…
                (10 à 20 secondes la première fois)
              </div>
            ) : cardQuery.isError ? (
              <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-foreground">
                Pas de synthèse disponible pour ce médicament — essaie une autre présentation.
              </p>
            ) : card ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                      {card.drug_class || "Classe non précisée"}
                    </p>
                    <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight text-foreground">
                      {card.label}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      DCI : {card.dci || "non précisée"} · CIS {card.cis}
                    </p>
                  </div>
                  <Button
                    variant={pinnedCis.has(card.cis) ? "default" : "outline"}
                    size="sm"
                    data-testid="pharmaco-pin-button"
                    disabled={toggleFavorite.isPending}
                    onClick={() =>
                      toggleFavorite.mutate({ cis: card.cis, pinned: pinnedCis.has(card.cis) })
                    }
                    className="shrink-0"
                  >
                    <Star
                      className={`h-4 w-4 ${pinnedCis.has(card.cis) ? "fill-current" : ""}`}
                    />
                    {pinnedCis.has(card.cis) ? "Épinglé" : "Épingler à mon stage"}
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <CardBlock
                    testId="pharmaco-indications"
                    title="Indications"
                    icon={<Stethoscope className="h-3.5 w-3.5" />}
                    items={card.indications}
                    tone="text-primary"
                  />
                  <CardBlock
                    testId="pharmaco-dosage"
                    title="Posologie usuelle"
                    icon={<Syringe className="h-3.5 w-3.5" />}
                    items={card.dosage}
                    tone="text-sky-600 dark:text-sky-400"
                  />
                  <CardBlock
                    testId="pharmaco-side-effects"
                    title="Effets indésirables"
                    icon={<AlertTriangle className="h-3.5 w-3.5" />}
                    items={card.side_effects}
                    tone="text-amber-600 dark:text-amber-400"
                  />
                  <CardBlock
                    testId="pharmaco-contraindications"
                    title="Contre-indications"
                    icon={<Ban className="h-3.5 w-3.5" />}
                    items={card.contraindications}
                    tone="text-destructive"
                  />
                  <CardBlock
                    testId="pharmaco-nursing-watch"
                    title="Surveillance IDE"
                    icon={<Eye className="h-3.5 w-3.5" />}
                    items={card.nursing_watch}
                    tone="text-teal-600 dark:text-teal-400"
                  />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  Source : {card.source}
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        {favorites.length > 0 && !openCis ? (
          <section className="mt-10">
            <h2 className="flex items-center gap-2 font-heading text-xl font-bold tracking-tight text-foreground">
              <Star className="h-5 w-5 fill-current text-amber-500" /> Les médicaments de mon stage
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="pharmaco-favorites-grid">
              {favorites.map((item) => (
                <div
                  key={item.cis}
                  data-testid={`pharmaco-favorite-${item.cis}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4"
                >
                  <button
                    type="button"
                    data-testid={`pharmaco-favorite-open-${item.cis}`}
                    onClick={() => setOpenCis(item.cis)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate font-heading text-sm font-bold text-foreground">
                      {item.label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.dci || "—"} · {item.drug_class || "classe non précisée"}
                    </p>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Retirer de mes médicaments"
                    data-testid={`pharmaco-unpin-${item.cis}`}
                    disabled={toggleFavorite.isPending}
                    onClick={() => toggleFavorite.mutate({ cis: item.cis, pinned: true })}
                    className="text-amber-600 dark:text-amber-400"
                  >
                    <Star className="h-4 w-4 fill-current" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {saved.length > 0 && !openCis ? (
          <section className="mt-10">
            <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
              Fiches déjà préparées par la promo
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="pharmaco-saved-grid">
              {saved.map((item) => (
                <button
                  key={item.cis}
                  type="button"
                  data-testid={`pharmaco-saved-${item.cis}`}
                  onClick={() => setOpenCis(item.cis)}
                  className="rounded-xl border border-border bg-card p-4 text-left transition-colors duration-200 hover:border-primary/50"
                >
                  <p className="truncate font-heading text-sm font-bold text-foreground">
                    {item.label}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.dci || "—"} · {item.drug_class || "classe non précisée"}
                  </p>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
