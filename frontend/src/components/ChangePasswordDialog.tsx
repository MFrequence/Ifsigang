import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiPost } from "@/lib/api";
import type { User } from "@/lib/types";
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

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forced?: boolean; // après une réinitialisation admin
}

// Changement de mot de passe par le titulaire du compte.
export default function ChangePasswordDialog({
  open,
  onOpenChange,
  forced,
}: ChangePasswordDialogProps) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const change = useMutation({
    mutationFn: () =>
      apiPost<User>("/auth/change-password", { current_password: current, new_password: next }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      onOpenChange(false);
      toast.success("Mot de passe mis à jour");
    },
    onError: (err: unknown) => {
      const detail =
        err instanceof ApiError &&
        typeof err.body === "object" &&
        err.body !== null &&
        "detail" in err.body
          ? String((err.body as { detail: unknown }).detail)
          : "Changement impossible — réessaie";
      setError(detail);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="change-password-dialog"
        className="flex max-h-[92svh] max-w-md flex-col overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <KeyRound className="h-5 w-5 text-primary" /> Changer mon mot de passe
          </DialogTitle>
          <DialogDescription>
            {forced
              ? "Ton mot de passe a été réinitialisé par l'admin : choisis-en un nouveau pour sécuriser ton compte."
              : "Saisis ton mot de passe actuel puis le nouveau (6 caractères minimum)."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            change.mutate();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="current-password">Mot de passe actuel</Label>
            <Input
              id="current-password"
              data-testid="current-password-input"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
            <Input
              id="new-password"
              data-testid="new-password-input"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="6 caractères minimum"
              autoComplete="new-password"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            type="submit"
            data-testid="change-password-submit"
            disabled={change.isPending || !current || next.length < 6}
          >
            {change.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Enregistrement…
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
