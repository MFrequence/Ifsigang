import { useQuery } from "@tanstack/react-query";
import { Link, Route, Routes } from "react-router-dom";
import AccessGateModal from "@/components/AccessGateModal";
import { Toaster } from "@/components/ui/sonner";
import { apiGet } from "@/lib/api";
import type { UnlockStatus } from "@/lib/types";
import Home from "@/pages/Home";

function BootSplash() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <p className="font-heading text-lg font-semibold text-slate-400 animate-pulse">Chargement…</p>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="font-heading text-4xl font-extrabold tracking-tight text-slate-900">404</p>
      <p className="text-slate-500">Cette page n'existe pas.</p>
      <Link to="/" className="text-sky-700 underline-offset-4 hover:underline">
        Retour aux fiches
      </Link>
    </div>
  );
}

export default function App() {
  const status = useQuery({
    queryKey: ["auth-status"],
    queryFn: () => apiGet<UnlockStatus>("/auth/status"),
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (status.isPending) return <BootSplash />;

  // Backend unreachable (e.g. static preview) → fail open to the shell; data regions
  // degrade to their empty states instead of an outage screen.
  const locked = !status.isError && status.data !== undefined && !status.data.unlocked;

  return (
    <>
      {locked ? (
        <AccessGateModal />
      ) : (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      )}
      <Toaster richColors />
    </>
  );
}
