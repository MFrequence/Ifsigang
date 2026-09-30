import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Search,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiGet } from "@/lib/api";
import { DOMAIN_MAP } from "@/lib/domains";
import { isDocx } from "@/lib/format";
import type { Sheet, SheetHtml, SheetText } from "@/lib/types";

interface SheetPreviewDialogProps {
  sheet: Sheet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MIN_QUERY = 2;

/** Styles appliqués au HTML injecté (mammoth) — titres, tableaux, images, listes. */
const RENDER_CLASSES = `text-sm leading-relaxed text-foreground
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
  [&_th]:border [&_th]:border-border [&_th]:bg-card [&_th]:p-2.5 [&_th]:text-left`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Surligne chaque occurrence dans les nœuds texte et renvoie le nombre de trouvailles. */
function highlight(container: HTMLElement, pristine: string, query: string): number {
  container.innerHTML = pristine;
  const needle = query.trim().toLowerCase();
  if (needle.length < MIN_QUERY) return 0;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  let count = 0;
  for (const node of nodes) {
    const text = node.nodeValue ?? "";
    const lower = text.toLowerCase();
    if (!lower.includes(needle)) continue;

    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (;;) {
      const at = lower.indexOf(needle, cursor);
      if (at === -1) {
        fragment.appendChild(document.createTextNode(text.slice(cursor)));
        break;
      }
      if (at > cursor) fragment.appendChild(document.createTextNode(text.slice(cursor, at)));
      const mark = document.createElement("mark");
      mark.dataset.hit = String(count);
      mark.className = "rounded bg-amber-300/60 px-0.5 text-foreground";
      mark.textContent = text.slice(at, at + needle.length);
      fragment.appendChild(mark);
      count += 1;
      cursor = at + needle.length;
    }
    node.parentNode?.replaceChild(fragment, node);
  }
  return count;
}

/** Zone de lecture : contenu (HTML ou texte échappé) + recherche interne avec navigation. */
function Reader({ pristine, truncated }: { pristine: string; truncated?: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [count, setCount] = useState(0);
  const [index, setIndex] = useState(0);

  // Le contenu est repeint depuis la version d'origine à chaque frappe (pas de surlignage cumulé).
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const hits = highlight(container, pristine, query);
    setCount(hits);
    setIndex(0);
  }, [pristine, query]);

  // Saut au résultat courant.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || count === 0) return;
    const marks = container.querySelectorAll<HTMLElement>("mark[data-hit]");
    marks.forEach((mark, i) => {
      mark.classList.toggle("bg-amber-300/60", i !== index);
      mark.classList.toggle("bg-amber-400", i === index);
      mark.classList.toggle("ring-2", i === index);
      mark.classList.toggle("ring-amber-500", i === index);
    });
    marks[index]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [index, count, query]);

  const step = (delta: number) => {
    if (count === 0) return;
    setIndex((current) => (current + delta + count) % count);
  };

  const searching = query.trim().length >= MIN_QUERY;

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
            aria-hidden
          />
          <Input
            data-testid="sheet-reader-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                step(event.shiftKey ? -1 : 1);
              }
            }}
            placeholder="Rechercher dans la fiche…"
            aria-label="Rechercher dans la fiche"
            className="pl-9 pr-8"
          />
          {query ? (
            <button
              type="button"
              data-testid="sheet-reader-search-clear"
              aria-label="Effacer la recherche"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        {searching ? (
          <div className="flex items-center gap-1.5">
            <span
              data-testid="sheet-reader-search-count"
              className="text-xs tabular-nums text-muted-foreground"
            >
              {count === 0 ? "Aucun résultat" : `${index + 1} / ${count}`}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              data-testid="sheet-reader-search-prev"
              aria-label="Résultat précédent"
              disabled={count === 0}
              onClick={() => step(-1)}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              data-testid="sheet-reader-search-next"
              aria-label="Résultat suivant"
              disabled={count === 0}
              onClick={() => step(1)}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>

      <div
        ref={containerRef}
        data-testid="sheet-reader-content"
        className={`min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-secondary p-5 ${RENDER_CLASSES}`}
      />
      {truncated ? (
        <p className="shrink-0 text-xs italic text-muted-foreground">
          Aperçu tronqué — télécharge la fiche pour lire la suite.
        </p>
      ) : null}
    </>
  );
}

function ReaderLoading() {
  return (
    <div
      data-testid="sheet-reader-loading"
      className="flex min-h-0 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-secondary text-sm text-muted-foreground"
    >
      <Loader2 className="h-4 w-4 animate-spin" /> Lecture de la fiche…
    </div>
  );
}

function ReaderError() {
  return (
    <div
      data-testid="sheet-reader-error"
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-6 text-center text-sm text-muted-foreground"
    >
      <FileText className="h-6 w-6 text-muted-foreground/60" />
      Le contenu de cette fiche n'a pas pu être lu (document scanné ou illisible). Télécharge-la
      pour l'ouvrir.
    </div>
  );
}

/** TXT (et secours des DOCX illisibles) : texte brut échappé, recherche incluse. */
function TextReader({ sheet }: { sheet: Sheet }) {
  const textQuery = useQuery({
    queryKey: ["sheet-text", sheet.id],
    queryFn: () => apiGet<SheetText>(`/sheets/${sheet.id}/text`),
    refetchOnWindowFocus: false,
    retry: false,
  });

  const pristine = useMemo(
    () =>
      textQuery.data
        ? `<p style="white-space:pre-wrap">${escapeHtml(textQuery.data.text)}</p>`
        : "",
    [textQuery.data],
  );

  if (textQuery.isPending) return <ReaderLoading />;
  if (textQuery.isError || !textQuery.data) return <ReaderError />;
  return <Reader pristine={pristine} truncated={textQuery.data.truncated} />;
}

/** DOCX : HTML produit par mammoth côté serveur (titres, tableaux, images conservés). */
function DocxReader({ sheet }: { sheet: Sheet }) {
  const htmlQuery = useQuery({
    queryKey: ["sheet-html", sheet.id],
    queryFn: () => apiGet<SheetHtml>(`/sheets/${sheet.id}/html`),
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (htmlQuery.isPending) return <ReaderLoading />;
  // Mise en forme illisible → on retombe sur le texte brut plutôt que sur une erreur.
  if (htmlQuery.isError || !htmlQuery.data?.html) return <TextReader sheet={sheet} />;
  return <Reader pristine={htmlQuery.data.html} />;
}

export default function SheetPreviewDialog({ sheet, open, onOpenChange }: SheetPreviewDialogProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {sheet && (
        <DialogContent
          data-testid="sheet-reader-dialog"
          data-expanded={expanded}
          className={
            expanded
              ? "flex h-[96svh] max-w-[98vw] flex-col gap-3 sm:max-w-[98vw]"
              : "flex h-[88svh] flex-col gap-3 sm:max-w-4xl"
          }
        >
          <DialogHeader className="shrink-0 pr-20">
            <DialogTitle>{sheet.title}</DialogTitle>
            <DialogDescription>
              {DOMAIN_MAP[sheet.domain]?.label} · déposée par {sheet.author}
            </DialogDescription>
          </DialogHeader>

          <Button
            variant="ghost"
            size="icon-sm"
            data-testid="sheet-reader-fullscreen-toggle"
            aria-pressed={expanded}
            aria-label={expanded ? "Quitter le plein écran" : "Lire en plein écran"}
            title={expanded ? "Quitter le plein écran" : "Lire en plein écran"}
            onClick={() => setExpanded((value) => !value)}
            className="absolute right-12 top-4 text-muted-foreground hover:text-foreground"
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          {sheet.mime === "application/pdf" ? (
            <iframe
              title={`Aperçu de ${sheet.title}`}
              src={`/api/sheets/${sheet.id}/file`}
              className="min-h-0 w-full flex-1 rounded-lg border border-border bg-secondary"
            />
          ) : isDocx(sheet.mime) ? (
            <DocxReader sheet={sheet} />
          ) : sheet.mime.startsWith("image/") ? (
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg border border-border bg-secondary p-4">
              <img
                src={`/api/sheets/${sheet.id}/file`}
                alt={`Aperçu de ${sheet.title}`}
                className="max-h-full rounded object-contain"
              />
            </div>
          ) : (
            <TextReader sheet={sheet} />
          )}

          <div className="flex shrink-0 justify-end">
            <a
              href={`/api/sheets/${sheet.id}/download`}
              data-testid="sheet-reader-download-link"
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
