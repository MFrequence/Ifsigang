import { useState } from "react";
import { Calendar, Download, Eye, FileText, Image as ImageIcon, Trash2, User } from "lucide-react";
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
import { DOMAIN_MAP } from "@/lib/domains";
import { formatBytes, formatDate, isPreviewable } from "@/lib/format";
import type { Sheet } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SheetCardProps {
  sheet: Sheet;
  onPreview: (sheet: Sheet) => void;
  onDelete: (sheet: Sheet) => void;
  deleting: boolean;
}

export default function SheetCard({ sheet, onPreview, onDelete, deleting }: SheetCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
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
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className={domain.badge}>
            {domain.label}
          </Badge>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-slate-400 hover:text-destructive"
            aria-label="Supprimer la fiche"
            data-testid={`sheet-delete-button-${sheet.id}`}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
        <h3 className="font-heading text-lg font-semibold leading-snug text-slate-900">
          {sheet.title}
        </h3>
        {sheet.description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">
            {sheet.description}
          </p>
        ) : null}
        <p className="mt-1 truncate text-xs text-slate-400">{sheet.filename}</p>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-xs text-slate-500">
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

      <div className="flex gap-2 pt-1">
        {isPreviewable(sheet.mime) && (
          <Button
            variant="outline"
            size="sm"
            data-testid={`sheet-preview-button-${sheet.id}`}
            onClick={() => onPreview(sheet)}
          >
            <Eye className="h-4 w-4" /> Aperçu
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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer cette fiche ?</DialogTitle>
            <DialogDescription>
              « {sheet.title} » sera définitivement supprimée pour toute la promo.
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
