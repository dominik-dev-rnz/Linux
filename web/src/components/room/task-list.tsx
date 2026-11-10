"use client";
import { Check, Clapperboard } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/content/rich-text";
import { getLabStore, useLab } from "@/lib/lab-store";
import { TASKS, type SectionId } from "@/lib/room/tasks";
import { QuestionRow } from "./question-row";

/** Die aufklappbaren Tasks eines Themenabschnitts */
export function TaskList({ section }: { section: SectionId }) {
  const s = useLab();
  const store = getLabStore();
  const tasks = TASKS.filter((t) => t.section === section);
  const ids = tasks.map((t) => t.id);
  const open = s.openTasks.filter((id) => ids.includes(id));
  return (
    <Accordion
      type="multiple"
      value={open}
      onValueChange={(v) => store.setOpenTasks([...s.openTasks.filter((id) => !ids.includes(id)), ...v])}
      className="mt-8 flex flex-col gap-4"
    >
      {tasks.map((task) => {
        const number = TASKS.indexOf(task) + 1;
        const done = task.questions.filter((q) => s.questions[q.id].done).length;
        const complete = done === task.questions.length;
        const active = s.demo.taskId === task.id;
        return (
          <AccordionItem key={task.id} value={task.id} id={`task-${task.id}`} data-testid={`task-${task.id}`} className="scroll-mt-12">
            <AccordionTrigger>
              <span className="flex flex-wrap items-center gap-3">
                <Badge variant={complete ? "default" : "outline"} className="text-base">
                  {complete && <Check />} Task {number}
                </Badge>
                <span className="text-xl">{task.title}</span>
                {active && (
                  <Badge variant="success">
                    <Clapperboard /> läuft
                  </Badge>
                )}
              </span>
              <span className="ml-auto shrink-0 font-mono text-base text-foreground/60">
                {done}/{task.questions.length}
              </span>
            </AccordionTrigger>
            <AccordionContent className="flex flex-col gap-4">
              <p className="text-lg text-foreground/60">
                <RichText text={task.intro} />
              </p>
              {task.questions.map((q, i) => (
                <QuestionRow key={q.id} q={q} index={i} />
              ))}
              <div className="flex justify-end border-t border-foreground/10 pt-4">
                <Button variant="outline" size="sm" onClick={() => store.runSolution(task.id)} disabled={s.demo.running}>
                  <Clapperboard /> Lösung vorführen
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
