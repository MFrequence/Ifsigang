import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Loader2,
  TrendingUp,
  Upload,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import type { RevisionPlan, Sheet, User } from "@/lib/types";
import AppHeader from "@/components/AppHeader";
import DailyRevisionDialog from "@/components/DailyRevisionDialog";
import ProgressDialog from "@/components/ProgressDialog";
import UploadSheetDialog from "@/components/UploadSheetDialog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  testId: string;
  onClick?: () => void;
  to?: string;
  accent: string;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm",
            accent,
          )}
        >
          {icon}
        </div>
        {badge ? (
          <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
            {badge}
          </Badge>
        ) : null}
      </div>
      <div className="mt-4">
        <p className="font-heading text-lg font-semibold tracking-tight text-slate-900">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
      </div>
    </>
  );

  const shell =
    "flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500";

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
  const [uploadOpen, setUploadOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);

  const planQuery = useQuery({
    queryKey: ["revision-plan"],
    queryFn: () => apiGet<RevisionPlan>("/revision/plan"),
    refetchOnWindowFocus: false,
  });
  const sheetsQuery = useQuery({
    queryKey: ["sheets"],
    queryFn: () => apiGet<Sheet[]>("/sheets"),
    refetchOnWindowFocus: false,
  });

  const plan = planQuery.data;
  const sheets = sheetsQuery.data ?? [];
  const firstName = user.name.split(/\s+/)[0];
  const dueCount = plan?.due_today ?? 0;
  const newCount = plan?.new_available ?? 0;
  const toDoNow = dueCount > 0 ? dueCount : Math.min(newCount, 20);
  const maxUpcoming = Math.max(1, ...(plan?.upcoming ?? []).map((d) => d.count));

  return (
    <div className="min-h-svh bg-background">
      <AppHeader
        user={user}
        totalSheets={sheets.length}
        onUploadClick={() => setUploadOpen(true)}
        onProgressClick={() => setProgressOpen(true)}
      />

      <main className="dot-grid mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="mb-10">
          <p className="font-mono text-xs uppercase tracking-wider text-slate-500">
            Bonjour {firstName}
          </p>
          <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Que veux-tu faire aujourd'hui ?
          </h1>
          {planQuery.isLoading ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Calcul de ton programme…
            </p>
          ) : (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
              {dueCount > 0 ? (
                <>
                  Tu as{" "}
                  <span className="font-semibold text-slate-900" data-testid="due-today-count">
                    {dueCount} carte{dueCount > 1 ? "s" : ""}
                  </span>{" "}
                  à revoir selon la méthode des J.
                </>
              ) : newCount > 0 ? (
                <>
                  Ton cycle est à jour. Il reste{" "}
                  <span className="font-semibold text-slate-900" data-testid="due-today-count">
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
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          <ActionTile
            testId="action-revise-today"
            title="Réviser aujourd'hui"
            description="Ton paquet du jour, calculé sur tes oublis : J0, J1, J3, J7, J15, J30."
            icon={<CalendarCheck className="h-5 w-5" />}
            badge={toDoNow > 0 ? `${toDoNow} carte${toDoNow > 1 ? "s" : ""}` : "à jour"}
            accent="bg-sky-700"
            onClick={() => setDailyOpen(true)}
          />
          <ActionTile
            testId="action-browse-library"
            title="Voir les cours"
            description="Parcourir les fiches de la promo par domaine et par UE, prévisualiser, télécharger."
            icon={<BookOpen className="h-5 w-5" />}
            badge={`${sheets.length} fiche${sheets.length > 1 ? "s" : ""}`}
            accent="bg-emerald-700"
            to="/cours"
          />
          <ActionTile
            testId="action-upload-sheet"
            title="Déposer une fiche"
            description="Partage tes révisions : les flashcards et QCM sont générés automatiquement."
            icon={<Upload className="h-5 w-5" />}
            accent="bg-amber-700"
            onClick={() => setUploadOpen(true)}
          />
          <ActionTile
            testId="action-view-progress"
            title="Ma progression"
            description="Ton suivi, tes cartes maîtrisées et le classement de la promo."
            icon={<TrendingUp className="h-5 w-5" />}
            badge={
              plan && plan.scheduled > 0
                ? `${plan.scheduled} carte${plan.scheduled > 1 ? "s" : ""} suivie${plan.scheduled > 1 ? "s" : ""}`
                : undefined
            }
            accent="bg-purple-700"
            onClick={() => setProgressOpen(true)}
          />
        </section>

        {plan && plan.scheduled > 0 ? (
          <section className="mt-10">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-heading text-lg font-semibold tracking-tight text-slate-900">
                Mon planning des J
              </h2>
              <span className="text-xs text-slate-500">
                {plan.mastered} au palier J30 · {plan.scheduled} carte
                {plan.scheduled > 1 ? "s" : ""} dans le cycle
              </span>
            </div>
            <Card className="flex flex-col gap-4 border-slate-200 p-5">
              <div className="flex items-end gap-2" data-testid="revision-plan-chart">
                {plan.upcoming.map((day) => (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-24 w-full items-end">
                      <div
                        className={cn(
                          "w-full rounded-t-md transition-all duration-300",
                          day.count > 0 ? "bg-sky-600" : "bg-slate-100",
                        )}
                        style={{
                          height: day.count > 0 ? `${(day.count / maxUpcoming) * 100}%` : "4px",
                        }}
                        title={`${day.count} carte(s)`}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500">{dayLabel(day.date)}</span>
                    <span className="font-mono text-xs text-slate-700">{day.count}</span>
                  </div>
                ))}
              </div>
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Une carte réussie repart au palier suivant ; une carte ratée revient dès demain.
              </p>
            </Card>
          </section>
        ) : null}

        <div className="mt-10">
          <Link
            to="/cours"
            data-testid="secondary-library-link"
            className={buttonVariants({ variant: "outline" })}
          >
            <BookOpen className="h-4 w-4" /> Aller à la bibliothèque de fiches
          </Link>
        </div>
      </main>

      <DailyRevisionDialog open={dailyOpen} onOpenChange={setDailyOpen} />
      <UploadSheetDialog open={uploadOpen} onOpenChange={setUploadOpen} sheets={sheets} />
      <ProgressDialog open={progressOpen} onOpenChange={setProgressOpen} />
    </div>
  );
}
