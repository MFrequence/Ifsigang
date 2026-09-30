import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  CalendarPlus,
  Check,
  Layers,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { DOMAINS, DOMAIN_MAP } from "@/lib/domains";
import type { DomainKey, RevisionPlan, User } from "@/lib/types";
import AppHeader from "@/components/AppHeader";
import ProgressDialog from "@/components/ProgressDialog";
import SheetPreviewDialog from "@/components/SheetPreviewDialog";
import StudySessionDialog from "@/components/StudySessionDialog";
import UploadSheetDialog from "@/components/UploadSheetDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Sheet } from "@/lib/types";

interface PlanningProps {
  user: User;
}

export default function Planning({ user }: PlanningProps) {
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState<DomainKey | "">("");
  const [unit, setUnit] = useState("");
  const [examDate, setExamDate] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [previewSheet, setPreviewSheet] = useState<Sheet | null>(null);
  const [sessionSheetIds, setSessionSheetIds] = useState<string[] | null>(null);
  const queryClient = useQueryClient();

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: () => apiGet<RevisionPlan[]>("/plans"),
    refetchOnWindowFocus: false,
  });
  const plans = plansQuery.data ?? [];

  // Les fiches servent à ouvrir la lecture depuis une journée du programme.
  const sheetsQuery = useQuery({
    queryKey: ["sheets"],
    queryFn: () => apiGet<Sheet[]>("/sheets"),
    refetchOnWindowFocus: false,
  });
  const sheetById = new Map((sheetsQuery.data ?? []).map((sheet) => [sheet.id, sheet]));

  const createPlan = useMutation({
    mutationFn: () =>
      apiPost<RevisionPlan>("/plans", {
        title: title.trim(),
        domain,
        unit: unit.trim(),
        exam_date: examDate,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["plans"] });
      setTitle("");
      setUnit("");
      setExamDate("");
      setDomain("");
      toast.success("Planning créé — ton programme est prêt");
    },
    onError: () => toast.error("Création impossible — vérifie la date et le domaine"),
  });

  const toggleSheet = useMutation({
    mutationFn: ({ planId, sheetId }: { planId: string; sheetId: string }) =>
      apiPost<RevisionPlan>(`/plans/${planId}/sheets/${sheetId}/toggle`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["plans"] }),
    onError: () => toast.error("Impossible de mettre à jour l'avancement"),
  });

  const deletePlan = useMutation({
    mutationFn: (planId: string) => apiDelete<void>(`/plans/${planId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Planning supprimé");
    },
    onError: () => toast.error("Suppression impossible"),
  });

  const canSubmit = title.trim().length > 0 && domain !== "" && examDate !== "";

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
            <CalendarClock className="mb-1 mr-2 inline h-7 w-7 text-primary" />
            Planning <span className="text-primary">avant partiel</span>
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Indique la date de ton épreuve et l'UE : les fiches du domaine sont réparties sur les
            jours restants, avec une révision générale la veille au soir.
          </p>
        </section>

        <Card className="mb-10 border-border bg-card/70 p-5 backdrop-blur-md">
          <form
            className="grid gap-4 md:grid-cols-[1.4fr_1fr_0.8fr_0.9fr_auto] md:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSubmit) createPlan.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="plan-title">Épreuve</Label>
              <Input
                id="plan-title"
                data-testid="plan-title-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Partiel UE 2.1"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-domain">Domaine</Label>
              <Select value={domain} onValueChange={(value) => setDomain(value as DomainKey)}>
                <SelectTrigger id="plan-domain" data-testid="plan-domain-select" className="w-full">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {DOMAINS.map((item) => (
                    <SelectItem key={item.key} value={item.key}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-unit">UE (option)</Label>
              <Input
                id="plan-unit"
                data-testid="plan-unit-input"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                placeholder="2.1"
                maxLength={40}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-date">Date de l'épreuve</Label>
              <Input
                id="plan-date"
                type="date"
                data-testid="plan-date-input"
                value={examDate}
                onChange={(event) => setExamDate(event.target.value)}
              />
            </div>
            <Button
              type="submit"
              data-testid="plan-create-button"
              disabled={!canSubmit || createPlan.isPending}
            >
              <CalendarPlus className="h-4 w-4" /> Créer
            </Button>
          </form>
        </Card>

        {plansQuery.isPending ? (
          <Card className="h-40 animate-pulse border-border bg-card" />
        ) : plans.length === 0 ? (
          <Card
            data-testid="plans-empty-state"
            className="flex flex-col items-center gap-2 border-dashed border-border p-12 text-center"
          >
            <Sparkles className="h-6 w-6 text-primary" />
            <p className="font-heading text-lg font-semibold text-foreground">
              Aucun planning pour l'instant
            </p>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Crée-en un avec la date de ton prochain partiel : tu sauras exactement quoi réviser
              chaque jour d'ici là.
            </p>
          </Card>
        ) : (
          <div className="space-y-8">
            {plans.map((plan) => {
              const progress =
                plan.total_sheets > 0
                  ? Math.round((plan.done_count / plan.total_sheets) * 100)
                  : 0;
              return (
                <Card
                  key={plan.id}
                  data-testid={`plan-card-${plan.id}`}
                  className="border-border bg-card p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-heading text-xl font-semibold text-foreground">
                          {plan.title}
                        </h2>
                        <Badge variant="outline" className={DOMAIN_MAP[plan.domain]?.badge}>
                          {DOMAIN_MAP[plan.domain]?.label}
                        </Badge>
                        {plan.unit ? (
                          <Badge variant="outline" className="border-border text-muted-foreground">
                            UE {plan.unit}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        <span data-testid={`plan-days-left-${plan.id}`}>
                          {plan.days_left === 0
                            ? "C'est aujourd'hui"
                            : `J-${plan.days_left}`}
                        </span>{" "}
                        · {plan.total_sheets} fiche{plan.total_sheets > 1 ? "s" : ""} ·{" "}
                        {plan.cards_total} carte{plan.cards_total > 1 ? "s" : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      data-testid={`plan-delete-button-${plan.id}`}
                      aria-label="Supprimer ce planning"
                      className="text-muted-foreground/70 hover:text-destructive"
                      onClick={() => deletePlan.mutate(plan.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Avancement</span>
                      <span data-testid={`plan-progress-${plan.id}`}>
                        {plan.done_count}/{plan.total_sheets} fiches ({progress} %)
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {plan.total_sheets === 0 ? (
                    <p className="mt-5 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      Aucune fiche dans cette sélection — dépose tes fiches de ce domaine pour
                      remplir le programme.
                    </p>
                  ) : (
                    <ul className="mt-5 space-y-3">
                      {plan.days.map((day) => (
                        <li
                          key={day.date}
                          data-testid={`plan-day-${plan.id}-${day.date}`}
                          className={`rounded-xl border p-4 transition-colors duration-200 ${
                            day.is_today
                              ? "border-primary/60 bg-primary/5"
                              : day.is_past
                                ? "border-border/60 bg-secondary/40 opacity-70"
                                : "border-border"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                              {day.label}
                              {day.is_review ? (
                                <Badge
                                  variant="outline"
                                  className="border-primary/50 text-primary"
                                >
                                  Révision générale
                                </Badge>
                              ) : null}
                            </p>
                            {day.sheets.length > 0 ? (
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid={`plan-day-study-${plan.id}-${day.date}`}
                                onClick={() =>
                                  setSessionSheetIds(day.sheets.map((sheet) => sheet.id))
                                }
                              >
                                <Layers className="h-4 w-4" /> Réviser ce jour
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">Journée libre</span>
                            )}
                          </div>
                          {day.sheets.length > 0 ? (
                            <ul className="mt-3 flex flex-wrap gap-2">
                              {day.sheets.map((sheet) => (
                                <li key={sheet.id} className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    data-testid={`plan-sheet-toggle-${plan.id}-${sheet.id}`}
                                    aria-pressed={sheet.done}
                                    title={
                                      sheet.done ? "Marquer comme à revoir" : "Marquer comme révisée"
                                    }
                                    onClick={() =>
                                      toggleSheet.mutate({ planId: plan.id, sheetId: sheet.id })
                                    }
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors duration-150 ${
                                      sheet.done
                                        ? "border-primary/60 bg-primary/15 text-primary"
                                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                    }`}
                                  >
                                    {sheet.done ? <Check className="h-3 w-3" /> : null}
                                    {sheet.title}
                                  </button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    data-testid={`plan-sheet-read-${plan.id}-${sheet.id}`}
                                    onClick={() => setPreviewSheet(sheetById.get(sheet.id) ?? null)}
                                    disabled={!sheetById.has(sheet.id)}
                                    className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                                  >
                                    Lire
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <UploadSheetDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        sheets={sheetsQuery.data ?? []}
      />
      <ProgressDialog open={progressOpen} onOpenChange={setProgressOpen} />
      <SheetPreviewDialog
        sheet={previewSheet}
        open={previewSheet !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewSheet(null);
        }}
      />
      <StudySessionDialog
        domain={null}
        unit={null}
        sheetIds={sessionSheetIds}
        open={sessionSheetIds !== null}
        onOpenChange={(open) => {
          if (!open) setSessionSheetIds(null);
        }}
      />
    </div>
  );
}
