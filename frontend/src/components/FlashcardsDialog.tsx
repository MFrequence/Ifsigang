import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import type { Flashcard, Sheet, StudyMode } from "@/lib/types";
import StudyRunner from "@/components/StudyRunner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

// Révision d'UNE fiche : flashcards ou QCM, avec génération/régénération IA.
export default function FlashcardsDialog({ sheet, open, onOpenChange }: FlashcardsDialogProps) {
  const [mode, setMode] = useState<StudyMode>("flash");
  const queryClient = useQueryClient();

  const cardsQuery = useQuery({
    queryKey: ["flashcards", sheet?.id],
    queryFn: () => apiGet<Flashcard[]>(`/sheets/${sheet?.id}/flashcards`),
    enabled: open && sheet !== null,
  });

  const generate = useMutation({
    mutationFn: () => apiPost<Flashcard[]>(`/sheets/${sheet?.id}/flashcards/generate`),
    onSuccess: (cards) => {
      void queryClient.invalidateQueries({ queryKey: ["flashcards"] });
      toast.success(`${cards.length} flashcards prêtes`);
    },
    onError: (err: unknown) => toast.error(detailOf(err) ?? "Génération impossible — réessaie"),
  });

  const cards = cardsQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92svh] max-w-2xl flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-8">Réviser — {sheet?.title}</DialogTitle>
          <DialogDescription>
            Flashcards et QCM générés à partir du contenu de la fiche.
          </DialogDescription>
        </DialogHeader>

        {cardsQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Chargement des cartes…
          </div>
        ) : cardsQuery.isError ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-slate-600">Impossible de charger les cartes.</p>
            <Button variant="outline" onClick={() => void cardsQuery.refetch()}>
              Réessayer
            </Button>
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="font-heading text-lg font-semibold text-slate-900">
              Pas encore de cartes
            </p>
            <p className="max-w-sm text-sm leading-relaxed text-slate-500">
              Génère un paquet de questions/réponses (et leurs propositions QCM) à partir du contenu
              de cette fiche — quelques secondes suffisent.
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
                  <Sparkles className="h-4 w-4" /> Générer les cartes
                </>
              )}
            </Button>
          </div>
        ) : (
          <StudyRunner
            cards={cards}
            mode={mode}
            onModeChange={setMode}
            onRegenerate={() => sheet && generate.mutate()}
            regenerating={generate.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
