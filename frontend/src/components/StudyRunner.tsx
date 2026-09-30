import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronLeft, ChevronRight, Loader2, Shuffle, Sparkles, X } from "lucide-react";
import { apiPost } from "@/lib/api";
import type { Flashcard, StudyCard, StudyMode } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type AnyCard = Flashcard | StudyCard;

function contextOf(card: AnyCard): string | null {
  return "sheet_title" in card ? card.sheet_title : null;
}

function isDue(card: AnyCard): boolean {
  return "due" in card ? card.due : false;
}

interface StudyRunnerProps {
  cards: AnyCard[];
  mode: StudyMode;
  onModeChange: (mode: StudyMode) => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
  showContext?: boolean;
}

// Moteur de révision partagé : mode flashcard (auto-évaluation) ou QCM (4 propositions).
// Chaque réponse est enregistrée côté serveur pour alimenter la progression.
export default function StudyRunner({
  cards,
  mode,
  onModeChange,
  onRegenerate,
  regenerating = false,
  showContext = false,
}: StudyRunnerProps) {
  const [deck, setDeck] = useState<AnyCard[]>(cards);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [known, setKnown] = useState(0);
  const [missed, setMissed] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    setDeck(cards);
    setIndex(0);
    setRevealed(false);
    setPicked(null);
    setKnown(0);
    setMissed(0);
  }, [cards]);

  const current = deck[index];
  const finished = deck.length > 0 && index >= deck.length;

  // Les cartes sans distracteurs ne peuvent pas alimenter un QCM.
  const quizReady = useMemo(() => deck.filter((c) => c.distractors.length >= 2).length, [deck]);
  const effectiveMode: StudyMode =
    mode === "quiz" && current && current.distractors.length >= 2 ? "quiz" : "flash";

  const options = useMemo(() => {
    if (!current || effectiveMode !== "quiz") return [];
    return shuffled([current.answer, ...current.distractors.slice(0, 3)]);
  }, [current, effectiveMode]);

  const record = useMutation({
    mutationFn: (vars: { cardId: string; correct: boolean }) =>
      apiPost<unknown>("/progress/answer", {
        card_id: vars.cardId,
        correct: vars.correct,
        mode: effectiveMode,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["progress"] });
      void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });

  const advance = (correct: boolean) => {
    if (!current) return;
    if (correct) setKnown((k) => k + 1);
    else setMissed((m) => m + 1);
    record.mutate({ cardId: current.id, correct });
    setIndex((i) => i + 1);
    setRevealed(false);
    setPicked(null);
  };

  const restart = () => {
    setIndex(0);
    setRevealed(false);
    setPicked(null);
    setKnown(0);
    setMissed(0);
  };

  if (deck.length === 0) return null;

  if (finished) {
    const total = known + missed;
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p
          className="font-heading text-3xl font-extrabold tracking-tight text-slate-900"
          data-testid="study-score"
        >
          {known} / {total}
        </p>
        <p className="text-sm text-slate-600">
          {missed === 0
            ? "Parfait, toutes les cartes sont sues !"
            : `${missed} carte${missed > 1 ? "s" : ""} à revoir — elles reviendront en priorité.`}
        </p>
        <Button
          data-testid="study-restart-button"
          className="transition-transform duration-75 active:scale-[0.98]"
          onClick={restart}
        >
          Recommencer
        </Button>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p
            className="font-mono text-xs uppercase tracking-wider text-slate-500"
            data-testid="study-progress"
          >
            Carte {index + 1} / {deck.length}
          </p>
          {isDue(current) ? (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
              À revoir
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={mode} onValueChange={(v: string) => onModeChange(v as StudyMode)}>
            <TabsList variant="line">
              <TabsTrigger value="flash" data-testid="study-mode-flash">
                Flashcards
              </TabsTrigger>
              <TabsTrigger value="quiz" data-testid="study-mode-quiz" disabled={quizReady === 0}>
                QCM
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mélanger le paquet"
            data-testid="study-shuffle-button"
            onClick={() => {
              setDeck((d) => shuffled(d));
              restart();
            }}
          >
            <Shuffle className="h-4 w-4" />
          </Button>
          {onRegenerate ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Régénérer le paquet"
              data-testid="study-regenerate-button"
              disabled={regenerating}
              onClick={onRegenerate}
            >
              {regenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
          ) : null}
        </div>
      </div>

      {mode === "quiz" && effectiveMode === "flash" ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Cette carte n'a pas de propositions QCM — régénère le paquet pour en obtenir.
        </p>
      ) : null}

      <div className="min-h-[220px] rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id + (revealed ? "-r" : "") + effectiveMode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {showContext && contextOf(current) ? (
              <p className="mb-2 truncate text-xs text-slate-400">{contextOf(current)}</p>
            ) : null}
            <p className="font-mono text-xs uppercase tracking-wider text-slate-400">Question</p>
            <p
              className="mt-2 font-heading text-xl font-semibold leading-snug text-slate-900"
              data-testid="study-question"
            >
              {current.question}
            </p>

            {effectiveMode === "quiz" ? (
              <div className="mt-4 flex flex-col gap-2" data-testid="quiz-options">
                {options.map((option, i) => {
                  const isCorrect = option === current.answer;
                  const isPicked = picked === option;
                  const showState = picked !== null;
                  return (
                    <button
                      key={`${current.id}-${i}`}
                      type="button"
                      data-testid={`quiz-option-${i}`}
                      disabled={showState}
                      onClick={() => setPicked(option)}
                      className={cn(
                        "flex items-start gap-2 rounded-xl border px-4 py-3 text-left text-sm leading-relaxed transition-colors duration-150",
                        !showState && "border-slate-200 bg-white hover:border-sky-400 hover:bg-sky-50/60",
                        showState && isCorrect && "border-emerald-300 bg-emerald-50 text-emerald-900",
                        showState &&
                          isPicked &&
                          !isCorrect &&
                          "border-rose-300 bg-rose-50 text-rose-900",
                        showState && !isPicked && !isCorrect && "border-slate-200 text-slate-400",
                      )}
                    >
                      {showState && isCorrect ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      ) : showState && isPicked ? (
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                      ) : (
                        <span className="mt-0.5 font-mono text-xs text-slate-400">
                          {String.fromCharCode(65 + i)}
                        </span>
                      )}
                      <span>{option}</span>
                    </button>
                  );
                })}
              </div>
            ) : revealed ? (
              <div className="mt-4 rounded-xl bg-sky-50 p-4" data-testid="study-answer-panel">
                <p className="font-mono text-xs uppercase tracking-wider text-sky-700">Réponse</p>
                <p className="mt-1 text-base leading-relaxed text-slate-800">{current.answer}</p>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          data-testid="study-prev-button"
          disabled={index === 0}
          onClick={() => {
            setIndex((i) => Math.max(i - 1, 0));
            setRevealed(false);
            setPicked(null);
          }}
        >
          <ChevronLeft className="h-4 w-4" /> Précédent
        </Button>

        {effectiveMode === "quiz" ? (
          <Button
            data-testid="quiz-validate-button"
            disabled={picked === null}
            onClick={() => advance(picked === current.answer)}
          >
            Carte suivante
          </Button>
        ) : !revealed ? (
          <Button data-testid="study-reveal-button" onClick={() => setRevealed(true)}>
            Voir la réponse
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
              data-testid="study-known-button"
              onClick={() => advance(true)}
            >
              Je savais
            </Button>
            <Button
              variant="outline"
              className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
              data-testid="study-review-button"
              onClick={() => advance(false)}
            >
              À revoir
            </Button>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          data-testid="study-next-button"
          disabled={index >= deck.length - 1}
          onClick={() => {
            setIndex((i) => Math.min(i + 1, deck.length - 1));
            setRevealed(false);
            setPicked(null);
          }}
        >
          Suivant <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
