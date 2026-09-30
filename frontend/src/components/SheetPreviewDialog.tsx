import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiGet } from "@/lib/api";
import { DOMAIN_MAP } from "@/lib/domains";
import { isTextReadable } from "@/lib/format";
import type { Sheet, SheetText } from "@/lib/types";

interface SheetPreviewDialogProps {
  sheet: Sheet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Lecture du contenu texte (TXT, DOCX) directement dans la boîte de dialogue. */
function TextPreview({ sheet }: { sheet: Sheet }) {
  const textQuery = useQuery({
    queryKey: ["sheet-text", sheet.id],
    queryFn: () => apiGet<SheetText>(`/sheets/${sheet.id}/text`),
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (textQuery.isPending) {
    return (
      <div
        data-testid="sheet-text-loading"
        className="flex h-[60vh] items-center justify-center gap-2 rounded-lg border border-border bg-secondary text-sm text-muted-foreground"
      >
        <Loader2 className="h-4 w-4 animate-spin" /> Lecture de la fiche…
      </div>
    );
  }

  if (textQuery.isError || !textQuery.data) {
    return (
      <div
        data-testid="sheet-text-error"
        className="flex h-[40vh] flex-col items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-6 text-center text-sm text-muted-foreground"
      >
        <FileText className="h-6 w-6 text-muted-foreground/60" />
        Le texte de cette fiche n'a pas pu être extrait (document scanné ou illisible).
        Télécharge-la pour l'ouvrir.
      </div>
    );
  }

  return (
    <div
      data-testid="sheet-text-content"
      className="max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-secondary p-5"
    >
      <p className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
        {textQuery.data.text}
      </p>
      {textQuery.data.truncated ? (
        <p className="mt-4 border-t border-border pt-3 text-xs italic text-muted-foreground">
          Aperçu tronqué — télécharge la fiche pour lire la suite.
        </p>
      ) : null}
    </div>
  );
}

export default function SheetPreviewDialog({ sheet, open, onOpenChange }: SheetPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {sheet && (
        <DialogContent className="flex max-h-[92svh] flex-col overflow-y-auto sm:max-w-4xl">
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
              className="h-[70vh] w-full rounded-lg border border-border bg-secondary"
            />
          ) : isTextReadable(sheet.mime) ? (
            <TextPreview sheet={sheet} />
          ) : (
            <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-lg border border-border bg-secondary p-4">
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
