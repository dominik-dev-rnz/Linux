"use client";
import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { countDone, TOTAL_QUESTIONS, useLab } from "@/lib/lab-store";

export function RoomComplete() {
  const s = useLab();
  const done = countDone(s.questions);
  if (done < TOTAL_QUESTIONS) {
    return (
      <Card className="items-center text-center text-foreground/60">
        <Trophy className="size-12" aria-hidden />
        <p className="text-xl">
          Noch {TOTAL_QUESTIONS - done} von {TOTAL_QUESTIONS} Aufgaben offen.
        </p>
      </Card>
    );
  }
  return (
    <Card className="items-center border-primary text-center" data-testid="room-completed">
      <span className="flex items-center justify-center rounded-base border-2 border-primary p-6 text-primary">
        <Trophy className="size-12" aria-hidden />
      </span>
      <p className="text-3xl font-bold text-primary">Room completed</p>
      <p className="text-lg text-foreground/60">Alle {TOTAL_QUESTIONS} Aufgaben gelöst. Stark!</p>
    </Card>
  );
}
