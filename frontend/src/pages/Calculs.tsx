import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Calculator, Check, Flame, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import type { CalcAnswerResult, CalcExercise, CalcStats, Sheet, User } from "@/lib/types";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CalculsProps {
  user: User;
}

// Entraînement aux calculs de doses et de débits : énoncé généré côté serveur,
// correction pas à pas (la réponse n'est jamais envoyée avant validation).
export default function Calculs({ user }: CalculsProps) {
  const [type, setType] = useState<string>("");
  const [value, setValue] = useState("");
  const [result, setResult] = useState<CalcAnswerResult | null>(null);
  const queryClient = useQueryClient();

  const sheetsQuery = useQuery({
    queryKey: ["sheets"],
    queryFn: () => apiGet<Sheet[]>("/sheets"),
    refetchOnWindowFocus: false,
  });
  const typesQuery = useQuery({
    queryKey: ["calc-types"],
    queryFn: () => apiGet<Record<string, string>>("/calc/types"),
    refetchOnWindowFocus: false,
  });
  const statsQuery = useQuery({
    queryKey: ["calc-stats"],
    queryFn: () => apiGet<CalcStats>("/calc/stats"),
    refetchOnWindowFocus: false,
  });
  const exerciseQuery = useQuery({
    queryKey: ["calc-exercise", type],
    queryFn: () => apiGet<CalcExercise>(`/calc/exercise${type ? `?type=${type}` : ""}`),
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const exercise = exerciseQuery.data;

  useEffect(() => {
    setValue("");
    setResult(null);
  }, [exercise?.id]);

  const check = useMutation({
    mutationFn: () =>
      apiPost<CalcAnswerResult>("/calc/answer", {
        exercise_id: exercise?.id,
        answer: Number(value.replace(",", ".")),
      }),
    onSuccess: (data) => {
      setResult(data);
      void queryClient.invalidateQueries({ queryKey: ["calc-stats"] });
      toast[data.correct ? "success" : "error"](
        data.correct ? "Bonne réponse !" : `Réponse attendue : ${data.expected} ${data.unit}`,
      );
    },
    onError: () => toast.error("Correction impossible — réessaie"),
  });

  const stats = statsQuery.data;

  return (
    <div className="min-h-svh bg-background">
      <AppHeader user={user} totalSheets={(sheetsQuery.data ?? []).length} />

      <main className="clinical-grid mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          to="/"
          data-testid="calc-back-link"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Accueil
        </Link>
        <h1 className="flex items-center gap-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          <Calculator className="h-7 w-7 text-primary" /> Calculs de doses
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Posologies au poids, débits de perfusion, gouttes par minute, dilutions et comptage
          de comprimés. Exercices générés à l'infini, correction détaillée à chaque étape.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2" data-testid="calc-type-filters">
          <button
            type="button"
            data-testid="calc-type-all"
            onClick={() => setType("")}
            className={cn(
              "rounded-full border px-3.5 py-2 text-sm font-medium transition-colors duration-200",
              type === ""
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/50",
            )}
          >
            Tous les types
          </button>
          {Object.entries(typesQuery.data ?? {}).map(([key, label]) => (
            <button
              key={key}
              type="button"
              data-testid={`calc-type-${key}`}
              onClick={() => setType(key)}
              className={cn(
                "rounded-full border px-3.5 py-2 text-sm font-medium transition-colors duration-200",
                type === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50",
              )}
            >
              {label}
              {stats?.per_type?.[key] ? (
                <span className="ml-1.5 font-mono text-xs opacity-70">
                  {stats.per_type[key]}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {stats && stats.answered > 0 ? (
          <div
            data-testid="calc-stats"
            className="mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card/70 p-4 backdrop-blur-md"
          >
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {stats.answered} exercice{stats.answered > 1 ? "s" : ""} · {stats.accuracy} % de
              réussite
            </span>
            {result?.streak ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-mono text-xs text-amber-600 dark:text-amber-300">
                <Flame className="h-3.5 w-3.5" /> {result.streak} d'affilée
              </span>
            ) : null}
          </div>
        ) : null}

        {exerciseQuery.isPending || !exercise ? (
          <div className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Génération d'un exercice…
          </div>
        ) : (
          <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
              {exercise.label}
            </p>
            <p
              data-testid="calc-statement"
              className="mt-3 font-heading text-xl leading-relaxed text-foreground"
            >
              {exercise.statement}
            </p>

            <form
              className="mt-6 flex flex-wrap items-center gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!value.trim() || Number.isNaN(Number(value.replace(",", ".")))) {
                  toast.error("Saisis un nombre");
                  return;
                }
                check.mutate();
              }}
            >
              <div className="flex items-center gap-2">
                <Input
                  data-testid="calc-answer-input"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  inputMode="decimal"
                  placeholder="Ta réponse"
                  aria-label="Ta réponse"
                  disabled={Boolean(result)}
                  className="w-36"
                />
                <span className="font-mono text-sm text-muted-foreground">{exercise.unit}</span>
              </div>
              {result ? (
                <Button
                  type="button"
                  data-testid="calc-next-button"
                  onClick={() => void exerciseQuery.refetch()}
                >
                  Exercice suivant
                </Button>
              ) : (
                <Button type="submit" data-testid="calc-submit-button" disabled={check.isPending}>
                  {check.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Correction…
                    </>
                  ) : (
                    "Valider"
                  )}
                </Button>
              )}
            </form>

            {result ? (
              <div
                data-testid="calc-correction"
                className={cn(
                  "mt-6 rounded-xl border p-4",
                  result.correct
                    ? "border-primary/40 bg-primary/10"
                    : "border-destructive/40 bg-destructive/10",
                )}
              >
                <p className="flex items-center gap-2 font-heading text-base font-bold text-foreground">
                  {result.correct ? (
                    <>
                      <Check className="h-4 w-4 text-primary" /> Bonne réponse
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 text-destructive" /> Réponse attendue :{" "}
                      {result.expected} {result.unit}
                    </>
                  )}
                </p>
                <ol className="mt-3 flex flex-col gap-2">
                  {result.steps.map((step, index) => (
                    <li
                      key={step}
                      data-testid={`calc-step-${index}`}
                      className="flex gap-2 text-sm leading-relaxed text-foreground"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {index + 1}.
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}
