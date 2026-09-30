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
import { isDocx } from "@/lib/format";
import type { Sheet, SheetHtml, SheetText } from "@/lib/types";

interface SheetPreviewDialogProps {
  sheet: Sheet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const READER_SHELL =
  "max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-secondary p-5";

function ReaderLoading() {
  return (
    <div
      data-testid="sheet-reader-loading"
      className="flex h-[60vh] items-center justify-center gap-2 rounded-lg border border-border bg-secondary text-sm text-muted-foreground"
    >
      <Loader2 className="h-4 w-4 animate-spin" /> Lecture de la fiche…
    </div>
  );
}

function ReaderError() {
  return (
    <div
      data-testid="sheet-reader-error"
      className="flex h-[40vh] flex-col items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-6 text-center text-sm text-muted-foreground"
    >
      <FileText className="h-6 w-6 text-muted-foreground/60" />
      Le contenu de cette fiche n'a pas pu être lu (document scanné ou illisible). Télécharge-la
      pour l'ouvrir.
    </div>
  );
}

/** Texte brut — secours quand la mise en forme n'est pas exploitable, et lecture des .txt. */
function TextPreview({ sheet }: { sheet: Sheet }) {
  const textQuery = useQuery({
    queryKey: ["sheet-text", sheet.id],
    queryFn: () => apiGet<SheetText>(`/sheets/${sheet.id}/text`),
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (textQuery.isPending) return <ReaderLoading />;
  if (textQuery.isError || !textQuery.data) return <ReaderError />;

  return (
    <div data-testid="sheet-text-content" className={READER_SHELL}>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
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

/**
 * DOCX rendu en HTML : titres, gras, listes, tableaux et images du document sont conservés.
 * Le HTML vient de mammoth côté serveur (sous-ensemble sémantique), la mise en forme
 * visuelle est celle du site pour rester lisible en thème clair comme sombre.
 */
function DocxPreview({ sheet }: { sheet: Sheet }) {
  const htmlQuery = useQuery({
    queryKey: ["sheet-html", sheet.id],
    queryFn: () => apiGet<SheetHtml>(`/sheets/${sheet.id}/html`),
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (htmlQuery.isPending) return <ReaderLoading />;
  // Mise en forme illisible (docx exotique) → on retombe sur le texte brut plutôt que sur une erreur.
  if (htmlQuery.isError || !htmlQuery.data?.html) return <TextPreview sheet={sheet} />;

  return (
    <div
      data-testid="sheet-html-content"
      className={`${READER_SHELL} text-sm leading-relaxed text-foreground
        [&_a]:text-primary [&_a]:underline
        [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-3 [&_blockquote]:italic
        [&_h1]:mb-2 [&_h1]:mt-5 [&_h1]:font-heading [&_h1]:text-2xl [&_h1]:font-bold
        [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-primary
        [&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:font-heading [&_h3]:text-lg [&_h3]:font-semibold
        [&_h4]:mb-1 [&_h4]:mt-3 [&_h4]:font-semibold
        [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg
        [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6
        [&_p]:my-2
        [&_strong]:font-semibold
        [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-lg
        [&_td]:border [&_td]:border-border [&_td]:p-2.5 [&_td]:align-top
        [&_th]:border [&_th]:border-border [&_th]:bg-card [&_th]:p-2.5 [&_th]:text-left`}
      dangerouslySetInnerHTML={{ __html: htmlQuery.data.html }}
    />
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
          ) : isDocx(sheet.mime) ? (
            <DocxPreview sheet={sheet} />
          ) : sheet.mime.startsWith("image/") ? (
            <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-lg border border-border bg-secondary p-4">
              <img
                src={`/api/sheets/${sheet.id}/file`}
                alt={`Aperçu de ${sheet.title}`}
                className="max-h-[65vh] rounded object-contain"
              />
            </div>
          ) : (
            <TextPreview sheet={sheet} />
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
