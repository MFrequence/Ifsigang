import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DOMAIN_MAP } from "@/lib/domains";
import type { Sheet } from "@/lib/types";

interface SheetPreviewDialogProps {
  sheet: Sheet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SheetPreviewDialog({ sheet, open, onOpenChange }: SheetPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {sheet && (
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="pr-8">{sheet.title}</DialogTitle>
            <DialogDescription>
              {DOMAIN_MAP[sheet.domain]?.label} · déposée par {sheet.author}
            </DialogDescription>
          </DialogHeader>
          {sheet.mime === "application/pdf" ? (
            <iframe
              title={`Aperçu de ${sheet.title}`}
              src={`/api/sheets/${sheet.id}/file`}
              className="h-[70vh] w-full rounded-lg border border-slate-200 bg-slate-100"
            />
          ) : (
            <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-4">
              <img
                src={`/api/sheets/${sheet.id}/file`}
                alt={`Aperçu de ${sheet.title}`}
                className="max-h-[65vh] rounded object-contain"
              />
            </div>
          )}
          <div className="flex justify-end">
            <a
              href={`/api/sheets/${sheet.id}/download`}
              className={buttonVariants({ size: "sm" })}
              onClick={() => onOpenChange(false)}
            >
              <Download className="h-4 w-4" /> Télécharger
            </a>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
