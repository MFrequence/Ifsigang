import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Loader2, MessageCircleQuestion, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { Sheet, SheetQuestion } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface SheetQuestionsDialogProps {
  sheet: Sheet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Entraide de promo : questions posées sous une fiche et réponses des collègues. */
export default function SheetQuestionsDialog({
  sheet,
  open,
  onOpenChange,
}: SheetQuestionsDialogProps) {
  const [body, setBody] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const sheetId = sheet?.id ?? "";

  const questionsQuery = useQuery({
    queryKey: ["sheet-questions", sheetId],
    queryFn: () => apiGet<SheetQuestion[]>(`/sheets/${sheetId}/questions`),
    enabled: open && sheetId !== "",
  });
  const questions = questionsQuery.data ?? [];

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["sheet-questions", sheetId] });
    void queryClient.invalidateQueries({ queryKey: ["question-counts"] });
  };

  const askQuestion = useMutation({
    mutationFn: () => apiPost<SheetQuestion>(`/sheets/${sheetId}/questions`, { body: body.trim() }),
    onSuccess: () => {
      setBody("");
      refresh();
      toast.success("Question posée — la promo peut y répondre");
    },
    onError: () => toast.error("Impossible de poser la question"),
  });

  const answerQuestion = useMutation({
    mutationFn: ({ questionId, text }: { questionId: string; text: string }) =>
      apiPost<unknown>(`/questions/${questionId}/answers`, { body: text }),
    onSuccess: (_data, { questionId }) => {
      setAnswers((current) => ({ ...current, [questionId]: "" }));
      refresh();
      toast.success("Réponse envoyée");
    },
    onError: () => toast.error("Impossible d'envoyer la réponse"),
  });

  const markBest = useMutation({
    mutationFn: (answerId: string) => apiPost<unknown>(`/answers/${answerId}/best`, {}),
    onSuccess: refresh,
    onError: () => toast.error("Seul l'auteur de la question peut choisir la meilleure réponse"),
  });

  const deleteQuestion = useMutation({
    mutationFn: (questionId: string) => apiDelete<void>(`/questions/${questionId}`),
    onSuccess: () => {
      refresh();
      toast.success("Question supprimée");
    },
    onError: () => toast.error("Suppression impossible"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {sheet && (
        <DialogContent className="flex max-h-[90svh] flex-col gap-4 overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="pr-8">Entraide — {sheet.title}</DialogTitle>
            <DialogDescription>
              Pose une question sur cette fiche : tes collègues de promo peuvent répondre, et tu
              mets en avant la meilleure réponse.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Textarea
              data-testid="question-input"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Ta question sur cette fiche…"
              maxLength={800}
              rows={3}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                data-testid="question-submit-button"
                disabled={body.trim().length < 3 || askQuestion.isPending}
                onClick={() => askQuestion.mutate()}
              >
                <Send className="h-4 w-4" /> Poser la question
              </Button>
            </div>
          </div>

          {questionsQuery.isPending ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement des questions…
            </div>
          ) : questions.length === 0 ? (
            <div
              data-testid="questions-empty-state"
              className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center"
            >
              <MessageCircleQuestion className="h-6 w-6 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                Aucune question pour l'instant — sois le premier à demander une précision.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {questions.map((question) => (
                <li
                  key={question.id}
                  data-testid={`question-item-${question.id}`}
                  className="rounded-xl border border-border bg-card/60 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium leading-relaxed text-foreground">
                        {question.body}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {question.author} · {formatDate(question.created_at)}
                      </p>
                    </div>
                    {question.mine ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        data-testid={`question-delete-${question.id}`}
                        aria-label="Supprimer ma question"
                        className="text-muted-foreground/70 hover:text-destructive"
                        onClick={() => deleteQuestion.mutate(question.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>

                  {question.answers.length > 0 ? (
                    <ul className="mt-3 space-y-2 border-l-2 border-border pl-3">
                      {question.answers.map((answer) => (
                        <li
                          key={answer.id}
                          data-testid={`answer-item-${answer.id}`}
                          className={`rounded-lg p-2.5 ${
                            answer.best ? "bg-primary/10 ring-1 ring-primary/40" : "bg-secondary/60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm leading-relaxed text-foreground">{answer.body}</p>
                            {question.mine ? (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                data-testid={`answer-best-${answer.id}`}
                                aria-pressed={answer.best}
                                aria-label={
                                  answer.best
                                    ? "Retirer la meilleure réponse"
                                    : "Marquer comme meilleure réponse"
                                }
                                title="Meilleure réponse"
                                onClick={() => markBest.mutate(answer.id)}
                                className={
                                  answer.best
                                    ? "text-primary"
                                    : "text-muted-foreground/70 hover:text-primary"
                                }
                              >
                                <Award className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            {answer.author} · {formatDate(answer.created_at)}
                            {answer.best ? (
                              <Badge variant="outline" className="border-primary/50 text-primary">
                                Meilleure réponse
                              </Badge>
                            ) : null}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-3 flex items-end gap-2">
                    <Textarea
                      data-testid={`answer-input-${question.id}`}
                      value={answers[question.id] ?? ""}
                      onChange={(event) =>
                        setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                      }
                      placeholder="Ta réponse…"
                      rows={2}
                      maxLength={1500}
                      className="min-h-0"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid={`answer-submit-${question.id}`}
                      disabled={(answers[question.id] ?? "").trim().length === 0}
                      onClick={() =>
                        answerQuestion.mutate({
                          questionId: question.id,
                          text: (answers[question.id] ?? "").trim(),
                        })
                      }
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
