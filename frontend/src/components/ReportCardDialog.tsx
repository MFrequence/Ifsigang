import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import type { CardReport } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ReportCardDialogProps {
  cardId: string | null;
  question: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReported?: () => void;
}

// Signaler une carte erronée : tout le monde peut lever la main, l'auteur régénère ensuite.
export default function ReportCardDialog({
  cardId,
  question,
  open,
  onOpenChange,
  onReported,
}: ReportCardDialogProps) {
  const [reason, setReason] = useState("");

  const report = useMutation({
    mutationFn: () =>
      apiPost<CardReport>(`/flashcards/${cardId}/report`, { reason: reason.trim() }),
    onSuccess: () => {
      toast.success("Carte signalée — merci, l'auteur pourra la corriger");
      setReason("");
      onOpenChange(false);
      onReported?.();
    },
    onError: () => toast.error("Signalement impossible — réessaie"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92svh] max-w-md flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-amber-600" /> Signaler cette carte
          </DialogTitle>
          <DialogDescription>
            La carte restera visible, mais sera marquée comme à vérifier pour toute la promo.
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
          {question}
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="report-reason">Ce qui est faux (facultatif)</Label>
          <Textarea
            id="report-reason"
            data-testid="report-reason-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. la bonne réponse est 12 à 20 cycles/min, pas 20 à 30"
            rows={3}
            maxLength={300}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            data-testid="report-cancel-button"
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button
            data-testid="report-submit-button"
            disabled={report.isPending || cardId === null}
            onClick={() => report.mutate()}
          >
            {report.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Envoi…
              </>
            ) : (
              "Signaler la carte"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
