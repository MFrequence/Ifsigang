import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  BookMarked,
  BookOpen,
  Calculator,
  Pill,
  RotateCcw,
  ShapesIcon,
  Timer,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Loader2,
  TrendingUp,
  Upload,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import type { PlanToday, RevisionCard, RevisionPlan, Sheet, Streak, User } from "@/lib/types";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import StreakCard from "@/components/StreakCard";
import DailyRevisionDialog from "@/components/DailyRevisionDialog";
import MistakesDialog from "@/components/MistakesDialog";
import StudySessionDialog from "@/components/StudySessionDialog";
import ProgressDialog from "@/components/ProgressDialog";
import UploadSheetDialog from "@/components/UploadSheetDialog";
import { cn } from "@/lib/utils";

interface TodayProps {
  user: User;
}

const WEEKDAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}`;
}

function ActionTile({
  title,
  description,
  icon,
  badge,
  testId,
  onClick,
  to,
  accent,
  ring,
  wide,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  testId: string;
  onClick?: () => void;
  to?: string;
  accent: string;
  ring: string;
  wide?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3",
            accent,
          )}
        >
          {icon}
        </div>
        <div className="flex items-center gap-2">
          {badge ? (
            <span className="rounded-full border border-border bg-card/80 px-2.5 py-1 font-mono text-[11px] font-semibold text-muted-foreground">
              {badge}
            </span>
          ) : null}
          <ArrowUpRight className="h-4 w-4 text-muted-foreground/60 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
        </div>
      </div>
      <div className="mt-6">
        <p className="font-heading text-lg font-bold tracking-tight text-foreground">{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </>
  );

  const shell = cn(
    "group bg-card/70 backdrop-blur-md flex h-full flex-col rounded-2xl border border-border p-5 text-left shadow-sm transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6",
    ring,
    wide && "sm:col-span-2",
  );

  return to ? (
    <Link to={to} data-testid={testId} className={shell}>
      {inner}
    </Link>
  ) : (
    <button type="button" data-testid={testId} onClick={onClick} className={shell}>
      {inner}
    </button>
  );
}

// Page d'entrée : on demande d'abord à l'étudiant ce qu'il veut faire, au lieu de le
// déposer directement dans la liste des cours.
export default function Today({ user }: TodayProps) {
  const [dailyOpen, setDailyOpen] = useState(false);
  const [mistakesOpen, setMistakesOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [planSheetIds, setPlanSheetIds] = useState<string[] | null>(null);
  const queryClient = useQueryClient();

  const planQuery = useQuery({
    queryKey: ["revision-plan"],
    queryFn: () => apiGet<RevisionPlan>("/revision/plan"),
    refetchOnWindowFocus: false,
  });
  const streakQuery = useQuery({
    queryKey: ["revision-streak"],
    queryFn: () => apiGet<Streak>("/revision/streak"),
    refetchOnWindowFocus: false,
  });
  // Programme du jour du planning avant partiel le plus proche (null s'il n'y en a pas).
  const examPlanQuery = useQuery({
    queryKey: ["plan-today"],
    queryFn: () => apiGet<PlanToday | null>("/plans/today"),
    refetchOnWindowFocus: false,
  });

  const mistakesQuery = useQuery({
    queryKey: ["revision-mistakes"],
    queryFn: () => apiGet<RevisionCard[]>("/revision/mistakes"),
    refetchOnWindowFocus: false,
  });
  const sheetsQuery = useQuery({
    queryKey: ["sheets"],
    queryFn: () => apiGet<Sheet[]>("/sheets"),
    refetchOnWindowFocus: false,
  });

  const mistakeCount = mistakesQuery.data?.length ?? 0;
  const plan = planQuery.data;
  const sheets = sheetsQuery.data ?? [];
  const firstName = user.name.split(/\s+/)[0];
  const dueCount = plan?.due_today ?? 0;
  const newCount = plan?.new_available ?? 0;
  const toDoNow = dueCount > 0 ? dueCount : Math.min(newCount, 20);
  const maxUpcoming = Math.max(1, ...(plan?.upcoming ?? []).map((d) => d.count));

  const openDaily = () => {
    void queryClient.invalidateQueries({ queryKey: ["revision-today"] });
    setDailyOpen(true);
  };

  return (
    <div className="min-h-svh bg-background">
      <AppHeader
        user={user}
        totalSheets={sheets.length}
        onUploadClick={() => setUploadOpen(true)}
        onProgressClick={() => setProgressOpen(true)}
      />

      <main className="clinical-grid mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {examPlanQuery.data ? (
          <section
            data-testid="plan-today-card"
            className="mb-8 rounded-2xl border border-primary/40 bg-primary/5 p-5 backdrop-blur-md"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
                  <CalendarClock className="h-3.5 w-3.5" /> Planning ·{" "}
                  <span data-testid="plan-today-countdown">
                    {examPlanQuery.data.days_left === 0
                      ? "c'est aujourd'hui"
                      : `J-${examPlanQuery.data.days_left}`}
                  </span>
                  {examPlanQuery.data.is_review ? " · révision générale" : ""}
                </p>
                <h2 className="mt-2 font-heading text-xl font-semibold text-foreground">
                  {examPlanQuery.data.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {examPlanQuery.data.sheets.length > 0
                    ? `Au programme aujourd'hui : ${examPlanQuery.data.sheets
                        .map((sheet) => sheet.title)
                        .join(", ")}`
                    : "Journée libre — profite-en pour revoir tes cartes du jour."}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {examPlanQuery.data.done_count}/{examPlanQuery.data.total_sheets} fiches déjà
                  révisées
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {examPlanQuery.data.sheets.length > 0 ? (
                  <Button
                    size="sm"
                    data-testid="plan-today-study-button"
                    onClick={() =>
                      setPlanSheetIds(
                        (examPlanQuery.data?.sheets ?? []).map((sheet) => sheet.id),
                      )
                    }
                  >
                    <BookOpen className="h-4 w-4" /> Réviser le programme
                  </Button>
                ) : null}
                <Link
                  to="/planning"
                  data-testid="plan-today-open-link"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
                >
                  Voir le planning <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mb-8 grid items-center gap-6 lg:grid-cols-[1.15fr_minmax(0,380px)] lg:gap-10">
          <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            Bonjour {firstName}
          </p>
          <h1 className="mt-4 font-heading text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl">
            Que veux-tu faire
            <span className="italic text-primary"> aujourd'hui&nbsp;?</span>
          </h1>
          {planQuery.isLoading ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Calcul de ton programme…
            </p>
          ) : (
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {dueCount > 0 ? (
                <>
                  Tu as{" "}
                  <span className="font-semibold text-foreground" data-testid="due-today-count">
                    {dueCount} carte{dueCount > 1 ? "s" : ""}
                  </span>{" "}
                  à revoir selon la méthode des J.
                </>
              ) : newCount > 0 ? (
                <>
                  Ton cycle est à jour. Il reste{" "}
                  <span className="font-semibold text-foreground" data-testid="due-today-count">
                    {newCount} carte{newCount > 1 ? "s" : ""}
                  </span>{" "}
                  jamais révisée{newCount > 1 ? "s" : ""} à intégrer quand tu veux.
                </>
              ) : (
                <span data-testid="due-today-count">
                  Tout est à jour — dépose une fiche pour alimenter tes révisions.
                </span>
              )}
            </p>
          )}
          </div>

          <StreakCard
            streak={streakQuery.data}
            loading={streakQuery.isLoading}
            onRevise={openDaily}
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          <ActionTile
            testId="action-revise-today"
            title="Réviser aujourd'hui"
            description="Ton paquet du jour, calculé sur tes oublis : J0, J1, J3, J7, J15, J30."
            icon={<CalendarCheck className="h-5 w-5" />}
            badge={toDoNow > 0 ? `${toDoNow} carte${toDoNow > 1 ? "s" : ""}` : "à jour"}
            accent="bg-gradient-to-br from-emerald-500 to-teal-700 shadow-emerald-600/30"
            ring="hover:border-primary/60/60"
            wide
            onClick={openDaily}
          />
          <ActionTile
            testId="action-mistakes"
            title="Réviser mes erreurs"
            description="Rejoue uniquement les cartes que tu as ratées, tous cours confondus."
            icon={<RotateCcw className="h-5 w-5" />}
            badge={mistakeCount > 0 ? `${mistakeCount} carte${mistakeCount > 1 ? "s" : ""}` : "aucune"}
            accent="bg-gradient-to-br from-rose-500 to-pink-700 shadow-rose-600/30"
            ring="hover:border-rose-400/60"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ["revision-mistakes"] });
              setMistakesOpen(true);
            }}
          />
          <ActionTile
            testId="action-browse-library"
            title="Voir les cours"
            description="Les fiches de la promo par domaine et UE : aperçu, téléchargement, révision."
            icon={<BookOpen className="h-5 w-5" />}
            badge={`${sheets.length} fiche${sheets.length > 1 ? "s" : ""}`}
            accent="bg-gradient-to-br from-emerald-500 to-teal-700 shadow-emerald-600/30"
            ring="hover:border-emerald-400/60"
            to="/cours"
          />
          <ActionTile
            testId="action-upload-sheet"
            title="Déposer une fiche"
            description="Partage tes révisions : flashcards et QCM sont générés automatiquement."
            icon={<Upload className="h-5 w-5" />}
            accent="bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-600/30"
            ring="hover:border-amber-400/60"
            onClick={() => setUploadOpen(true)}
          />
          <ActionTile
            testId="action-lexicon"
            title="Lexique infirmier"
            description="Les abréviations et le vocabulaire de stage, par service."
            icon={<BookMarked className="h-5 w-5" />}
            accent="bg-gradient-to-br from-teal-500 to-cyan-700 shadow-teal-600/30"
            ring="hover:border-teal-400/60"
            to="/lexique"
          />
          <ActionTile
            testId="action-pharmaco"
            title="Pharmacologie"
            description="Fiches médicaments issues du RCP ANSM : effets, posologie, surveillance."
            icon={<Pill className="h-5 w-5" />}
            accent="bg-gradient-to-br from-rose-500 to-red-700 shadow-rose-600/30"
            ring="hover:border-rose-400/60"
            to="/pharmacologie"
          />
          <ActionTile
            testId="action-calc"
            title="Calculs de doses"
            description="mg/kg, ml/h, gouttes/min, dilutions : exercices corrigés pas à pas."
            icon={<Calculator className="h-5 w-5" />}
            accent="bg-gradient-to-br from-cyan-500 to-blue-700 shadow-cyan-600/30"
            ring="hover:border-cyan-400/60"
            to="/calculs"
          />
          <ActionTile
            testId="action-exam"
            title="Examen blanc"
            description="20 QCM chronométrés dans une UE, note sur 20 et correction."
            icon={<Timer className="h-5 w-5" />}
            accent="bg-gradient-to-br from-orange-500 to-rose-700 shadow-orange-600/30"
            ring="hover:border-orange-400/60"
            to="/examen"
          />
          <ActionTile
            testId="action-anatomy"
            title="Schémas à compléter"
            description="Cœur, poumons, rein, digestif, squelette, neurone : place les étiquettes."
            icon={<ShapesIcon className="h-5 w-5" />}
            accent="bg-gradient-to-br from-indigo-500 to-blue-700 shadow-indigo-600/30"
            ring="hover:border-indigo-400/60"
            wide
            to="/schemas"
          />
          <ActionTile
            testId="action-view-progress"
            title="Ma progression"
            description="Ton suivi, tes cartes maîtrisées et le classement de la promo."
            icon={<TrendingUp className="h-5 w-5" />}
            badge={
              plan && plan.scheduled > 0
                ? `${plan.scheduled} suivie${plan.scheduled > 1 ? "s" : ""}`
                : undefined
            }
            accent="bg-gradient-to-br from-violet-500 to-purple-700 shadow-violet-600/30"
            ring="hover:border-violet-400/60"
            onClick={() => setProgressOpen(true)}
          />
        </section>

        {plan && plan.scheduled > 0 ? (
          <section className="mt-10">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
                Mon planning des J
              </h2>
              <span className="font-mono text-xs text-muted-foreground">
                {plan.mastered} au palier J30 · {plan.scheduled} carte
                {plan.scheduled > 1 ? "s" : ""} dans le cycle
              </span>
            </div>
            <div className="bg-card/70 backdrop-blur-md flex flex-col gap-5 rounded-2xl border border-border p-5 shadow-sm sm:p-6">
              <div className="flex items-end gap-2 sm:gap-3" data-testid="revision-plan-chart">
                {plan.upcoming.map((day) => (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-28 w-full items-end">
                      <div
                        className={cn(
                          "w-full rounded-t-lg transition-all duration-500",
                          day.count > 0
                            ? "bg-gradient-to-t from-primary to-primary/50 shadow-inner"
                            : "bg-muted",
                        )}
                        style={{
                          height: day.count > 0 ? `${(day.count / maxUpcoming) * 100}%` : "4px",
                        }}
                        title={`${day.count} carte(s)`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{dayLabel(day.date)}</span>
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {day.count}
                    </span>
                  </div>
                ))}
              </div>
              <p className="flex items-center gap-2 text-xs leading-relaxed text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                Une carte réussie repart au palier suivant ; une carte ratée revient dès demain.
              </p>
            </div>
          </section>
        ) : null}

        <div className="mt-10">
          <Link
            to="/cours"
            data-testid="secondary-library-link"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary/60 hover:text-primary"
          >
            <BookOpen className="h-4 w-4" /> Aller à la bibliothèque de fiches
          </Link>
        </div>
      </main>

      <DailyRevisionDialog open={dailyOpen} onOpenChange={setDailyOpen} />
      <MistakesDialog open={mistakesOpen} onOpenChange={setMistakesOpen} />
      <StudySessionDialog
        domain={null}
        unit={null}
        sheetIds={planSheetIds}
        open={planSheetIds !== null}
        onOpenChange={(open) => {
          if (!open) setPlanSheetIds(null);
        }}
      />
      <UploadSheetDialog open={uploadOpen} onOpenChange={setUploadOpen} sheets={sheets} />
      <ProgressDialog open={progressOpen} onOpenChange={setProgressOpen} />
    </div>
  );
}
