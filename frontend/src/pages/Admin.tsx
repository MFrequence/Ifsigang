import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Copy,
  FileText,
  Flag,
  KeyRound,
  Loader2,
  Lock,
  Download,
  Eye,
  MessagesSquare,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { DOMAIN_MAP } from "@/lib/domains";
import type {
  AdminStatus,
  AdminUser,
  Sheet,
  AdminQuestion,
  SheetAudience,
  SheetReport,
  TemporaryPassword,
  User,
} from "@/lib/types";
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
  const [tempPassword, setTempPassword] = useState<TemporaryPassword | null>(null);
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

  const reportsQuery = useQuery({
    queryKey: ["admin-sheet-reports"],
    queryFn: () => apiGet<SheetReport[]>("/admin/sheet-reports"),
    enabled: unlocked,
    refetchOnWindowFocus: false,
  });

  // Audience d'une fiche : chargée seulement quand l'admin déplie la ligne.
  const [audienceSheet, setAudienceSheet] = useState<string | null>(null);
  const audienceQuery = useQuery({
    queryKey: ["admin-audience", audienceSheet],
    queryFn: () => apiGet<SheetAudience>(`/admin/sheets/${audienceSheet}/audience`),
    enabled: unlocked && audienceSheet !== null,
  });

  const questionsQuery = useQuery({
    queryKey: ["admin-questions"],
    queryFn: () => apiGet<AdminQuestion[]>("/admin/questions"),
    enabled: unlocked,
    refetchOnWindowFocus: false,
  });

  const removeQuestion = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/admin/questions/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-questions"] });
      void queryClient.invalidateQueries({ queryKey: ["question-counts"] });
      toast.success("Question et réponses supprimées");
    },
    onError: () => toast.error("Suppression impossible — réessaie"),
  });

  const removeAnswer = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/admin/answers/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-questions"] });
      toast.success("Réponse supprimée");
    },
    onError: () => toast.error("Suppression impossible — réessaie"),
  });

  const resetPassword = useMutation({
    mutationFn: (id: string) =>
      apiPost<TemporaryPassword>(`/admin/users/${id}/reset-password`, {}),
    onSuccess: (data) => {
      setTempPassword(data);
      toast.success("Mot de passe temporaire généré");
    },
    onError: () => toast.error("Réinitialisation impossible — réessaie"),
  });

  const dismissReport = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/admin/sheet-reports/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-sheet-reports"] });
      toast.success("Signalement traité");
    },
    onError: () => toast.error("Action impossible — réessaie"),
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
              <TabsTrigger value="reports" data-testid="admin-tab-reports">
                <Flag className="h-4 w-4" /> Signalements
                {(reportsQuery.data ?? []).length > 0 ? (
                  <span className="ml-1.5 rounded-full bg-destructive px-1.5 font-mono text-[10px] text-white">
                    {(reportsQuery.data ?? []).length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="questions" data-testid="admin-tab-questions">
                <MessagesSquare className="h-4 w-4" /> Entraide
                {(questionsQuery.data ?? []).length > 0 ? (
                  <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 font-mono text-[10px] text-primary">
                    {(questionsQuery.data ?? []).length}
                  </span>
                ) : null}
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
                      <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`admin-reset-password-${account.id}`}
                        disabled={resetPassword.isPending}
                        onClick={() => resetPassword.mutate(account.id)}
                        className="text-muted-foreground"
                      >
                        <RotateCcw className="h-4 w-4" /> Réinitialiser
                      </Button>
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
                    </div>
                  ))}
                  {tempPassword ? (
                    <div
                      data-testid="admin-temp-password"
                      className="rounded-2xl border border-primary/40 bg-primary/10 p-4"
                    >
                      <p className="text-sm text-foreground">
                        Mot de passe temporaire pour <strong>{tempPassword.email}</strong> — envoie-le
                        lui, il devra le changer à la connexion.
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <code className="rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-sm">
                          {tempPassword.temporary_password}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid="admin-copy-temp-password"
                          onClick={() => {
                            void navigator.clipboard
                              .writeText(tempPassword.temporary_password)
                              .then(() => toast.success("Copié"));
                          }}
                        >
                          <Copy className="h-4 w-4" /> Copier
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setTempPassword(null)}>
                          Masquer
                        </Button>
                      </div>
                    </div>
                  ) : null}
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
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`admin-audience-button-${sheet.id}`}
                          aria-expanded={audienceSheet === sheet.id}
                          onClick={() =>
                            setAudienceSheet(audienceSheet === sheet.id ? null : sheet.id)
                          }
                        >
                          <Eye className="h-4 w-4" />
                          {audienceSheet === sheet.id ? "Masquer" : "Qui l'a vue ?"}
                        </Button>
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

                      {audienceSheet === sheet.id ? (
                        <div
                          data-testid={`admin-audience-panel-${sheet.id}`}
                          className="w-full border-t border-border pt-3"
                        >
                          {audienceQuery.isPending ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                            </div>
                          ) : audienceQuery.isError || !audienceQuery.data ? (
                            <p className="text-sm text-muted-foreground">
                              Impossible de charger l'audience de cette fiche.
                            </p>
                          ) : (
                            <div className="grid gap-4 sm:grid-cols-2">
                              {(
                                [
                                  {
                                    key: "viewers" as const,
                                    icon: <Eye className="h-3.5 w-3.5" />,
                                    label: `Lecteurs (${audienceQuery.data.viewers.length}) · ${audienceQuery.data.views_total} ouverture${audienceQuery.data.views_total > 1 ? "s" : ""}`,
                                    empty: "Personne n'a encore ouvert cette fiche.",
                                  },
                                  {
                                    key: "downloaders" as const,
                                    icon: <Download className="h-3.5 w-3.5" />,
                                    label: `Téléchargements (${audienceQuery.data.downloaders.length} étudiant${audienceQuery.data.downloaders.length > 1 ? "s" : ""}) · ${audienceQuery.data.downloads_total} au total`,
                                    empty: "Aucun téléchargement enregistré.",
                                  },
                                ]
                              ).map((block) => (
                                <div key={block.key}>
                                  <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-primary">
                                    {block.icon}
                                    {block.label}
                                  </p>
                                  {audienceQuery.data[block.key].length === 0 ? (
                                    <p className="mt-1.5 text-xs text-muted-foreground">
                                      {block.empty}
                                    </p>
                                  ) : (
                                    <ul className="mt-1.5 space-y-1">
                                      {audienceQuery.data[block.key].map((entry) => (
                                        <li
                                          key={entry.user_id}
                                          data-testid={`admin-audience-${block.key}-${entry.user_id}`}
                                          className="flex items-center justify-between gap-2 rounded-lg bg-secondary/60 px-2.5 py-1.5 text-xs"
                                        >
                                          <span className="min-w-0 truncate">
                                            <span className="text-foreground">{entry.name}</span>{" "}
                                            <span className="font-mono text-[10px] text-muted-foreground/70">
                                              {entry.email}
                                            </span>
                                          </span>
                                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                                            ×{entry.count}
                                            {entry.last_at
                                              ? ` · ${new Date(entry.last_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
                                              : ""}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="reports">
              {reportsQuery.isPending ? (
                <div className="flex items-center gap-2 py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Chargement des signalements…
                </div>
              ) : (reportsQuery.data ?? []).length === 0 ? (
                <p className="py-10 text-sm text-muted-foreground" data-testid="admin-reports-empty">
                  Aucun signalement — tout va bien.
                </p>
              ) : (
                <div className="flex flex-col gap-3 pt-4" data-testid="admin-reports-list">
                  {(reportsQuery.data ?? []).map((report) => (
                    <div
                      key={report.id}
                      data-testid={`admin-report-row-${report.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-heading text-sm font-bold text-foreground">
                          {report.sheet_title || "Fiche supprimée"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Signalée par {report.user_name}
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {report.reason || "Aucun motif précisé"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`admin-dismiss-report-${report.id}`}
                        disabled={dismissReport.isPending}
                        onClick={() => dismissReport.mutate(report.id)}
                      >
                        Traité
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="questions">
              {questionsQuery.isPending ? (
                <div className="flex items-center gap-2 py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Chargement de l'entraide…
                </div>
              ) : (questionsQuery.data ?? []).length === 0 ? (
                <p
                  className="py-10 text-sm text-muted-foreground"
                  data-testid="admin-questions-empty"
                >
                  Aucune question posée pour l'instant.
                </p>
              ) : (
                <div className="flex flex-col gap-3 pt-4" data-testid="admin-questions-list">
                  {(questionsQuery.data ?? []).map((question) => (
                    <div
                      key={question.id}
                      data-testid={`admin-question-row-${question.id}`}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-heading text-sm font-bold text-foreground">
                          {question.sheet_title}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-foreground">
                          {question.body}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/70">
                          {question.author} · {question.answer_count} réponse
                          {question.answer_count > 1 ? "s" : ""}
                        </p>
                        {question.answers.length > 0 ? (
                          <ul className="mt-2 space-y-1 border-l-2 border-border pl-3">
                            {question.answers.map((answer) => (
                              <li
                                key={answer.id}
                                data-testid={`admin-answer-row-${answer.id}`}
                                className="flex items-start justify-between gap-2 text-xs text-muted-foreground"
                              >
                                <span className="min-w-0">
                                  <span className="text-foreground">{answer.body}</span>{" "}
                                  <span className="font-mono text-[10px]">— {answer.author}</span>
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  data-testid={`admin-delete-answer-${answer.id}`}
                                  aria-label="Supprimer cette réponse"
                                  disabled={removeAnswer.isPending}
                                  onClick={() => removeAnswer.mutate(answer.id)}
                                  className="text-muted-foreground/70 hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`admin-delete-question-${question.id}`}
                        disabled={removeQuestion.isPending}
                        onClick={() => removeQuestion.mutate(question.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" /> Supprimer
                      </Button>
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
