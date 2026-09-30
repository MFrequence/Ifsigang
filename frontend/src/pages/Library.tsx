import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Layers, Search } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet } from "@/lib/api";
import { DOMAIN_MAP } from "@/lib/domains";
import type { DomainFilter, DomainKey, Sheet, User } from "@/lib/types";
import AppHeader from "@/components/AppHeader";
import DomainFilterBar from "@/components/DomainFilterBar";
import EmptyState from "@/components/EmptyState";
import FlashcardsDialog from "@/components/FlashcardsDialog";
import ProgressDialog from "@/components/ProgressDialog";
import SheetCard from "@/components/SheetCard";
import SheetPreviewDialog from "@/components/SheetPreviewDialog";
import StudySessionDialog from "@/components/StudySessionDialog";
import UploadSheetDialog from "@/components/UploadSheetDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface LibraryProps {
  user: User;
}

export default function Library({ user }: LibraryProps) {
  const [domain, setDomain] = useState<DomainFilter>("ALL");
  const [unit, setUnit] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSheet, setPreviewSheet] = useState<Sheet | null>(null);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reviseSheet, setReviseSheet] = useState<Sheet | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const queryClient = useQueryClient();

  // One query for the whole library — counts, filtering and search are derived client-side.
  const sheetsQuery = useQuery({
    queryKey: ["sheets"],
    queryFn: () => apiGet<Sheet[]>("/sheets"),
    refetchOnWindowFocus: false,
  });
  const sheets = useMemo(() => sheetsQuery.data ?? [], [sheetsQuery.data]);

  const counts = useMemo(() => {
    const next: Record<DomainFilter, number> = { ALL: sheets.length, A: 0, B: 0, C: 0, D: 0, E: 0 };
    for (const sheet of sheets) {
      next[sheet.domain] = (next[sheet.domain] ?? 0) + 1;
    }
    return next;
  }, [sheets]);

  const units = useMemo(() => {
    if (domain === "ALL") return [];
    const set = new Set(
      sheets.filter((s) => s.domain === domain).map((s) => (s.unit || "").trim()).filter(Boolean),
    );
    return [...set].sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
  }, [sheets, domain]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sheets.filter(
      (sheet) =>
        (domain === "ALL" || sheet.domain === domain) &&
        (!unit || (sheet.unit || "").trim() === unit) &&
        (!q ||
          `${sheet.title} ${sheet.description} ${sheet.author} ${sheet.filename}`
            .toLowerCase()
            .includes(q)),
    );
  }, [sheets, domain, unit, search]);

  const deleteSheet = useMutation({
    mutationFn: (sheet: Sheet) => apiDelete<void>(`/sheets/${sheet.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sheets"] });
      void queryClient.invalidateQueries({ queryKey: ["study-deck"] });
      toast.success("Fiche supprimée");
    },
    onError: () => toast.error("Suppression impossible — réessaie"),
  });

  const openPreview = (sheet: Sheet) => {
    setPreviewSheet(sheet);
    setPreviewOpen(true);
  };

  const openRevise = (sheet: Sheet) => {
    setReviseSheet(sheet);
    setReviseOpen(true);
  };

  // Libellé du bouton de session agrégée, selon la sélection courante.
  const sessionLabel =
    domain === "ALL"
      ? "Réviser toute la bibliothèque"
      : unit
        ? `Réviser l'UE ${unit}`
        : `Réviser tout le ${DOMAIN_MAP[domain].label.toLowerCase()}`;

  return (
    <div className="min-h-svh bg-background">
      <AppHeader
        user={user}
        totalSheets={sheets.length}
        onUploadClick={() => setUploadOpen(true)}
        onProgressClick={() => setProgressOpen(true)}
      />

      <main className="clinical-grid mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-8">
          <Link
            to="/"
            data-testid="back-to-today-link"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Accueil
          </Link>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Les fiches de révision <span className="text-primary">de la promo</span>
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Dépose tes fiches par domaine et UE, révise-les en flashcards ou en QCM, et suis ta
            progression — les cartes ratées reviennent en priorité.
          </p>
        </section>

        <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-border bg-card/70 backdrop-blur-md p-4 shadow-sm md:flex-row md:items-start md:justify-between">
          <DomainFilterBar
            active={domain}
            counts={counts}
            onSelect={(value) => {
              setDomain(value);
              setUnit(null);
            }}
            units={units}
            activeUnit={unit}
            onUnitSelect={setUnit}
          />
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:items-start">
            <div className="relative md:w-64">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
                aria-hidden
              />
              <Input
                data-testid="sheet-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une fiche…"
                aria-label="Rechercher une fiche"
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              data-testid="start-session-button"
              onClick={() => setSessionOpen(true)}
              title={sessionLabel}
              aria-label={sessionLabel}
              className="shrink-0 transition-transform duration-75 active:scale-[0.98]"
            >
              <Layers className="h-4 w-4" /> Réviser la sélection
            </Button>
          </div>
        </div>

        {sheetsQuery.isError ? (
          <Card className="flex flex-col items-center gap-3 border-border p-10 text-center">
            <p className="font-heading text-lg font-semibold text-foreground">
              Impossible de charger les fiches
            </p>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Vérifie ta connexion et réessaie — le reste de la page reste disponible.
            </p>
            <Button variant="outline" onClick={() => void sheetsQuery.refetch()}>
              Réessayer
            </Button>
          </Card>
        ) : sheetsQuery.isPending ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="h-48 animate-pulse border-border bg-card p-5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={
              search.trim()
                ? "Aucune fiche ne correspond à ta recherche"
                : unit
                  ? "Aucune fiche dans cette UE"
                  : "Aucune fiche dans cette sélection"
            }
            hint={
              search.trim()
                ? "Essaie un autre mot-clé, ou dépose la fiche qu'il te manque."
                : "Sois le premier à partager tes révisions avec la promo."
            }
            ctaLabel="Déposer une fiche"
            onCta={() => setUploadOpen(true)}
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((sheet) => (
              <SheetCard
                key={sheet.id}
                sheet={sheet}
                onPreview={openPreview}
                onRevise={openRevise}
                onDelete={(s) => deleteSheet.mutate(s)}
                deleting={deleteSheet.isPending && deleteSheet.variables?.id === sheet.id}
              />
            ))}
          </div>
        )}
      </main>

      <UploadSheetDialog open={uploadOpen} onOpenChange={setUploadOpen} sheets={sheets} />
      <SheetPreviewDialog sheet={previewSheet} open={previewOpen} onOpenChange={setPreviewOpen} />
      <FlashcardsDialog sheet={reviseSheet} open={reviseOpen} onOpenChange={setReviseOpen} />
      <StudySessionDialog
        domain={domain === "ALL" ? null : (domain as DomainKey)}
        unit={unit}
        open={sessionOpen}
        onOpenChange={setSessionOpen}
      />
      <ProgressDialog open={progressOpen} onOpenChange={setProgressOpen} />
    </div>
  );
}
