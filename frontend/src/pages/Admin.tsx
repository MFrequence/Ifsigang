import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { DOMAIN_MAP } from "@/lib/domains";
import type { AdminStatus, AdminUser, Sheet, User } from "@/lib/types";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AdminProps {
  user: User;
}

// Page admin dédiée (/admin) : déverrouillage par mot de passe, gestion des comptes
// et de toutes les fiches de la promo.
export default function Admin({ user }: AdminProps) {
  const [password, setPassword] = useState("");
  const [confirmUser, setConfirmUser] = useState<string | null>(null);
  const [confirmSheet, setConfirmSheet] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => apiGet<AdminStatus>("/admin/status"),
    refetchOnWindowFocus: false,
  });
  const unlocked = statusQuery.data?.is_admin ?? false;

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiGet<AdminUser[]>("/admin/users"),
    enabled: unlocked,
    refetchOnWindowFocus: false,
  });
  const sheetsQuery = useQuery({
    queryKey: ["sheets"],
    queryFn: () => apiGet<Sheet[]>("/sheets"),
    enabled: unlocked,
    refetchOnWindowFocus: false,
  });

  const unlock = useMutation({
    mutationFn: () => apiPost<AdminStatus>("/admin/unlock", { password }),
    onSuccess: () => {
      setPassword("");
      void queryClient.invalidateQueries({ queryKey: ["admin-status"] });
      toast.success("Espace admin déverrouillé");
    },
    onError: () => toast.error("Mot de passe admin incorrect"),
  });

  const lock = useMutation({
    mutationFn: () => apiPost<AdminStatus>("/admin/lock", {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-status"] });
      toast.success("Espace admin verrouillé");
    },
  });

  const removeUser = useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: boolean }>(`/admin/users/${id}`),
    onSuccess: () => {
      setConfirmUser(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({ queryKey: ["sheets"] });
      toast.success("Compte et contenus supprimés");
    },
    onError: () => toast.error("Suppression impossible — réessaie"),
  });

  const removeSheet = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/sheets/${id}`),
    onSuccess: () => {
      setConfirmSheet(null);
      void queryClient.invalidateQueries({ queryKey: ["sheets"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({ queryKey: ["revision-plan"] });
      toast.success("Fiche supprimée");
    },
    onError: () => toast.error("Suppression impossible — réessaie"),
  });

  const sheets = sheetsQuery.data ?? [];

  return (
    <div className="min-h-svh bg-background">
      <AppHeader user={user} totalSheets={sheets.length} />

      <main className="clinical-grid mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          to="/"
          data-testid="admin-back-link"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Accueil
        </Link>
        <h1 className="flex items-center gap-2 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          <ShieldCheck className="h-7 w-7 text-primary" /> Espace admin
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Gestion des comptes de la promo et de toutes les fiches déposées. La suppression d'un
          compte efface aussi ses fiches, leurs flashcards et sa progression.
        </p>

        {statusQuery.isPending ? (
          <div className="mt-10 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Vérification…
          </div>
        ) : !unlocked ? (
          <form
            data-testid="admin-unlock-form"
            className="bg-card/70 backdrop-blur-md mt-8 flex max-w-md flex-col gap-4 rounded-2xl border border-border p-6 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              unlock.mutate();
            }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
              <Lock className="h-6 w-6" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-password">Mot de passe admin</Label>
              <Input
                id="admin-password"
                data-testid="admin-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe réservé à l'administrateur"
                autoComplete="off"
              />
            </div>
            <Button
              type="submit"
              data-testid="admin-unlock-button"
              disabled={unlock.isPending || !password}
              className="transition-transform duration-75 active:scale-[0.98]"
            >
              {unlock.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Vérification…
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" /> Déverrouiller
                </>
              )}
            </Button>
          </form>
        ) : (
          <Tabs defaultValue="accounts" className="mt-8">
            <TabsList>
              <TabsTrigger value="accounts" data-testid="admin-tab-accounts">
                <Users className="h-4 w-4" /> Comptes
              </TabsTrigger>
              <TabsTrigger value="sheets" data-testid="admin-tab-sheets">
                <FileText className="h-4 w-4" /> Fiches
              </TabsTrigger>
            </TabsList>

            <TabsContent value="accounts">
              {usersQuery.isPending ? (
                <div className="flex items-center gap-2 py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Chargement des comptes…
                </div>
              ) : (
                <div className="flex flex-col gap-3 pt-4" data-testid="admin-users-list">
                  {(usersQuery.data ?? []).map((account) => (
                    <div
                      key={account.id}
                      data-testid={`admin-user-row-${account.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-heading text-sm font-bold text-foreground">
                          {account.name}
                          {account.is_me ? (
                            <span className="ml-2 font-mono text-[10px] uppercase text-primary">
                              toi
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{account.email}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/70">
                          {account.sheets} fiche{account.sheets > 1 ? "s" : ""} ·{" "}
                          {account.answers} réponse{account.answers > 1 ? "s" : ""}
                        </p>
                      </div>
                      {account.is_me ? (
                        <span className="text-xs text-muted-foreground/70">Compte connecté</span>
                      ) : confirmUser === account.id ? (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            data-testid={`admin-confirm-delete-user-${account.id}`}
                            disabled={removeUser.isPending}
                            onClick={() => removeUser.mutate(account.id)}
                          >
                            {removeUser.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Confirmer"
                            )}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmUser(null)}>
                            Annuler
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`admin-delete-user-${account.id}`}
                          onClick={() => setConfirmUser(account.id)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" /> Supprimer
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="sheets">
              {sheetsQuery.isPending ? (
                <div className="flex items-center gap-2 py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Chargement des fiches…
                </div>
              ) : sheets.length === 0 ? (
                <p className="py-10 text-sm text-muted-foreground" data-testid="admin-sheets-empty">
                  Aucune fiche déposée pour le moment.
                </p>
              ) : (
                <div className="flex flex-col gap-3 pt-4" data-testid="admin-sheets-list">
                  {sheets.map((sheet) => (
                    <div
                      key={sheet.id}
                      data-testid={`admin-sheet-row-${sheet.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-heading text-sm font-bold text-foreground">
                          {sheet.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {DOMAIN_MAP[sheet.domain].label}
                          {sheet.unit ? ` · UE ${sheet.unit}` : ""} · {sheet.author}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground/70">
                          {sheet.filename}
                        </p>
                      </div>
                      {confirmSheet === sheet.id ? (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            data-testid={`admin-confirm-delete-sheet-${sheet.id}`}
                            disabled={removeSheet.isPending}
                            onClick={() => removeSheet.mutate(sheet.id)}
                          >
                            {removeSheet.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Confirmer"
                            )}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmSheet(null)}>
                            Annuler
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`admin-delete-sheet-${sheet.id}`}
                          onClick={() => setConfirmSheet(sheet.id)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" /> Supprimer
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <Button
              variant="ghost"
              size="sm"
              data-testid="admin-lock-button"
              onClick={() => lock.mutate()}
              className="mt-6 text-muted-foreground"
            >
              <Lock className="h-4 w-4" /> Verrouiller l'espace admin
            </Button>
          </Tabs>
        )}
      </main>
    </div>
  );
}
