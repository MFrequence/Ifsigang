import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Loader2 } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { RevisionCard, StudyMode } from "@/lib/types";
import StudyRunner from "@/components/StudyRunner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DailyRevisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Paquet du jour selon la méthode des J : cartes en retard d'abord, puis échues,
// puis de nouvelles cartes pour entrer dans le cycle.
export default function DailyRevisionDialog({ open, onOpenChange }: DailyRevisionDialogProps) {
  const [mode, setMode] = useState<StudyMode>("flash");
  const queryClient = useQueryClient();

  const deckQuery = useQuery({
    queryKey: ["revision-today"],
    queryFn: () => apiGet<RevisionCard[]>("/revision/today"),
    enabled: open,
    // Le paquet du jour ne doit pas se recharger sous les doigts pendant la session.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const cards = deckQuery.data ?? [];
  const overdue = cards.filter((c) => c.overdue_days > 0).length;
  const fresh = cards.filter((c) => c.is_new).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          // À la fermeture : le plan et le paquet du lendemain doivent refléter les réponses.
          void queryClient.invalidateQueries({ queryKey: ["revision-plan"] });
          void queryClient.invalidateQueries({ queryKey: ["revision-today"] });
        }
      }}
    >
      <DialogContent className="flex max-h-[92svh] max-w-2xl flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <CalendarCheck className="h-5 w-5 text-sky-700" /> Ma révision du jour
          </DialogTitle>
          <DialogDescription>
            {cards.length > 0
              ? `${cards.length} carte${cards.length > 1 ? "s" : ""} au programme${
                  overdue > 0 ? ` — dont ${overdue} en retard` : ""
                }${fresh > 0 ? `, ${fresh} nouvelle${fresh > 1 ? "s" : ""}` : ""}.`
              : "Sélection automatique selon la méthode des J (J0, J1, J3, J7, J15, J30)."}
          </DialogDescription>
        </DialogHeader>

        {deckQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Préparation de ton paquet…
          </div>
        ) : deckQuery.isError ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-slate-600">Impossible de préparer la révision du jour.</p>
            <Button variant="outline" onClick={() => void deckQuery.refetch()}>
              Réessayer
            </Button>
          </div>
        ) : cards.length === 0 ? (
          <div
            className="flex flex-col items-center gap-2 py-12 text-center"
            data-testid="daily-empty-state"
          >
            <p className="font-heading text-lg font-semibold text-slate-900">
              Rien à réviser aujourd'hui
            </p>
            <p className="max-w-sm text-sm leading-relaxed text-slate-500">
              Tout est à jour dans ton cycle des J. Reviens demain, ou dépose une nouvelle fiche
              pour alimenter ton paquet.
            </p>
          </div>
        ) : (
          <StudyRunner cards={cards} mode={mode} onModeChange={setMode} showContext showStage />
        )}
      </DialogContent>
    </Dialog>
  );
}
