import {
  FolderOpen,
  GraduationCap,
  KeyRound,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  TrendingUp,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import ProgressDialog from "@/components/ProgressDialog";
import ThemeToggle from "@/components/ThemeToggle";
import { applyTheme, storedTheme, type Theme } from "@/lib/theme";
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
  onUploadClick?: () => void;
  onProgressClick?: () => void;
}

export default function AppHeader({
  user,
  totalSheets,
  onUploadClick,
  onProgressClick,
}: AppHeaderProps) {
  const navigate = useNavigate();
  const [passwordOpen, setPasswordOpen] = useState(false);
  // Les pages secondaires ne passent pas de handler : l'en-tête ouvre alors son propre dialogue.
  const [progressOpen, setProgressOpen] = useState(false);
  const openProgress = onProgressClick ?? (() => setProgressOpen(true));
  // Thème : état unique pour la capsule (desktop) et l'entrée de menu (mobile).
  const [theme, setTheme] = useState<Theme>(() => storedTheme());
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:px-6 lg:gap-4 lg:px-8">
        <div className="flex shrink-0 items-center gap-3">
          <Link
            to="/"
            data-testid="header-home-link"
            className="flex items-center gap-3 rounded-lg transition-opacity duration-150 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-primary" />
            </div>
            <div className="min-w-0">
              <p className="whitespace-nowrap font-heading text-lg font-bold leading-tight tracking-tight text-foreground">
                Fiches <span className="text-primary">IFSI</span>
              </p>
              <p className="hidden whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground xl:block">
                Promo · révisions partagées
              </p>
            </div>
          </Link>
        </div>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
          <Link
            to="/cours"
            data-testid="nav-library-link"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
          >
            Cours
          </Link>
          <Link
            to="/lexique"
            data-testid="nav-lexicon-link"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
          >
            Lexique
          </Link>
          <Link
            to="/schemas"
            data-testid="nav-anatomy-link"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
          >
            Schémas
          </Link>
          <Link
            to="/pharmacologie"
            data-testid="nav-pharmaco-link"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
          >
            Pharmaco
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:block">
            <ThemeToggle theme={theme} onChange={setTheme} />
          </div>

          <Badge
            variant="outline"
            data-testid="total-sheets-badge"
            className="hidden gap-1.5 border-border text-muted-foreground 2xl:inline-flex"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {totalSheets} fiche{totalSheets === 1 ? "" : "s"}
          </Badge>

          {onProgressClick ? (
            <Button
              variant="outline"
              size="icon"
              // masqué au téléphone : l'entrée reste dans le menu avatar
              aria-label="Ma progression"
              title="Ma progression"
              data-testid="open-progress-button"
              onClick={openProgress}
              className="hidden transition-transform duration-75 active:scale-[0.98] md:inline-flex"
            >
              <TrendingUp className="h-4 w-4" />
            </Button>
          ) : null}

          {onUploadClick ? (
            <Button
              data-testid="open-upload-modal-button"
              onClick={onUploadClick}
              className="transition-transform duration-75 active:scale-[0.98]"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden xl:inline">Déposer une fiche</span>
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger
              data-testid="user-menu-trigger"
              aria-label="Mon compte"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/15 font-heading text-sm font-bold text-primary transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {initials || "?"}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* base-ui exige un Group autour de Label/Item — sans lui, MenuGroupContext manque. */}
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <span className="block truncate font-medium text-foreground">{user.name}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {user.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  data-testid="menu-theme-item"
                  className="md:hidden"
                  onClick={(event) => {
                    event.preventDefault();
                    setTheme(theme === "dark" ? "light" : "dark");
                  }}
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                  {theme === "dark" ? "Thème clair" : "Thème sombre"}
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="menu-progress-item" onClick={openProgress}>
                  <TrendingUp className="h-4 w-4" /> Ma progression
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-testid="menu-change-password-item"
                  onClick={() => setPasswordOpen(true)}
                >
                  <KeyRound className="h-4 w-4" /> Changer mon mot de passe
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-testid="menu-admin-item"
                  onClick={() => void navigate("/admin")}
                >
                  <ShieldCheck className="h-4 w-4" /> Espace admin
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

      <ProgressDialog open={progressOpen} onOpenChange={setProgressOpen} />

      <ChangePasswordDialog
        open={passwordOpen || user.must_change_password}
        onOpenChange={setPasswordOpen}
        forced={user.must_change_password}
      />
    </header>
  );
}
