import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Lock } from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiPost } from "@/lib/api";
import type { UnlockStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Full-screen promo gate — the code unlocks the whole library via an httpOnly cookie.
export default function AccessGateModal() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const unlock = useMutation({
    mutationFn: () => apiPost<UnlockStatus>("/auth/unlock", { code: code.trim() }),
    onSuccess: () => {
      setError(null);
      toast.success("Code promo validé — bienvenue !");
      void queryClient.invalidateQueries({ queryKey: ["auth-status"] });
    },
    onError: (err: unknown) => {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Code incorrect — vérifie auprès de tes délégués."
          : "Impossible de valider le code — réessaie plus tard.",
      );
    },
  });

  return (
    <div className="dot-grid-dark flex min-h-svh flex-col bg-[#0F172A]">
      <header className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div>
          <p className="font-heading text-lg font-bold tracking-tight text-slate-50">Fiches IFSI</p>
          <p className="text-xs text-slate-400">Bibliothèque de fiches de la promo</p>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight text-slate-900">
            Espace promo
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Entre le code partagé par la promo pour consulter les fiches de révision et en déposer.
            Une seule saisie : l'accès reste ouvert sur cet appareil.
          </p>
          <form
            className="mt-6 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) unlock.mutate();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="promo-code">Code de la promo</Label>
              <Input
                id="promo-code"
                data-testid="promo-code-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Code partagé par tes délégués"
                autoComplete="off"
                aria-invalid={error !== null}
              />
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
            <Button
              type="submit"
              data-testid="promo-code-submit-button"
              className="w-full transition-transform duration-75 active:scale-[0.98]"
              disabled={unlock.isPending || !code.trim()}
            >
              {unlock.isPending ? "Validation…" : "Entrer dans la bibliothèque"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
