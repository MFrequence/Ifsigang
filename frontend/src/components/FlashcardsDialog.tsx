import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Shuffle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import type { Flashcard, Sheet } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function detailOf(err: unknown): string | null {
  if (err instanceof ApiError && typeof err.body === "object" && err.body !== null && "detail" in err.body) {
    return String((err.body as { detail: unknown }).detail);
  }
  return null;
}

interface FlashcardsDialogProps {
  sheet: Sheet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Paquet de flashcards d'une fiche : parcours question → réponse, avec auto-évaluation
// ("Je savais" / "À revoir") et génération/régénération par l'IA.
export default function FlashcardsDialog({ sheet, open, onOpenChange }: FlashcardsDialogProps) {
  const [deck, setDeck] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [known, setKnown] = useState<string[]>([]);
  const [missed, setMissed] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const cardsQuery = useQuery({
    queryKey: ["flashcards", sheet?.id],
    queryFn: () => apiGet<Flashcard[]>(`/sheets/${sheet?.id}/flashcards`),
    enabled: open && sheet !== null,
  });

  useEffect(() => {
    if (cardsQuery.data) {
      setDeck(cardsQuery.data);
      setIndex(0);
      setRevealed(false);
      setKnown([]);
      setMissed([]);
    }
  }, [cardsQuery.data]);

  const current = deck[index];
  const finished = deck.length > 0 && index >= deck.length;

  const generate = useMutation({
    mutationFn: () => apiPost<Flashcard[]>(`/sheets/${sheet?.id}/flashcards/generate`),
    onSuccess: (cards) => {
      void queryClient.invalidateQueries({ queryKey: ["flashcards"] });
      toast.success(`${cards.length} flashcards prêtes`);
    },
    onError: (err: unknown) => {
      toast.error(detailOf(err) ?? "Génération impossible — réessaie");
    },
  });

  const restart = () => {
    setIndex(0);
    setRevealed(false);
    setKnown([]);
    setMissed([]);
  };

  const go = (delta: number) => {
    setIndex((i) => Math.min(Math.max(i + delta, 0), deck.length));
    setRevealed(false);
  };

  const grade = (ok: boolean) => {
    if (!current) return;
    if (ok) setKnown((k) => [...k, current.id]);
    else setMissed((m) => [...m, current.id]);
    setIndex((i) => i + 1);
    setRevealed(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pr-8">Réviser — {sheet?.title}</DialogTitle>
          <DialogDescription>
            Flashcards générées à partir du contenu de la fiche. Réponds dans ta tête, puis révèle.
          </DialogDescription>
        </DialogHeader>

        {cardsQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Chargement des flashcards…
          </div>
        ) : cardsQuery.isError ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-slate-600">Impossible de charger les flashcards.</p>
            <Button variant="outline" onClick={() => void cardsQuery.refetch()}>
              Réessayer
            </Button>
          </div>
        ) : deck.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="font-heading text-lg font-semibold text-slate-900">
              Pas encore de flashcards
            </p>
            <p className="max-w-sm text-sm leading-relaxed text-slate-500">
              Génère un paquet de cartes question/réponse à partir du contenu de cette fiche — la
              génération prend quelques secondes.
            </p>
            <Button
              data-testid="flashcard-generate-button"
              className="transition-transform duration-75 active:scale-[0.98]"
              disabled={generate.isPending}
              onClick={() => sheet && generate.mutate()}
            >
              {generate.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Génération…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Générer les flashcards
                </>
              )}
            </Button>
          </div>
        ) : finished ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">
              {known.length} / {deck.length}
            </p>
            <p className="text-sm text-slate-600">
              {missed.length === 0
                ? "Parfait, toutes les cartes sont sues !"
                : `${missed.length} carte${missed.length > 1 ? "s" : ""} à revoir.`}
            </p>
            <Button
              data-testid="flashcard-restart-button"
              className="transition-transform duration-75 active:scale-[0.98]"
              onClick={restart}
            >
              Recommencer
            </Button>
          </div>
        ) : current ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p
                className="font-mono text-xs uppercase tracking-wider text-slate-500"
                data-testid="flashcard-progress"
              >
                Carte {index + 1} / {deck.length}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Mélanger le paquet"
                  data-testid="flashcard-shuffle-button"
                  onClick={() => {
                    setDeck((d) => shuffled(d));
                    restart();
                  }}
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Régénérer le paquet"
                  data-testid="flashcard-regenerate-button"
                  disabled={generate.isPending}
                  onClick={() => sheet && generate.mutate()}
                >
                  {generate.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="min-h-[220px] rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.id + (revealed ? "-revealed" : "")}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  <p className="font-mono text-xs uppercase tracking-wider text-slate-400">
                    Question
                  </p>
                  <p
                    className="mt-2 font-heading text-xl font-semibold leading-snug text-slate-900"
                    data-testid="flashcard-question"
                  >
                    {current.question}
                  </p>
                  {revealed ? (
                    <div className="mt-4 rounded-xl bg-sky-50 p-4" data-testid="flashcard-answer-panel">
                      <p className="font-mono text-xs uppercase tracking-wider text-sky-700">
                        Réponse
                      </p>
                      <p className="mt-1 text-base leading-relaxed text-slate-800">
                        {current.answer}
                      </p>
                    </div>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                data-testid="flashcard-prev-button"
                disabled={index === 0}
                onClick={() => go(-1)}
              >
                <ChevronLeft className="h-4 w-4" /> Précédent
              </Button>
              {!revealed ? (
                <Button data-testid="flashcard-reveal-button" onClick={() => setRevealed(true)}>
                  Voir la réponse
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                    data-testid="flashcard-known-button"
                    onClick={() => grade(true)}
                  >
                    Je savais
                  </Button>
                  <Button
                    variant="outline"
                    className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                    data-testid="flashcard-review-button"
                    onClick={() => grade(false)}
                  >
                    À revoir
                  </Button>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                data-testid="flashcard-next-button"
                disabled={index >= deck.length - 1}
                onClick={() => go(1)}
              >
                Suivant <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
