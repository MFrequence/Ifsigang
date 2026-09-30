import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Clock, Loader2, Timer, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import { DOMAINS } from "@/lib/domains";
import type { ExamHistoryEntry, ExamOut, ExamResultOut, Sheet, User } from "@/lib/types";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExamenProps {
  user: User;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Examen blanc : 20 QCM tirés au hasard dans le périmètre choisi, chronométrés, note sur 20.
export default function Examen({ user }: ExamenProps) {
  const [domain, setDomain] = useState<string>("");
  const [unit, setUnit] = useState<string>("");
  const [exam, setExam] = useState<ExamOut | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<ExamResultOut | null>(null);

  const sheetsQuery = useQuery({
    queryKey: ["sheets"],
    queryFn: () => apiGet<Sheet[]>("/sheets"),
    refetchOnWindowFocus: false,
  });
  const historyQuery = useQuery({
    queryKey: ["exam-history"],
    queryFn: () => apiGet<ExamHistoryEntry[]>("/exam/history"),
    refetchOnWindowFocus: false,
  });

  const sheets = sheetsQuery.data ?? [];
  const units = useMemo(
    () =>
      Array.from(new Set(sheets.map((s) => s.unit).filter((u): u is string => Boolean(u)))).sort(),
    [sheets],
  );

  // Chronomètre : tourne pendant l'épreuve, s'arrête à la correction.
  useEffect(() => {
    if (!exam || result) return;
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [exam, result]);

  const start = useMutation({
    mutationFn: () => {
      const params = new URLSearchParams();
      if (domain) params.set("domain", domain);
      if (unit) params.set("unit", unit);
      const suffix = params.toString();
      return apiPost<ExamOut>(`/exam/start${suffix ? `?${suffix}` : ""}`, {});
    },
    onSuccess: (data) => {
      setExam(data);
      setAnswers({});
      setResult(null);
      setSeconds(0);
    },
    onError: () => toast.error("Pas encore assez de QCM dans ce périmètre"),
  });

  const submit = useMutation({
    mutationFn: () => apiPost<ExamResultOut>(`/exam/${exam?.id}/submit`, { answers, seconds }),
    onSuccess: (data) => {
      setResult(data);
      void historyQuery.refetch();
      toast.success(`${data.mark}/20 — ${data.score} bonnes réponses sur ${data.total}`);
    },
    onError: () => toast.error("Correction impossible — réessaie"),
  });

  const answered = Object.keys(answers).length;
  const history = historyQuery.data ?? [];

  return (
    <div className="min-h-svh bg-background">
      <AppHeader user={user} totalSheets={sheets.length} />

      <main className="clinical-grid mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          to="/"
          data-testid="exam-back-link"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Accueil
        </Link>
        <h1 className="flex items-center gap-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          <Timer className="h-7 w-7 text-primary" /> Examen blanc
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          20 QCM tirés au hasard dans le périmètre choisi, chronométrés, note sur 20 et
          correction question par question.
        </p>

        {!exam ? (
          <>
            <section className="mt-8 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Domaine
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="exam-domain-all"
                    onClick={() => setDomain("")}
                    className={cn(
                      "rounded-full border px-3.5 py-2 text-sm transition-colors duration-200",
                      domain === ""
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/50",
                    )}
                  >
                    Tous
                  </button>
                  {DOMAINS.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      data-testid={`exam-domain-${d.key}`}
                      onClick={() => setDomain(d.key)}
                      className={cn(
                        "rounded-full border px-3.5 py-2 text-sm transition-colors duration-200",
                        domain === d.key
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-primary/50",
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {units.length > 0 ? (
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    UE (optionnel)
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-testid="exam-unit-all"
                      onClick={() => setUnit("")}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition-colors duration-200",
                        unit === ""
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-primary/50",
                      )}
                    >
                      Toutes
                    </button>
                    {units.map((u) => (
                      <button
                        key={u}
                        type="button"
                        data-testid={`exam-unit-${u}`}
                        onClick={() => setUnit(u)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 font-mono text-sm transition-colors duration-200",
                          unit === u
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-primary/50",
                        )}
                      >
                        UE {u}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <Button
                data-testid="exam-start-button"
                disabled={start.isPending}
                onClick={() => start.mutate()}
                className="self-start"
              >
                {start.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Tirage des questions…
                  </>
                ) : (
                  "Démarrer l'examen blanc"
                )}
              </Button>
            </section>

            {history.length > 0 ? (
              <section className="mt-8" data-testid="exam-history">
                <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
                  Mes examens blancs
                </h2>
                <div className="mt-3 flex flex-col gap-2">
                  {history.map((entry, index) => (
                    <div
                      key={`${entry.created_at}-${index}`}
                      data-testid={`exam-history-${index}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3"
                    >
                      <span className="text-sm text-foreground">{entry.scope}</span>
                      <span className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {formatDuration(entry.seconds)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-foreground">
                          <Trophy className="h-3.5 w-3.5 text-primary" /> {entry.mark}/20
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <>
            <div className="sticky top-[73px] z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/90 p-3 backdrop-blur-md">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {exam.scope} · {answered}/{exam.total} répondues
              </span>
              <span
                data-testid="exam-timer"
                className="inline-flex items-center gap-1.5 font-mono text-sm text-foreground"
              >
                <Clock className="h-4 w-4 text-primary" /> {formatDuration(seconds)}
              </span>
            </div>

            {result ? (
              <div
                data-testid="exam-result"
                className="mt-6 rounded-2xl border border-primary/40 bg-primary/10 p-6 text-center"
              >
                <p className="font-heading text-5xl font-bold text-foreground">
                  {result.mark}
                  <span className="text-2xl text-muted-foreground">/20</span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {result.score} bonnes réponses sur {result.total} · {formatDuration(result.seconds)}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button
                    data-testid="exam-restart-button"
                    onClick={() => {
                      setExam(null);
                      setResult(null);
                    }}
                  >
                    Nouvel examen
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-4">
              {exam.questions.map((question, index) => {
                const correction = result?.corrections.find((c) => c.card_id === question.card_id);
                return (
                  <div
                    key={question.card_id}
                    data-testid={`exam-question-${index}`}
                    className={cn(
                      "rounded-2xl border bg-card p-5",
                      correction
                        ? correction.correct
                          ? "border-primary/50"
                          : "border-destructive/50"
                        : "border-border",
                    )}
                  >
                    <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Question {index + 1} · {question.sheet_title}
                    </p>
                    <p className="mt-2 font-heading text-lg leading-relaxed text-foreground">
                      {question.question}
                    </p>
                    <div className="mt-4 flex flex-col gap-2">
                      {question.choices.map((choice) => {
                        const chosen = answers[question.card_id] === choice;
                        const isExpected = correction?.expected === choice;
                        return (
                          <button
                            key={choice}
                            type="button"
                            data-testid={`exam-choice-${index}-${question.choices.indexOf(choice)}`}
                            disabled={Boolean(result)}
                            onClick={() =>
                              setAnswers((prev) => ({ ...prev, [question.card_id]: choice }))
                            }
                            className={cn(
                              "flex items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm transition-colors duration-200",
                              result
                                ? isExpected
                                  ? "border-primary bg-primary/10 text-foreground"
                                  : chosen
                                    ? "border-destructive bg-destructive/10 text-foreground"
                                    : "border-border text-muted-foreground"
                                : chosen
                                  ? "border-primary bg-primary/10 text-foreground"
                                  : "border-border text-foreground hover:border-primary/50",
                            )}
                          >
                            {choice}
                            {result && isExpected ? (
                              <Check className="h-4 w-4 shrink-0 text-primary" />
                            ) : result && chosen ? (
                              <X className="h-4 w-4 shrink-0 text-destructive" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {!result ? (
              <Button
                data-testid="exam-submit-button"
                className="mt-6"
                disabled={submit.isPending || answered === 0}
                onClick={() => submit.mutate()}
              >
                {submit.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Correction…
                  </>
                ) : (
                  `Terminer (${answered}/${exam.total})`
                )}
              </Button>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
