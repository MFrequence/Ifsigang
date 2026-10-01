import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import type { AdminStatus, Disease, DiseaseSummary, Sheet, User } from "@/lib/types";
import AppHeader from "@/components/AppHeader";
import ProgressDialog from "@/components/ProgressDialog";
import UploadSheetDialog from "@/components/UploadSheetDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

interface PathologiesProps {
  user: User;
}

const SECTIONS: { key: keyof Disease; label: string }[] = [
  { key: "causes", label: "Causes et facteurs de risque" },
  { key: "symptoms", label: "Signes et symptômes" },
  { key: "exams", label: "Examens" },
  { key: "treatments", label: "Traitements" },
  { key: "side_effects", label: "Effets indésirables des traitements" },
  { key: "nursing_role", label: "Rôle infirmier et surveillance" },
  { key: "key_points", label: "Points clés d'examen" },
];

export default function Pathologies({ user }: PathologiesProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("ALL");
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<Record<string, string> | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const queryClient = useQueryClient();

  const sheetsQuery = useQuery({
    queryKey: ["sheets"],
    queryFn: () => apiGet<Sheet[]>("/sheets"),
    refetchOnWindowFocus: false,
  });

  const categoriesQuery = useQuery({
    queryKey: ["disease-categories"],
    queryFn: () => apiGet<Record<string, string>>("/diseases/categories"),
    refetchOnWindowFocus: false,
  });

  const listQuery = useQuery({
    queryKey: ["diseases"],
    queryFn: () => apiGet<DiseaseSummary[]>("/diseases"),
    refetchOnWindowFocus: false,
  });

  // L'édition est réservée à une session admin déverrouillée (/admin).
  const adminQuery = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => apiGet<AdminStatus>("/admin/status"),
    refetchOnWindowFocus: false,
  });
  const isAdmin = adminQuery.data?.is_admin === true;

  const detailQuery = useQuery({
    queryKey: ["disease", openSlug],
    queryFn: () => apiGet<Disease>(`/diseases/${openSlug}`),
    enabled: openSlug !== null,
    retry: false,
  });

  const createDisease = useMutation({
    mutationFn: () => apiPost<Disease>("/diseases", { name: newName.trim() }),
    onSuccess: (disease) => {
      setNewName("");
      void queryClient.invalidateQueries({ queryKey: ["diseases"] });
      setOpenSlug(disease.slug);
      toast.success(`Fiche « ${disease.name} » ajoutée au catalogue`);
    },
    onError: () => toast.error("Génération impossible pour le moment — réessaie"),
  });

  const saveDisease = useMutation({
    mutationFn: (payload: Record<string, string | string[]>) =>
      apiPut<Disease>(`/diseases/${openSlug}`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["disease", openSlug] });
      void queryClient.invalidateQueries({ queryKey: ["diseases"] });
      setEditing(null);
      toast.success("Fiche mise à jour");
    },
    onError: () => toast.error("Enregistrement impossible — déverrouille l'espace admin"),
  });

  const categories = categoriesQuery.data ?? {};
  const diseases = listQuery.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return diseases.filter(
      (disease) =>
        (category === "ALL" || disease.category === category) &&
        (q === "" ||
          disease.name.toLowerCase().includes(q) ||
          disease.definition.toLowerCase().includes(q)),
    );
  }, [diseases, category, search]);

  const detail = detailQuery.data;

  const startEditing = () => {
    if (!detail) return;
    setEditing({
      definition: detail.definition,
      incubation: detail.incubation,
      ...Object.fromEntries(
        SECTIONS.map((section) => [
          section.key as string,
          (detail[section.key] as string[]).join("\n"),
        ]),
      ),
    });
  };

  const submitEditing = () => {
    if (!editing) return;
    const payload: Record<string, string | string[]> = {
      definition: editing.definition ?? "",
      incubation: editing.incubation ?? "",
    };
    for (const section of SECTIONS) {
      payload[section.key as string] = (editing[section.key as string] ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    }
    saveDisease.mutate(payload);
  };

  return (
    <div className="min-h-svh bg-background">
      <AppHeader
        user={user}
        totalSheets={sheetsQuery.data?.length ?? 0}
        onUploadClick={() => setUploadOpen(true)}
        onProgressClick={() => setProgressOpen(true)}
      />

      <main className="clinical-grid mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-8">
          <Link
            to="/"
            data-testid="back-to-today-link"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Accueil
          </Link>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            <Stethoscope className="mb-1 mr-2 inline h-7 w-7 text-primary" />
            Pathologies <span className="text-primary">du programme</span>
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Définition, causes, symptômes, incubation ou évolution, examens, traitements et leurs
            effets indésirables, rôle infirmier et points clés d'examen. Une pathologie absente ?
            Ajoute-la : sa fiche est générée puis partagée avec toute la promo.
          </p>
        </section>

        <Card className="mb-6 border-border bg-card/70 p-4 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
                aria-hidden
              />
              <Input
                data-testid="disease-search-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher une pathologie…"
                className="pl-9"
              />
            </div>
            <form
              className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-md"
              onSubmit={(event) => {
                event.preventDefault();
                if (newName.trim().length >= 3) createDisease.mutate();
              }}
            >
              <Input
                data-testid="disease-new-input"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Ajouter une pathologie (ex. endométriose)"
                maxLength={120}
              />
              <Button
                type="submit"
                size="sm"
                data-testid="disease-create-button"
                disabled={newName.trim().length < 3 || createDisease.isPending}
              >
                {createDisease.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Ajouter
              </Button>
            </form>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5" data-testid="disease-category-filters">
            <button
              type="button"
              data-testid="disease-category-all"
              aria-pressed={category === "ALL"}
              onClick={() => setCategory("ALL")}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                category === "ALL"
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              Toutes ({diseases.length})
            </button>
            {Object.entries(categories).map(([key, label]) => (
              <button
                key={key}
                type="button"
                data-testid={`disease-category-${key}`}
                aria-pressed={category === key}
                onClick={() => setCategory(key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                  category === key
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Card>

        {listQuery.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <Card key={index} className="h-32 animate-pulse border-border bg-card" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card
            data-testid="diseases-empty-state"
            className="flex flex-col items-center gap-2 border-dashed border-border p-12 text-center"
          >
            <Sparkles className="h-6 w-6 text-primary" />
            <p className="font-heading text-lg font-semibold text-foreground">
              Aucune pathologie trouvée
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              Ajoute-la avec le champ « Ajouter une pathologie » : sa fiche sera générée puis
              conservée pour la promo.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="disease-grid">
            {filtered.map((disease) => (
              <button
                key={disease.slug}
                type="button"
                data-testid={`disease-card-${disease.slug}`}
                onClick={() => setOpenSlug(disease.slug)}
                className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/50"
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <h2 className="font-heading text-base font-semibold leading-snug text-foreground group-hover:text-primary">
                    {disease.name}
                  </h2>
                  <Badge variant="outline" className="shrink-0 border-border text-[10px]">
                    {disease.category_label}
                  </Badge>
                </div>
                <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {disease.definition}
                </p>
                {!disease.detailed ? (
                  <span className="mt-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    <Activity className="h-3 w-3" /> fiche complétée à l'ouverture
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </main>

      <Dialog
        open={openSlug !== null}
        onOpenChange={(open) => {
          if (!open) {
            setOpenSlug(null);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="flex max-h-[92svh] flex-col overflow-y-auto sm:max-w-3xl">
          <DialogHeader className="pr-20">
            <DialogTitle>{detail?.name ?? "Fiche pathologie"}</DialogTitle>
            <DialogDescription>
              {detail ? detail.category_label : "Chargement de la fiche…"}
            </DialogDescription>
          </DialogHeader>

          {isAdmin && detail && !editing ? (
            <Button
              variant="ghost"
              size="icon-sm"
              data-testid="disease-edit-button"
              aria-label="Modifier cette fiche"
              title="Modifier cette fiche (admin)"
              onClick={startEditing}
              className="absolute right-12 top-4 text-muted-foreground hover:text-primary"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}

          {detailQuery.isPending ? (
            <div
              data-testid="disease-loading"
              className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground"
            >
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Préparation de la fiche — première ouverture, cela prend quelques secondes.
            </div>
          ) : detailQuery.isError || !detail ? (
            <p data-testid="disease-error" className="py-12 text-center text-sm text-muted-foreground">
              Fiche indisponible pour le moment — réessaie dans un instant.
            </p>
          ) : editing ? (
            <div className="space-y-3" data-testid="disease-edit-form">
              <div className="space-y-1.5">
                <Label htmlFor="edit-definition">Définition</Label>
                <Textarea
                  id="edit-definition"
                  data-testid="disease-edit-definition"
                  value={editing.definition}
                  rows={2}
                  onChange={(event) =>
                    setEditing({ ...editing, definition: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-incubation">Incubation / évolution</Label>
                <Textarea
                  id="edit-incubation"
                  data-testid="disease-edit-incubation"
                  value={editing.incubation}
                  rows={2}
                  onChange={(event) =>
                    setEditing({ ...editing, incubation: event.target.value })
                  }
                />
              </div>
              {SECTIONS.map((section) => (
                <div key={section.key as string} className="space-y-1.5">
                  <Label htmlFor={`edit-${section.key as string}`}>
                    {section.label} — une puce par ligne
                  </Label>
                  <Textarea
                    id={`edit-${section.key as string}`}
                    data-testid={`disease-edit-${section.key as string}`}
                    value={editing[section.key as string] ?? ""}
                    rows={4}
                    onChange={(event) =>
                      setEditing({ ...editing, [section.key as string]: event.target.value })
                    }
                  />
                </div>
              ))}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                  Annuler
                </Button>
                <Button
                  size="sm"
                  data-testid="disease-save-button"
                  disabled={saveDisease.isPending}
                  onClick={submitEditing}
                >
                  Enregistrer
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5" data-testid="disease-detail">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                  Définition
                </p>
                <p className="mt-1 text-sm leading-relaxed text-foreground">
                  {detail.definition}
                </p>
              </div>
              {detail.incubation ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                    Incubation / évolution
                  </p>
                  <p
                    className="mt-1 text-sm leading-relaxed text-foreground"
                    data-testid="disease-incubation"
                  >
                    {detail.incubation}
                  </p>
                </div>
              ) : null}
              {SECTIONS.map((section) => {
                const items = detail[section.key] as string[];
                if (!items || items.length === 0) return null;
                return (
                  <div key={section.key as string} data-testid={`disease-section-${section.key as string}`}>
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                      {section.label}
                    </p>
                    <ul className="mt-1.5 space-y-1.5">
                      {items.map((item, index) => (
                        <li
                          key={`${section.key as string}-${index}`}
                          className="flex gap-2 text-sm leading-relaxed text-foreground"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              <p className="border-t border-border pt-3 text-xs italic text-muted-foreground">
                Fiche de révision : vérifie toujours avec ton cours et les protocoles du service.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <UploadSheetDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        sheets={sheetsQuery.data ?? []}
      />
      <ProgressDialog open={progressOpen} onOpenChange={setProgressOpen} />
    </div>
  );
}
