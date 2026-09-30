import { useQuery } from "@tanstack/react-query";
import { Link, Route, Routes } from "react-router-dom";
import { ApiError, apiGet } from "@/lib/api";
import type { User } from "@/lib/types";
import { Toaster } from "@/components/ui/sonner";
import Admin from "@/pages/Admin";
import Anatomie from "@/pages/Anatomie";
import Calculs from "@/pages/Calculs";
import Examen from "@/pages/Examen";
import Lexique from "@/pages/Lexique";
import Library from "@/pages/Library";
import Login from "@/pages/Login";
import Pharmaco from "@/pages/Pharmaco";
import Today from "@/pages/Today";

function BootSplash() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <p className="animate-pulse font-heading text-lg font-semibold text-muted-foreground/70">Chargement…</p>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="font-heading text-4xl font-extrabold tracking-tight text-foreground">404</p>
      <p className="text-muted-foreground">Cette page n'existe pas.</p>
      <Link to="/" className="text-primary underline-offset-4 hover:underline">
        Retour à l'accueil
      </Link>
    </div>
  );
}

export default function App() {
  // "Qui suis-je" : le cookie httpOnly de session répond, aucun token côté frontend.
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<User>("/auth/me"),
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (me.isPending) return <BootSplash />;

  // 401 → écran de connexion. Toute autre panne (backend absent sur un preview statique)
  // laisse aussi l'écran de connexion, qui reste lisible sans backend.
  const user = me.data;
  const unauthenticated = user === undefined || (me.error instanceof ApiError && me.error.status === 401);

  return (
    <>
      {unauthenticated ? (
        <Login />
      ) : (
        <Routes>
          {/* L'accueil demande ce qu'on veut faire ; la bibliothèque est une destination. */}
          <Route path="/" element={<Today user={user} />} />
          <Route path="/cours" element={<Library user={user} />} />
          <Route path="/calculs" element={<Calculs user={user} />} />
          <Route path="/examen" element={<Examen user={user} />} />
          <Route path="/schemas" element={<Anatomie user={user} />} />
          <Route path="/lexique" element={<Lexique user={user} />} />
          <Route path="/pharmacologie" element={<Pharmaco user={user} />} />
          <Route path="/admin" element={<Admin user={user} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      )}
      <Toaster richColors />
    </>
  );
}
