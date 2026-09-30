import { useQuery } from "@tanstack/react-query";
import { Loader2, Medal, Target, TrendingUp, Upload } from "lucide-react";
import { apiGet } from "@/lib/api";
import { DOMAIN_MAP } from "@/lib/domains";
import type { DomainKey, LeaderboardEntry, ProgressStats } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface ProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function StatTile({
  label,
  value,
  icon,
  testId,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  testId: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <p className="font-mono text-xs uppercase tracking-wider">{label}</p>
      </div>
      <p
        className="mt-1 font-heading text-2xl font-bold tracking-tight text-slate-900"
        data-testid={testId}
      >
        {value}
      </p>
    </div>
  );
}

// Progression personnelle + classement de la promo (visible par tous).
export default function ProgressDialog({ open, onOpenChange }: ProgressDialogProps) {
  const progress = useQuery({
    queryKey: ["progress"],
    queryFn: () => apiGet<ProgressStats>("/progress/me"),
    enabled: open,
  });
  const board = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => apiGet<LeaderboardEntry[]>("/progress/leaderboard"),
    enabled: open,
  });

  const stats = progress.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ma progression</DialogTitle>
          <DialogDescription>
            Ton suivi personnel et le classement de la promo, mis à jour à chaque révision.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="me">
          <TabsList className="w-full">
            <TabsTrigger value="me" data-testid="tab-my-progress" className="flex-1">
              Mon suivi
            </TabsTrigger>
            <TabsTrigger value="board" data-testid="tab-leaderboard" className="flex-1">
              Classement promo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="me" className="pt-4">
            {progress.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
              </div>
            ) : progress.isError || !stats ? (
              <p className="py-12 text-center text-sm text-slate-500">
                Progression indisponible pour le moment.
              </p>
            ) : stats.answered === 0 ? (
              <p className="py-12 text-center text-sm leading-relaxed text-slate-500">
                Tu n'as pas encore révisé de carte. Lance une session depuis une fiche ou un domaine
                — ton suivi se remplira automatiquement.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile
                    label="Réponses"
                    value={String(stats.answered)}
                    icon={<Target className="h-4 w-4" />}
                    testId="stat-answered"
                  />
                  <StatTile
                    label="Réussite"
                    value={`${stats.accuracy} %`}
                    icon={<TrendingUp className="h-4 w-4" />}
                    testId="stat-accuracy"
                  />
                  <StatTile
                    label="Maîtrisées"
                    value={String(stats.mastered)}
                    icon={<Medal className="h-4 w-4" />}
                    testId="stat-mastered"
                  />
                  <StatTile
                    label="À revoir"
                    value={String(stats.to_review)}
                    icon={<Target className="h-4 w-4" />}
                    testId="stat-to-review"
                  />
                </div>

                {stats.per_domain.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="font-mono text-xs uppercase tracking-wider text-slate-500">
                      Par domaine
                    </p>
                    {stats.per_domain.map((d) => {
                      const info = DOMAIN_MAP[d.domain as DomainKey];
                      return (
                        <div
                          key={d.domain}
                          className="flex items-center gap-3"
                          data-testid={`domain-progress-${d.domain}`}
                        >
                          <span className="w-24 shrink-0 text-sm text-slate-600">
                            {info?.label ?? d.domain}
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={cn("h-full rounded-full", info?.dot ?? "bg-sky-600")}
                              style={{ width: `${d.accuracy}%` }}
                            />
                          </div>
                          <span className="w-20 shrink-0 text-right text-xs text-slate-500">
                            {d.correct}/{d.answered} · {d.accuracy}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="text-xs text-slate-500">
                  Révisé sur {stats.sessions_days} jour{stats.sessions_days > 1 ? "s" : ""}
                  différent{stats.sessions_days > 1 ? "s" : ""}.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="board" className="pt-4">
            {board.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
              </div>
            ) : board.isError || !board.data ? (
              <p className="py-12 text-center text-sm text-slate-500">
                Classement indisponible pour le moment.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {board.data.map((entry, i) => (
                  <div
                    key={entry.user_id}
                    data-testid={`leaderboard-row-${i}`}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-4 py-3",
                      entry.is_me ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white",
                    )}
                  >
                    <span className="w-6 shrink-0 font-heading text-lg font-bold text-slate-400">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {entry.name}
                        {entry.is_me ? (
                          <Badge variant="outline" className="ml-2 border-sky-300 text-sky-700">
                            moi
                          </Badge>
                        ) : null}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                        <span>
                          {entry.correct} bonne{entry.correct > 1 ? "s" : ""} réponse
                          {entry.correct > 1 ? "s" : ""}
                        </span>
                        <span>{entry.accuracy}% de réussite</span>
                        <span className="inline-flex items-center gap-1">
                          <Upload className="h-3 w-3" />
                          {entry.sheets_uploaded} fiche{entry.sheets_uploaded > 1 ? "s" : ""}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
