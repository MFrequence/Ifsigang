import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { RevisionCard, StudyMode } from "@/lib/types";
import StudyRunner from "@/components/StudyRunner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MistakesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Rejoue uniquement les cartes dont la dernière réponse était fausse, toutes fiches confondues.
export default function MistakesDialog({ open, onOpenChange }: MistakesDialogProps) {
  const [mode, setMode] = useState<StudyMode>("flash");
  const queryClient = useQueryClient();

  const deckQuery = useQuery({
    queryKey: ["revision-mistakes"],
    queryFn: () => apiGet<RevisionCard[]>("/revision/mistakes"),
    enabled: open,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const cards = deckQuery.data ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          void queryClient.invalidateQueries({ queryKey: ["revision-mistakes"] });
          void queryClient.invalidateQueries({ queryKey: ["revision-plan"] });
          void queryClient.invalidateQueries({ queryKey: ["revision-today"] });
        }
      }}
    >
      <DialogContent
        data-testid="mistakes-dialog"
        className="flex max-h-[92svh] max-w-2xl flex-col overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <RotateCcw className="h-5 w-5 text-primary" /> Réviser mes erreurs
          </DialogTitle>
          <DialogDescription>
            {cards.length > 0
              ? `${cards.length} carte${cards.length > 1 ? "s" : ""} ratée${
                  cards.length > 1 ? "s" : ""
                } lors de ta dernière tentative, toutes fiches confondues.`
              : "Les cartes que tu as ratées reviennent ici, tous cours confondus."}
          </DialogDescription>
        </DialogHeader>

        {deckQuery.isPending ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Recherche de tes erreurs…
          </div>
        ) : cards.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground" data-testid="mistakes-empty">
            Aucune erreur en attente — tout ce que tu as raté a déjà été revu. Bravo !
          </p>
        ) : (
          <StudyRunner cards={cards} mode={mode} onModeChange={setMode} showContext showStage />
        )}
      </DialogContent>
    </Dialog>
  );
}
