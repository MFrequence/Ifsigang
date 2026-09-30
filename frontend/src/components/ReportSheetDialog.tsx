import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import type { Sheet, SheetReport } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ReportSheetDialogProps {
  sheet: Sheet;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Signaler une fiche : le signalement remonte dans l'espace admin.
export default function ReportSheetDialog({ sheet, open, onOpenChange }: ReportSheetDialogProps) {
  const [reason, setReason] = useState("");

  const report = useMutation({
    mutationFn: () => apiPost<SheetReport>(`/sheets/${sheet.id}/report`, { reason }),
    onSuccess: () => {
      setReason("");
      onOpenChange(false);
      toast.success("Fiche signalée — l'admin va vérifier");
    },
    onError: () => toast.error("Signalement impossible — réessaie"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="report-sheet-dialog"
        className="flex max-h-[92svh] max-w-md flex-col overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <Flag className="h-5 w-5 text-destructive" /> Signaler cette fiche
          </DialogTitle>
          <DialogDescription>
            « {sheet.title} » — explique le problème (contenu faux, hors-sujet, doublon, fichier
            illisible…). Rien n'est supprimé automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="report-reason">Motif (optionnel)</Label>
          <Textarea
            id="report-reason"
            data-testid="report-sheet-reason-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            rows={4}
            placeholder="Ex. : les posologies de la page 2 sont fausses"
          />
        </div>

        <Button
          data-testid="report-sheet-submit"
          disabled={report.isPending}
          onClick={() => report.mutate()}
        >
          {report.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Envoi…
            </>
          ) : (
            "Envoyer le signalement"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
