"use client";
import { Clapperboard, Square, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getLabStore, useLab } from "@/lib/lab-store";
import { TASKS } from "@/lib/room/tasks";
import { MachineBar } from "./machine-bar";
import { Terminal } from "./terminal";

export function LabPanel() {
  const s = useLab();
  const store = getLabStore();
  const demoTask = TASKS.findIndex((t) => t.id === s.demo.taskId);
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <MachineBar />
      <Alert>
        <TriangleAlert className="text-destructive" />
        <AlertTitle>Simulation – nur in einer Test-VM real ausführen</AlertTitle>
        <AlertDescription>Kein echtes Linux. Jeder Besucher hat seine eigene Kopie im Browser, nichts geht an einen Server.</AlertDescription>
      </Alert>
      {s.demo.running && (
        <Alert variant="success" data-testid="demo-banner">
          <Clapperboard />
          <AlertTitle>Vorführmodus läuft{demoTask >= 0 ? `: Task ${demoTask + 1}` : ""}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            Befehle und Antworten werden automatisch eingetippt.
            <Button size="sm" variant="outline" onClick={() => store.abortDemo()}>
              <Square /> Stopp
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <Terminal />
    </div>
  );
}
