"use client";
import { Clock, Minus, Play, Plus, RotateCcw, Server, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getLabStore, useLab } from "@/lib/lab-store";
import { cn } from "@/lib/utils";
import { SessionTimer } from "./session-timer";

const STATUS = {
  off: { label: "Off", variant: "secondary" as const },
  starting: { label: "Starting…", variant: "outline" as const },
  running: { label: "Running", variant: "success" as const },
};

export function MachineBar() {
  const s = useLab();
  const store = getLabStore();
  const status = STATUS[s.machine];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Server className="size-6 text-primary" aria-hidden />
          <span className="text-xl font-semibold">linux-lab</span>
        </div>
        <Badge variant={status.variant} data-testid="machine-status">
          <span className={cn("size-2 rounded-base", s.machine === "off" ? "bg-foreground/60" : "bg-primary", s.machine === "starting" && "animate-pulse")} />
          {status.label}
        </Badge>
        <span className="flex items-center gap-1 text-base text-foreground/60" title="Laufzeit der Session">
          <Clock className="size-4" aria-hidden />
          <SessionTimer startedAt={s.startedAt} />
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {s.machine === "off" ? (
            <Button onClick={() => store.start()} data-testid="start-machine">
              <Play /> Maschine starten
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => store.stop()} disabled={s.demo.running}>
                <Square /> Stop
              </Button>
              <Button variant="outline" onClick={() => store.restart()} disabled={s.demo.running} title="Startet neu und setzt die Simulation zurück">
                <RotateCcw /> Neustart
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-foreground/60">
        <span>
          Benutzer <code className="font-mono text-foreground">student</code>
        </span>
        <span>
          Passwort <code className="font-mono text-foreground">student</code>
        </span>
        <span>Ubuntu 24.04 LTS (simuliert)</span>
        <span className="ml-auto flex items-center gap-1">
          Schrift
          <Button variant="ghost" size="icon" aria-label="Schrift kleiner" onClick={() => store.setFontStep(s.fontStep - 1)}>
            <Minus />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Schrift größer" onClick={() => store.setFontStep(s.fontStep + 1)}>
            <Plus />
          </Button>
        </span>
      </div>
    </div>
  );
}
