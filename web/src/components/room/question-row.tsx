"use client";
import { Check, Circle, Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichText } from "@/components/content/rich-text";
import { getLabStore, useLab } from "@/lib/lab-store";
import type { Question } from "@/lib/room/tasks";
import { cn } from "@/lib/utils";

export function QuestionRow({ q, index }: { q: Question; index: number }) {
  const s = useLab();
  const store = getLabStore();
  const st = s.questions[q.id];
  const wrong = st.feedback && !st.feedback.ok;
  const hintButton = (
    <Button variant="ghost" size="sm" onClick={() => store.toggleHint(q.id)} aria-expanded={st.showHint}>
      <Lightbulb /> Hinweis
    </Button>
  );
  return (
    <div id={`q-${q.id}`} data-testid={`q-${q.id}`} data-done={st.done} className="flex scroll-mt-12 gap-3 border-t border-foreground/10 pt-4">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-base border text-base font-semibold",
          st.done ? "border-primary bg-primary text-background" : "border-foreground/20 text-foreground/60",
        )}
        aria-label={st.done ? "erledigt" : "offen"}
      >
        {st.done ? <Check className="size-6" /> : index + 1}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-lg">
          <RichText text={q.prompt} />
        </p>

        {q.kind === "answer" ? (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              store.submitAnswer(q.id);
            }}
          >
            <Input
              value={st.draft}
              onChange={(e) => store.setDraft(q.id, e.target.value)}
              placeholder={q.placeholder}
              disabled={st.done}
              readOnly={s.demo.running}
              aria-invalid={wrong || undefined}
              aria-label={`Antwort: ${q.prompt}`}
              className={cn("flex-1 font-mono", st.done && "border-primary text-primary disabled:opacity-100")}
            />
            <Button type="submit" disabled={st.done || s.demo.running}>
              Submit
            </Button>
          </form>
        ) : (
          <p className={cn("flex items-center gap-2 text-base", st.done ? "text-primary" : "text-foreground/60")}>
            {st.done ? <Check className="size-4" /> : <Circle className="size-4" />}
            {st.done ? "Im Terminal erkannt" : "Wird automatisch im Terminal erkannt."}
          </p>
        )}

        {st.feedback && q.kind === "answer" && (
          <p className={cn("flex items-center gap-2 text-base", st.feedback.ok ? "text-primary" : "text-destructive")} role="status">
            {st.feedback.ok ? <Check className="size-4" /> : <X className="size-4" />}
            {st.feedback.message}
          </p>
        )}

        {!st.done && (wrong || q.kind === "state") && <div>{hintButton}</div>}
        {st.showHint && !st.done && (
          <p className="rounded-base border border-foreground/10 p-3 text-base text-foreground/60">
            <RichText text={q.hint} />
          </p>
        )}
      </div>
    </div>
  );
}
