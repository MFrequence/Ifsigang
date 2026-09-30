import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Loader2, RotateCcw, ShapesIcon, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import type {
  DiagramAttemptResult,
  DiagramExercise,
  DiagramSummary,
  Sheet,
  User,
} from "@/lib/types";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AnatomieProps {
  user: User;
}

// Schémas à compléter : on fait glisser (ou on tape) une étiquette sur chaque repère numéroté.
// La correction est faite côté serveur : le mapping numéro → nom n'est jamais envoyé avant.
export default function Anatomie({ user }: AnatomieProps) {
  const [slug, setSlug] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Record<number, string>>({});
  const [picked, setPicked] = useState<string | null>(null);
  // Glisser-déposer maison en pointer events : fonctionne à la souris ET au doigt
  // (le drag&drop HTML5 natif est inopérant sur mobile).
  const [drag, setDrag] = useState<{ label: string; x: number; y: number; moved: boolean } | null>(
    null,
  );
  const [result, setResult] = useState<DiagramAttemptResult | null>(null);
  const queryClient = useQueryClient();

  const sheetsQuery = useQuery({
    queryKey: ["sheets"],
    queryFn: () => apiGet<Sheet[]>("/sheets"),
    refetchOnWindowFocus: false,
  });
  const listQuery = useQuery({
    queryKey: ["anatomy"],
    queryFn: () => apiGet<DiagramSummary[]>("/anatomy"),
    refetchOnWindowFocus: false,
  });
  const exerciseQuery = useQuery({
    queryKey: ["anatomy-exercise", slug],
    queryFn: () => apiGet<DiagramExercise>(`/anatomy/${slug}`),
    enabled: Boolean(slug),
    refetchOnWindowFocus: false,
  });

  const exercise = exerciseQuery.data;

  useEffect(() => {
    setPlaced({});
    setPicked(null);
    setResult(null);
  }, [slug]);

  const remainingLabels = useMemo(() => {
    if (!exercise) return [];
    const used = new Set(Object.values(placed));
    return exercise.labels.filter((label) => !used.has(label));
  }, [exercise, placed]);

  useEffect(() => {
    if (!drag) return;
    const move = (event: PointerEvent) => {
      setDrag((current) =>
        current
          ? {
              ...current,
              x: event.clientX,
              y: event.clientY,
              moved: current.moved || Math.abs(event.clientX - current.x) > 6 ||
                Math.abs(event.clientY - current.y) > 6,
            }
          : current,
      );
    };
    const up = (event: PointerEvent) => {
      const current = drag;
      setDrag(null);
      if (!current) return;
      if (!current.moved) {
        // simple clic/tap : on sélectionne l'étiquette, à poser ensuite sur un repère
        setPicked((prev) => (prev === current.label ? null : current.label));
        return;
      }
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest("[data-slot-number]");
      const number = target?.getAttribute("data-slot-number");
      if (number) place(Number(number), current.label);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag]);

  const submit = useMutation({
    mutationFn: () =>
      apiPost<DiagramAttemptResult>(`/anatomy/${slug}/attempt`, {
        answers: Object.fromEntries(
          Object.entries(placed).map(([number, label]) => [String(number), label]),
        ),
      }),
    onSuccess: (data) => {
      setResult(data);
      void queryClient.invalidateQueries({ queryKey: ["anatomy"] });
      toast.success(`${data.score} / ${data.total} repères corrects`);
    },
    onError: () => toast.error("Validation impossible — réessaie"),
  });

  const place = (number: number, label: string) => {
    setPlaced((prev) => {
      const next: Record<number, string> = {};
      // une étiquette ne peut occuper qu'un seul repère
      for (const [key, value] of Object.entries(prev)) {
        if (value !== label) next[Number(key)] = value;
      }
      next[number] = label;
      return next;
    });
    setPicked(null);
  };

  const clearSlot = (number: number) => {
    setPlaced((prev) => {
      const next = { ...prev };
      delete next[number];
      return next;
    });
  };

  return (
    <div className="min-h-svh bg-background">
      <AppHeader user={user} totalSheets={(sheetsQuery.data ?? []).length} />

      <main className="clinical-grid mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {slug ? (
          <button
            type="button"
            data-testid="anatomy-back-to-list"
            onClick={() => setSlug(null)}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Tous les schémas
          </button>
        ) : (
          <Link
            to="/"
            data-testid="anatomy-back-link"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Accueil
          </Link>
        )}

        {!slug ? (
          <>
            <h1 className="flex items-center gap-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              <ShapesIcon className="h-7 w-7 text-primary" /> Schémas à compléter
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Fais glisser chaque étiquette sur le bon repère numéroté. Ton meilleur score est
              conservé et remonte dans « Ma progression ».
            </p>

            {listQuery.isPending ? (
              <div className="flex items-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Chargement des schémas…
              </div>
            ) : (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="anatomy-list">
                {(listQuery.data ?? []).map((item) => {
                  const perfect = item.best_score === item.marker_count;
                  return (
                    <button
                      key={item.slug}
                      type="button"
                      data-testid={`anatomy-card-${item.slug}`}
                      onClick={() => setSlug(item.slug)}
                      className="group overflow-hidden rounded-2xl border border-border bg-card text-left transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-primary/50"
                    >
                      <div className="flex h-40 items-center justify-center overflow-hidden bg-white">
                        <img
                          src={item.image_url}
                          alt={item.title}
                          loading="lazy"
                          className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <div className="p-4">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-primary">
                          {item.system}
                        </p>
                        <p className="mt-1 font-heading text-lg font-bold text-foreground">
                          {item.title}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.hint}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="font-mono text-xs text-muted-foreground">
                            {item.marker_count} repères
                          </span>
                          {item.attempts > 0 ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px]",
                                perfect
                                  ? "bg-primary/15 text-primary"
                                  : "bg-secondary text-muted-foreground",
                              )}
                            >
                              <Trophy className="h-3 w-3" /> {item.best_score}/
                              {item.marker_count}
                            </span>
                          ) : (
                            <span className="font-mono text-[11px] text-muted-foreground/70">
                              jamais tenté
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : exerciseQuery.isPending || !exercise ? (
          <div className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Préparation de l'exercice…
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
                  {exercise.system}
                </p>
                <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-foreground">
                  {exercise.title}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">{exercise.hint}</p>
              </div>
              {result ? (
                <div
                  data-testid="anatomy-score"
                  className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-center"
                >
                  <p className="font-heading text-2xl font-bold text-foreground">
                    {result.score} / {result.total}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-primary">
                    meilleur : {result.best_score}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
              <div className="overflow-hidden rounded-2xl border border-border bg-white p-2">
                <img
                  src={exercise.image_url}
                  alt={`Schéma à compléter : ${exercise.title}`}
                  data-testid="anatomy-image"
                  className="mx-auto max-h-[70svh] w-full object-contain"
                />
              </div>

              <div className="flex flex-col gap-5">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Étiquettes à placer
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2" data-testid="anatomy-label-pool">
                    {remainingLabels.length === 0 ? (
                      <span className="text-sm text-muted-foreground">
                        Toutes les étiquettes sont placées.
                      </span>
                    ) : (
                      remainingLabels.map((label) => (
                        <button
                          key={label}
                          type="button"
                          data-testid={`anatomy-label-${label}`}
                          onPointerDown={(e) => {
                            if (result) return;
                            setDrag({ label, x: e.clientX, y: e.clientY, moved: false });
                          }}
                          className={cn(
                            "touch-none cursor-grab rounded-lg border px-3 py-1.5 text-sm transition-colors duration-200 active:cursor-grabbing",
                            drag?.label === label && drag.moved
                              ? "border-primary/40 bg-secondary text-muted-foreground"
                              : picked === label
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card text-foreground hover:border-primary/50",
                          )}
                        >
                          {label}
                        </button>
                      ))
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Glisse une étiquette sur son repère, ou touche-la puis touche le repère.
                  </p>
                </div>

                <div className="flex flex-col gap-2" data-testid="anatomy-slots">
                  {exercise.numbers.map((number) => {
                    const value = placed[number];
                    const isCorrect = result?.correct_numbers.includes(number);
                    const expected = result?.solution[String(number)];
                    return (
                      <div
                        key={number}
                        data-testid={`anatomy-slot-${number}`}
                        data-slot-number={number}
                        onClick={() => {
                          if (result) return;
                          if (picked) place(number, picked);
                          else if (value) clearSlot(number);
                        }}
                        className={cn(
                          "flex min-h-14 items-center gap-3 rounded-xl border-2 border-dashed p-3 transition-colors duration-200",
                          result
                            ? isCorrect
                              ? "border-primary/60 bg-primary/10"
                              : "border-destructive/60 bg-destructive/10"
                            : drag?.moved
                              ? "border-primary bg-primary/10"
                              : value
                                ? "border-solid border-border bg-card"
                                : "border-border bg-secondary/40 hover:border-primary/50",
                        )}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground font-heading text-sm font-bold text-background">
                          {number}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">
                            {value || (
                              <span className="text-muted-foreground">
                                Dépose l'étiquette ici
                              </span>
                            )}
                          </p>
                          {result && !isCorrect ? (
                            <p
                              data-testid={`anatomy-correction-${number}`}
                              className="truncate font-mono text-[11px] text-destructive"
                            >
                              réponse : {expected}
                            </p>
                          ) : null}
                        </div>
                        {result ? (
                          isCorrect ? (
                            <Check className="h-4 w-4 shrink-0 text-primary" />
                          ) : (
                            <X className="h-4 w-4 shrink-0 text-destructive" />
                          )
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2">
                  {result ? (
                    <Button
                      data-testid="anatomy-retry-button"
                      onClick={() => {
                        setResult(null);
                        setPlaced({});
                        void exerciseQuery.refetch();
                      }}
                    >
                      <RotateCcw className="h-4 w-4" /> Recommencer
                    </Button>
                  ) : (
                    <Button
                      data-testid="anatomy-submit-button"
                      disabled={submit.isPending || Object.keys(placed).length === 0}
                      onClick={() => submit.mutate()}
                    >
                      {submit.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Correction…
                        </>
                      ) : (
                        "Valider mes réponses"
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    data-testid="anatomy-clear-button"
                    onClick={() => {
                      setPlaced({});
                      setPicked(null);
                      setResult(null);
                    }}
                  >
                    Tout effacer
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
        {drag?.moved ? (
          <div
            data-testid="anatomy-drag-ghost"
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground shadow-lg"
            style={{ left: drag.x, top: drag.y }}
          >
            {drag.label}
          </div>
        ) : null}
      </main>
    </div>
  );
}
