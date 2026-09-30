import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiPostForm } from "@/lib/api";
import { DOMAINS, DOMAIN_MAP } from "@/lib/domains";
import { formatBytes } from "@/lib/format";
import type { DomainKey, Sheet } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MAX_SIZE = 10 * 1024 * 1024; // 10 Mo
const ALLOWED = [".pdf", ".png", ".jpg", ".jpeg", ".docx", ".txt"];

interface UploadSheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheets: Sheet[];
}

export default function UploadSheetDialog({ open, onOpenChange, sheets }: UploadSheetDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState<DomainKey | "">("");
  const [unit, setUnit] = useState("");
  const [description, setDescription] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const unitSuggestions = useMemo(() => {
    const set = new Set(
      sheets.filter((s) => s.domain === domain).map((s) => (s.unit || "").trim()).filter(Boolean),
    );
    return [...set].sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
  }, [sheets, domain]);
  const reset = () => {
    setFile(null);
    setTitle("");
    setDomain("");
    setUnit("");
    setDescription("");
    setDragging(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const pickFile = (picked: File | undefined) => {
    if (!picked) return;
    const ext = picked.name.includes(".") ? picked.name.split(".").pop()!.toLowerCase() : "";
    if (!ALLOWED.includes(`.${ext}`)) {
      toast.error("Format non autorisé — pdf, png, jpg, docx ou txt");
      return;
    }
    if (picked.size > MAX_SIZE) {
      toast.error("Fichier trop lourd — 10 Mo maximum");
      return;
    }
    setFile(picked);
    if (!title.trim()) {
      setTitle(picked.name.replace(/\.[^.]+$/, ""));
    }
  };

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("aucun fichier sélectionné");
      const fd = new FormData();
      fd.set("file", file);
      fd.set("title", title.trim());
      fd.set("domain", domain);
      fd.set("unit", unit.trim());
      fd.set("description", description.trim());
      return apiPostForm<Sheet>("/sheets", fd);
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["sheets"] });
      void queryClient.invalidateQueries({ queryKey: ["study-deck"] });
      toast.success("Fiche déposée avec succès");
      // Le serveur construit les cartes en tâche de fond : rien à déclencher ici, et la
      // génération continue même si l'onglet est fermé.
      if (!created.mime.startsWith("image/")) {
        toast.info("Flashcards et QCM en préparation — disponibles dans quelques secondes");
      }
      reset();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        const detail =
          typeof err.body === "object" && err.body !== null && "detail" in err.body
            ? String((err.body as { detail: unknown }).detail)
            : null;
        toast.error(detail ?? "Dépôt impossible — réessaie");
      } else {
        toast.error("Dépôt impossible — réessaie");
      }
    },
  });

  const canSubmit =
    file !== null && title.trim() !== "" && domain !== "" && !upload.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Déposer une fiche</DialogTitle>
          <DialogDescription>
            PDF, image, DOCX ou TXT — 10 Mo maximum. La fiche sera publiée à ton nom, et ses
            flashcards générées automatiquement pour les fichiers lisibles.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) upload.mutate();
          }}
        >
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors duration-200",
              dragging
                ? "border-sky-500 bg-sky-50"
                : "border-slate-300 bg-slate-50/60 hover:border-sky-400 hover:bg-sky-50/50",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pickFile(e.dataTransfer.files[0]);
            }}
          >
            <input
              ref={inputRef}
              data-testid="file-dropzone-input"
              type="file"
              accept={ALLOWED.join(",")}
              className="sr-only"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            {file ? (
              <>
                <FileUp className="h-8 w-8 text-sky-600" />
                <p className="text-sm font-medium text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {formatBytes(file.size)} — cliquer pour changer
                </p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">
                  Glisse ton fichier ici ou clique pour parcourir
                </p>
                <p className="text-xs text-slate-500">pdf, png, jpg, docx, txt — 10 Mo max</p>
              </>
            )}
          </label>

          <div className="flex flex-col gap-2">
            <Label htmlFor="upload-title">Titre de la fiche</Label>
            <Input
              id="upload-title"
              data-testid="upload-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Les 4 principes de la bioéthique"
              maxLength={200}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="upload-domain">Domaine</Label>
              <Select
                value={domain}
                onValueChange={(value: string) => setDomain(value as DomainKey)}
              >
                <SelectTrigger id="upload-domain" data-testid="upload-domain-select" className="w-full">
                  <SelectValue placeholder="Choisir un domaine">
                    {(value: string) => DOMAIN_MAP[value as DomainKey]?.label ?? "Choisir un domaine"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {DOMAINS.map((d) => (
                    <SelectItem key={d.key} value={d.key}>
                      {d.label} — {d.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="upload-unit">UE / sous-catégorie</Label>
              <Input
                id="upload-unit"
                data-testid="upload-unit-input"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Ex. A1"
                list="unit-suggestions"
                maxLength={40}
              />
              <datalist id="unit-suggestions">
                {unitSuggestions.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="upload-description">Description (facultatif)</Label>
            <Textarea
              id="upload-description"
              data-testid="upload-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ce que la fiche couvre, pour aider tes camarades"
              rows={3}
              maxLength={500}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              data-testid="upload-cancel-button"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" data-testid="upload-submit-button" disabled={!canSubmit}>
              {upload.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Dépôt…
                </>
              ) : (
                "Déposer la fiche"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
