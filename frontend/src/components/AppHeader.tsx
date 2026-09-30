import { FolderOpen, GraduationCap, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  totalSheets: number;
  onUploadClick: () => void;
}

export default function AppHeader({ totalSheets, onUploadClick }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-700 text-white shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="font-heading text-lg font-bold tracking-tight text-slate-900">
              Fiches IFSI
            </p>
            <p className="text-xs text-slate-500">Bibliothèque de fiches de la promo</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            data-testid="total-sheets-badge"
            className="hidden gap-1.5 border-slate-200 text-slate-600 sm:inline-flex"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {totalSheets} fiche{totalSheets === 1 ? "" : "s"}
          </Badge>
          <Button
            data-testid="open-upload-modal-button"
            onClick={onUploadClick}
            className="transition-transform duration-75 active:scale-[0.98]"
          >
            <Upload className="h-4 w-4" />
            Déposer une fiche
          </Button>
        </div>
      </div>
    </header>
  );
}
