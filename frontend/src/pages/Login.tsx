import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { GraduationCap, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function detailOf(err: unknown, fallback: string): string {
  if (err instanceof ApiError && typeof err.body === "object" && err.body !== null && "detail" in err.body) {
    const detail = (err.body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string };
      if (first?.msg) return first.msg;
    }
  }
  return fallback;
}

// Écran d'entrée : connexion pour les comptes existants, inscription protégée par le
// code d'invitation de la promo.
export default function Login() {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: () =>
      apiPost<User>("/auth/login", { email: loginEmail.trim(), password: loginPassword }),
    onSuccess: async (user) => {
      setError(null);
      await beginSession();
      toast.success(`Bon retour, ${user.name} !`);
    },
    onError: (err: unknown) => setError(detailOf(err, "Connexion impossible — réessaie")),
  });

  const signup = useMutation({
    mutationFn: () =>
      apiPost<User>("/auth/signup", {
        name: signupName.trim(),
        email: signupEmail.trim(),
        password: signupPassword,
        invite_code: inviteCode.trim(),
      }),
    onSuccess: async (user) => {
      setError(null);
      await beginSession();
      toast.success(`Bienvenue ${user.name} — ton compte est créé !`);
    },
    onError: (err: unknown) => setError(detailOf(err, "Inscription impossible — réessaie")),
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

      <main className="flex flex-1 items-start justify-center px-4 pb-16 sm:items-center">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight text-slate-900">
            Espace promo
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Connecte-toi pour accéder aux fiches, réviser et suivre ta progression.
          </p>

          <Tabs defaultValue="login" className="mt-6">
            <TabsList className="w-full">
              <TabsTrigger value="login" data-testid="tab-login" className="flex-1">
                Connexion
              </TabsTrigger>
              <TabsTrigger value="signup" data-testid="tab-signup" className="flex-1">
                Créer un compte
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form
                className="flex flex-col gap-4 pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setError(null);
                  login.mutate();
                }}
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    data-testid="login-email-input"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="prenom.nom@ifsi.fr"
                    autoComplete="email"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="login-password">Mot de passe</Label>
                  <Input
                    id="login-password"
                    data-testid="login-password-input"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                {error && <p className="text-sm text-rose-600">{error}</p>}
                <Button
                  type="submit"
                  data-testid="login-submit-button"
                  className="w-full transition-transform duration-75 active:scale-[0.98]"
                  disabled={login.isPending || !loginEmail.trim() || !loginPassword}
                >
                  {login.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Connexion…
                    </>
                  ) : (
                    "Se connecter"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form
                className="flex flex-col gap-4 pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setError(null);
                  signup.mutate();
                }}
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="signup-name">Prénom et nom</Label>
                  <Input
                    id="signup-name"
                    data-testid="signup-name-input"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="Léa Martin"
                    maxLength={80}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    data-testid="signup-email-input"
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="prenom.nom@ifsi.fr"
                    autoComplete="email"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="signup-password">Mot de passe</Label>
                  <Input
                    id="signup-password"
                    data-testid="signup-password-input"
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="6 caractères minimum"
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="signup-invite">Code d'invitation de la promo</Label>
                  <Input
                    id="signup-invite"
                    data-testid="signup-invite-input"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Code partagé par tes délégués"
                    autoComplete="off"
                  />
                </div>
                {error && <p className="text-sm text-rose-600">{error}</p>}
                <Button
                  type="submit"
                  data-testid="signup-submit-button"
                  className="w-full transition-transform duration-75 active:scale-[0.98]"
                  disabled={
                    signup.isPending ||
                    !signupName.trim() ||
                    !signupEmail.trim() ||
                    signupPassword.length < 6 ||
                    !inviteCode.trim()
                  }
                >
                  {signup.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Création…
                    </>
                  ) : (
                    "Créer mon compte"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
