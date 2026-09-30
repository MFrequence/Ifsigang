import { FolderOpen, GraduationCap, LogOut, TrendingUp, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { endSession } from "@/lib/session";
import type { User } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppHeaderProps {
  user: User;
  totalSheets: number;
  onUploadClick: () => void;
  onProgressClick: () => void;
}

export default function AppHeader({
  user,
  totalSheets,
  onUploadClick,
  onProgressClick,
}: AppHeaderProps) {
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            data-testid="header-home-link"
            className="flex items-center gap-3 rounded-lg transition-opacity duration-150 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-700 text-white shadow-sm">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="font-heading text-lg font-bold tracking-tight text-slate-900">
                Fiches IFSI
              </p>
              <p className="text-xs text-slate-500">Bibliothèque de fiches de la promo</p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Badge
            variant="outline"
            data-testid="total-sheets-badge"
            className="hidden gap-1.5 border-slate-200 text-slate-600 sm:inline-flex"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {totalSheets} fiche{totalSheets === 1 ? "" : "s"}
          </Badge>

          <Button
            variant="outline"
            data-testid="open-progress-button"
            onClick={onProgressClick}
            className="transition-transform duration-75 active:scale-[0.98]"
          >
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Ma progression</span>
          </Button>

          <Button
            data-testid="open-upload-modal-button"
            onClick={onUploadClick}
            className="transition-transform duration-75 active:scale-[0.98]"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Déposer une fiche</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              data-testid="user-menu-trigger"
              aria-label="Mon compte"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 font-heading text-sm font-semibold text-white transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {initials || "?"}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* base-ui exige un Group autour de Label/Item — sans lui, MenuGroupContext manque. */}
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <span className="block truncate font-medium text-slate-900">{user.name}</span>
                  <span className="block truncate text-xs font-normal text-slate-500">
                    {user.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem data-testid="menu-progress-item" onClick={onProgressClick}>
                  <TrendingUp className="h-4 w-4" /> Ma progression
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  data-testid="logout-button"
                  onClick={() => {
                    void endSession().then(() => toast.success("Tu es déconnecté"));
                  }}
                >
                  <LogOut className="h-4 w-4" /> Se déconnecter
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
