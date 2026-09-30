import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { AdminStatus, AdminUser } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Espace admin : déverrouillé par le mot de passe dédié, puis liste des comptes de la promo
// avec suppression totale (fiches, flashcards, progression).
export default function AdminDialog({ open, onOpenChange }: AdminDialogProps) {
  const [password, setPassword] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => apiGet<AdminStatus>("/admin/status"),
    enabled: open,
    refetchOnWindowFocus: false,
  });
  const unlocked = statusQuery.data?.is_admin ?? false;

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiGet<AdminUser[]>("/admin/users"),
    enabled: open && unlocked,
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
      setConfirmId(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({ queryKey: ["sheets"] });
      void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      toast.success("Compte et contenus supprimés");
    },
    onError: () => toast.error("Suppression impossible — réessaie"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="admin-dialog"
        className="flex max-h-[92svh] max-w-2xl flex-col overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <ShieldCheck className="h-5 w-5 text-sky-700" /> Espace admin
          </DialogTitle>
          <DialogDescription>
            Gestion des comptes de la promo. La suppression efface aussi les fiches déposées,
            leurs flashcards et toute la progression du compte.
          </DialogDescription>
        </DialogHeader>

        {!unlocked ? (
          <form
            className="flex flex-col gap-4 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              unlock.mutate();
            }}
          >
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
        ) : usersQuery.isPending ? (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Chargement des comptes…
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-2" data-testid="admin-users-list">
            {(usersQuery.data ?? []).map((account) => (
              <div
                key={account.id}
                data-testid={`admin-user-row-${account.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-heading text-sm font-bold text-slate-900">
                    {account.name}
                    {account.is_me ? (
                      <span className="ml-2 font-mono text-[10px] uppercase text-sky-700">
                        toi
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-slate-500">{account.email}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                    {account.sheets} fiche{account.sheets > 1 ? "s" : ""} · {account.answers}{" "}
                    réponse{account.answers > 1 ? "s" : ""}
                  </p>
                </div>
                {account.is_me ? (
                  <span className="text-xs text-slate-400">Compte connecté</span>
                ) : confirmId === account.id ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      data-testid={`admin-confirm-delete-${account.id}`}
                      disabled={removeUser.isPending}
                      onClick={() => removeUser.mutate(account.id)}
                    >
                      {removeUser.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Confirmer"
                      )}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>
                      Annuler
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`admin-delete-user-${account.id}`}
                    onClick={() => setConfirmId(account.id)}
                    className="text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" /> Supprimer
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              data-testid="admin-lock-button"
              onClick={() => lock.mutate()}
              className="self-start text-slate-500"
            >
              Verrouiller l'espace admin
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
