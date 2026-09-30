import { FileStack } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title: string;
  hint?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export default function EmptyState({ title, hint, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card/60 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
        <FileStack className="h-6 w-6" />
      </div>
      <p className="font-heading text-lg font-semibold text-foreground">{title}</p>
      {hint ? <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{hint}</p> : null}
      {ctaLabel && onCta ? (
        <Button className="mt-2 transition-transform duration-75 active:scale-[0.98]" onClick={onCta}>
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  );
}
