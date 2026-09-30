import { useState } from "react";
import { Calendar, Download, Eye, FileText, Flag, Image as ImageIcon, Layers, MessagesSquare, Star, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ReportSheetDialog from "@/components/ReportSheetDialog";
import { DOMAIN_MAP } from "@/lib/domains";
import { formatBytes, formatDate, isPreviewable } from "@/lib/format";
import type { Sheet } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SheetCardProps {
  sheet: Sheet;
  currentUserId: string;
  onPreview: (sheet: Sheet) => void;
  onRevise: (sheet: Sheet) => void;
  onDelete: (sheet: Sheet) => void;
  deleting: boolean;
  favorite: boolean;
  onToggleFavorite: (sheet: Sheet, next: boolean) => void;
  questionCount?: number;
  onOpenQuestions: (sheet: Sheet) => void;
}

export default function SheetCard({
  sheet,
  currentUserId,
  onPreview,
  onRevise,
  onDelete,
  deleting,
  favorite,
  onToggleFavorite,
  questionCount = 0,
  onOpenQuestions,
}: SheetCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // Chacun ne supprime que ses propres fiches ; l'admin passe par la page /admin.
  const isOwner = sheet.uploader_id === currentUserId;
  const domain = DOMAIN_MAP[sheet.domain];
  const Icon = sheet.mime.startsWith("image/") ? ImageIcon : FileText;

  return (
    <Card
      data-testid={`sheet-card-${sheet.id}`}
      className={cn(
        "flex h-full flex-col gap-3 border-l-4 p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-md",
        domain.borderAccent,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={favorite ? "Retirer des favoris" : "Épingler en favori"}
            aria-pressed={favorite}
            title={favorite ? "Retirer des favoris" : "Épingler en favori"}
            data-testid={`sheet-favorite-button-${sheet.id}`}
            onClick={() => onToggleFavorite(sheet, !favorite)}
            className={cn(
              "transition-transform duration-100 active:scale-90",
              favorite ? "text-amber-400 hover:text-amber-300" : "text-muted-foreground/60 hover:text-amber-400",
            )}
          >
            <Star className={cn("h-4 w-4", favorite && "fill-current")} />
          </Button>
          {sheet.unit ? (
            <Badge variant="outline" className="border-border text-muted-foreground">
              {sheet.unit}
            </Badge>
          ) : null}
          <Badge variant="outline" className={domain.badge}>
            {domain.label}
          </Badge>
          {isOwner ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground/70 hover:text-destructive"
              aria-label="Supprimer la fiche"
              data-testid={`sheet-delete-button-${sheet.id}`}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground/70 hover:text-destructive"
              aria-label="Signaler la fiche"
              title="Signaler cette fiche"
              data-testid={`sheet-report-button-${sheet.id}`}
              onClick={() => setReportOpen(true)}
            >
              <Flag className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-heading text-lg font-semibold leading-snug text-foreground">
          {sheet.title}
        </h3>
        {sheet.description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {sheet.description}
          </p>
        ) : null}
        <p className="mt-1 truncate text-xs text-muted-foreground/70">{sheet.filename}</p>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <User className="h-3.5 w-3.5" />
          {sheet.author}
        </span>
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(sheet.created_at)}
        </span>
        <span>{formatBytes(sheet.size)}</span>
        <span className="inline-flex items-center gap-1">
          <Download className="h-3.5 w-3.5" />
          {sheet.downloads}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          data-testid={`sheet-questions-button-${sheet.id}`}
          onClick={() => onOpenQuestions(sheet)}
          title="Entraide de promo : questions et réponses"
        >
          <MessagesSquare className="h-4 w-4" /> Entraide
          {questionCount > 0 ? (
            <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-xs text-primary">
              {questionCount}
            </span>
          ) : null}
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-testid={`sheet-revise-button-${sheet.id}`}
          onClick={() => onRevise(sheet)}
        >
          <Layers className="h-4 w-4" /> Réviser
        </Button>
        {isPreviewable(sheet.mime) && (
          <Button
            variant="outline"
            size="sm"
            data-testid={`sheet-preview-button-${sheet.id}`}
            onClick={() => onPreview(sheet)}
          >
            <Eye className="h-4 w-4" /> Lire
          </Button>
        )}
        <a
          href={`/api/sheets/${sheet.id}/download`}
          data-testid={`sheet-download-button-${sheet.id}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
          onClick={() => toast.success("Téléchargement démarré")}
        >
          <Download className="h-4 w-4" /> Télécharger
        </a>
      </div>

      <ReportSheetDialog sheet={sheet} open={reportOpen} onOpenChange={setReportOpen} />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer cette fiche ?</DialogTitle>
            <DialogDescription>
              « {sheet.title} » et ses éventuelles flashcards seront définitivement supprimées pour
              toute la promo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              data-testid="sheet-delete-cancel-button"
              onClick={() => setConfirmOpen(false)}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              data-testid="sheet-delete-confirm-button"
              disabled={deleting}
              onClick={() => {
                setConfirmOpen(false);
                onDelete(sheet);
              }}
            >
              {deleting ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
