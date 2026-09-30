import { Flame, Snowflake, Trophy } from "lucide-react";
import type { Streak } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StreakCardProps {
  streak?: Streak;
  loading?: boolean;
  onRevise: () => void;
}

const DAY_INITIALS = ["D", "L", "M", "M", "J", "V", "S"];

function initialOf(iso: string): string {
  return DAY_INITIALS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
}

function dayNumberOf(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDate();
}

// Série de jours : un jour est validé quand toutes les révisions dues ont été terminées.
// Carte « encre chaude » volontairement sombre dans les deux thèmes, posée à côté du titre.
export default function StreakCard({ streak, loading, onRevise }: StreakCardProps) {
  const current = streak?.current ?? 0;
  const alive = current > 0;
  const remaining = streak?.remaining_today ?? 0;
  const doneToday = streak?.completed_today ?? false;

  return (
    <section
      data-testid="streak-card"
      className="animate-rise relative overflow-hidden rounded-2xl border border-amber-500/25 bg-[#120F0C] p-6 text-amber-50 shadow-2xl"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-amber-500/20 blur-3xl"
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
        <span className="animate-ecg block h-px w-1/3 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
      </div>

      <div className="relative flex items-center gap-4">
        <div
          data-testid="streak-flame-icon"
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl",
            alive
              ? "animate-flame bg-gradient-to-tr from-orange-600 via-amber-500 to-yellow-300 text-amber-950"
              : "border border-amber-100/15 bg-amber-950/40 text-amber-200/50",
          )}
        >
          {alive ? <Flame className="h-7 w-7" /> : <Snowflake className="h-6 w-6" />}
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400">
            Série de jours
          </p>
          <p className="mt-0.5 flex items-baseline gap-2 font-heading text-4xl font-bold tracking-tight">
            <span data-testid="streak-counter-value">{loading ? "—" : current}</span>
            <span className="font-sans text-sm font-medium text-amber-100/70">
              jour{current > 1 ? "s" : ""} d'affilée
            </span>
          </p>
        </div>
      </div>

      <p className="relative mt-3 text-sm leading-relaxed text-amber-100/75">
        {doneToday
          ? "Journée validée — reviens demain pour allonger la série."
          : remaining > 0
            ? `Termine tes ${remaining} carte${remaining > 1 ? "s" : ""} du jour pour valider la journée.`
            : alive
              ? "Rien de dû aujourd'hui : révise une carte pour entretenir le rythme."
              : "Une journée compte dès que toutes tes révisions du jour sont terminées."}
      </p>

      <div
        data-testid="streak-week-row"
        className="relative mt-5 grid grid-cols-7 gap-1.5 border-t border-amber-100/10 pt-4"
      >
        {(streak?.days ?? []).map((day, index) => (
          <div
            key={day.date}
            data-testid={`streak-day-pill-${index}`}
            title={`${day.date} — ${day.completed ? "validé" : "non validé"}`}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 rounded-lg p-1.5 transition-colors duration-200",
              day.completed && day.is_today
                ? "border border-amber-300 bg-gradient-to-b from-amber-400 to-orange-600 text-amber-950"
                : day.completed
                  ? "border border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                  : day.is_today
                    ? "animate-float border border-amber-400/60 bg-amber-500/10 text-amber-300"
                    : "border border-amber-100/10 bg-amber-100/[0.03] text-amber-100/30",
            )}
          >
            <span className="font-mono text-[9px] uppercase">{initialOf(day.date)}</span>
            <span className="font-heading text-xs font-bold">{dayNumberOf(day.date)}</span>
          </div>
        ))}
      </div>

      <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3">
        <span
          data-testid="streak-best-badge"
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-100/15 bg-amber-950/50 px-3 py-1 font-mono text-xs text-amber-200/80"
        >
          <Trophy className="h-3.5 w-3.5 text-amber-400" /> record {streak?.best ?? 0} j
        </span>
        <button
          type="button"
          data-testid="streak-revise-button"
          onClick={onRevise}
          className="rounded-lg bg-amber-400 px-4 py-2 font-heading text-sm font-bold text-amber-950 transition-transform duration-150 hover:-translate-y-0.5 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 active:scale-[0.98]"
        >
          {doneToday ? "Réviser encore" : "Entretenir ma série"}
        </button>
      </div>
    </section>
  );
}
