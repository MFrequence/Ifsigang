import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiGet } from "@/lib/api";
import { DOMAIN_MAP } from "@/lib/domains";
import type { DomainKey, StudyCard, StudyMode } from "@/lib/types";
import StudyRunner from "@/components/StudyRunner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StudySessionDialogProps {
  domain: DomainKey | null;
  unit: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Session de révision agrégée : toutes les cartes d'un domaine, ou d'une UE précise.
// Les cartes ratées la dernière fois remontent en tête (champ `due` côté backend).
export default function StudySessionDialog({
  domain,
  unit,
  open,
  onOpenChange,
}: StudySessionDialogProps) {
  const [mode, setMode] = useState<StudyMode>("flash");

  const deckQuery = useQuery({
    queryKey: ["study-deck", domain, unit],
    queryFn: () => {
      const params = new URLSearchParams();
      if (domain) params.set("domain", domain);
      if (unit) params.set("unit", unit);
      const qs = params.toString();
      return apiGet<StudyCard[]>(`/study/deck${qs ? `?${qs}` : ""}`);
    },
    enabled: open,
  });

  const cards = deckQuery.data ?? [];
  const scope = domain
    ? unit
      ? `${DOMAIN_MAP[domain].label} · UE ${unit}`
      : DOMAIN_MAP[domain].label
    : "Toute la bibliothèque";
  const dueCount = cards.filter((c) => c.due).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92svh] max-w-2xl flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-8">Session de révision — {scope}</DialogTitle>
          <DialogDescription>
            {cards.length > 0
              ? `${cards.length} carte${cards.length > 1 ? "s" : ""} au programme${
                  dueCount > 0 ? ` — ${dueCount} à revoir en priorité` : ""
                }.`
              : "Toutes les cartes des fiches de cette sélection."}
          </DialogDescription>
        </DialogHeader>

        {deckQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Préparation de la session…
          </div>
        ) : deckQuery.isError ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">Impossible de préparer la session.</p>
            <Button variant="outline" onClick={() => void deckQuery.refetch()}>
              Réessayer
            </Button>
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="font-heading text-lg font-semibold text-foreground">
              Aucune carte dans cette sélection
            </p>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Ouvre une fiche de cette sélection et génère ses cartes — elles rejoindront
              automatiquement les sessions du domaine et de l'UE.
            </p>
          </div>
        ) : (
          <StudyRunner cards={cards} mode={mode} onModeChange={setMode} showContext />
        )}
      </DialogContent>
    </Dialog>
  );
}
