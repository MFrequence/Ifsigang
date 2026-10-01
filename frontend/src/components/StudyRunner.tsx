import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Loader2,
  Shuffle,
  Sparkles,
  X,
} from "lucide-react";
import { apiPost } from "@/lib/api";
import type { CardQuality, Flashcard, RevisionCard, StudyCard, StudyMode } from "@/lib/types";
import ReportCardDialog from "@/components/ReportCardDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type AnyCard = Flashcard | StudyCard | RevisionCard;

function contextOf(card: AnyCard): string | null {
  return "sheet_title" in card ? card.sheet_title : null;
}

function isDue(card: AnyCard): boolean {
  return "due" in card ? card.due : false;
}

function stageOf(card: AnyCard): { stage: string; next: string; isNew: boolean; overdue: number } | null {
  return "stage" in card
    ? { stage: card.stage, next: card.next_stage, isNew: card.is_new, overdue: card.overdue_days }
    : null;
}

interface StudyRunnerProps {
  cards: AnyCard[];
  mode: StudyMode;
  onModeChange: (mode: StudyMode) => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
  showContext?: boolean;
  showStage?: boolean;
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
  showStage = false,
}: StudyRunnerProps) {
  const [deck, setDeck] = useState<AnyCard[]>(cards);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [known, setKnown] = useState(0);
  const [missed, setMissed] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportedIds, setReportedIds] = useState<string[]>([]);
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
    mutationFn: (vars: { cardId: string; correct: boolean; quality?: CardQuality }) =>
      apiPost<unknown>("/progress/answer", {
        card_id: vars.cardId,
        correct: vars.correct,
        quality: vars.quality ?? null,
        mode: effectiveMode,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["progress"] });
      void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      void queryClient.invalidateQueries({ queryKey: ["revision-plan"] });
      void queryClient.invalidateQueries({ queryKey: ["revision-streak"] });
    },
  });

  // Auto-évaluation : facile → palier suivant, moyen → J3, à revoir → J1.
  const advance = (correct: boolean, quality?: CardQuality) => {
    if (!current) return;
    if (correct) setKnown((k) => k + 1);
    else setMissed((m) => m + 1);
    record.mutate({ cardId: current.id, correct, quality });
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
          className="font-heading text-3xl font-extrabold tracking-tight text-foreground"
          data-testid="study-score"
        >
          {known} / {total}
        </p>
        <p className="text-sm text-muted-foreground">
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

  const stage = stageOf(current);
  const isReported = current.reports > 0 || reportedIds.includes(current.id);

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className="font-mono text-xs uppercase tracking-wider text-muted-foreground"
            data-testid="study-progress"
          >
            Carte {index + 1} / {deck.length}
          </p>
          {showStage && stage ? (
            <Badge
              variant="outline"
              data-testid="study-stage-badge"
              className="border-primary/40 bg-accent text-accent-foreground"
            >
              {stage.isNew ? "Nouvelle" : stage.stage}
              {stage.overdue > 0 ? ` · +${stage.overdue}j de retard` : ""}
            </Badge>
          ) : null}
          {!showStage && isDue(current) ? (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
              À revoir
            </Badge>
          ) : null}
          {isReported ? (
            <Badge
              variant="outline"
              data-testid="study-reported-badge"
              className="border-amber-300 bg-amber-50 text-amber-900"
            >
              Signalée
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
            aria-label="Signaler une carte erronée"
            data-testid="study-report-button"
            onClick={() => setReportOpen(true)}
          >
            <Flag className="h-4 w-4" />
          </Button>
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

      {/* Zone défilable : avec 4 propositions longues, le contenu ne doit jamais pousser
          la barre d'actions hors de l'écran. */}
      <div className="max-h-[46svh] min-h-[200px] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-6 shadow-xs">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id + (revealed ? "-r" : "") + effectiveMode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {showContext && contextOf(current) ? (
              <p className="mb-2 truncate text-xs text-muted-foreground/70">{contextOf(current)}</p>
            ) : null}
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground/70">Question</p>
            <p
              className="mt-2 font-heading text-xl font-semibold leading-snug text-foreground"
              data-testid="study-question"
            >
              {current.question}
            </p>

            {effectiveMode === "quiz" ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2" data-testid="quiz-options">
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
                        !showState && "border-border bg-card hover:border-primary/60 hover:bg-accent/60",
                        showState && isCorrect && "border-emerald-300 bg-emerald-50 text-emerald-900",
                        showState &&
                          isPicked &&
                          !isCorrect &&
                          "border-rose-300 bg-rose-50 text-rose-900",
                        showState && !isPicked && !isCorrect && "border-border text-muted-foreground/70",
                      )}
                    >
                      {showState && isCorrect ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      ) : showState && isPicked ? (
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      ) : (
                        <span className="mt-0.5 font-mono text-xs text-muted-foreground/70">
                          {String.fromCharCode(65 + i)}
                        </span>
                      )}
                      <span>{option}</span>
                    </button>
                  );
                })}
              </div>
            ) : revealed ? (
              <div className="mt-4 rounded-xl bg-accent p-4" data-testid="study-answer-panel">
                <p className="font-mono text-xs uppercase tracking-wider text-primary">Réponse</p>
                <p className="mt-1 text-base leading-relaxed text-foreground">{current.answer}</p>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Barre d'actions collée en bas : toujours atteignable, quelle que soit la
          longueur des réponses. */}
      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-2 bg-popover px-1 pb-1 pt-2">
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
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
              data-testid="study-known-button"
              title="Palier suivant (J7, J15, J30…)"
              onClick={() => advance(true, "easy")}
            >
              Facile
            </Button>
            <Button
              variant="outline"
              className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
              data-testid="study-medium-button"
              title="Notion fragile : retour à J3"
              onClick={() => advance(true, "medium")}
            >
              Moyen
            </Button>
            <Button
              variant="outline"
              className="border-rose-500/40 text-destructive hover:bg-destructive/10"
              data-testid="study-review-button"
              title="Retour à J1 : revue dès demain"
              onClick={() => advance(false, "hard")}
            >
              À revoir
            </Button>
          </div>
        )}

        {/* En QCM, « Carte suivante » fait déjà avancer : pas de second bouton. */}
        <Button
          variant="outline"
          size="sm"
          data-testid="study-next-button"
          className={effectiveMode === "quiz" ? "hidden" : undefined}
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

      <ReportCardDialog
        cardId={current.id}
        question={current.question}
        open={reportOpen}
        onOpenChange={setReportOpen}
        onReported={() => setReportedIds((ids) => [...ids, current.id])}
      />
    </div>
  );
}
