"use client";
import Link from "next/link";
import { Clapperboard, Printer, RotateCcw, Square, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLabStore, useLab } from "@/lib/lab-store";

export function SiteHeader() {
  const s = useLab();
  const store = getLabStore();
  return (
    <header className="py-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-4xl">
          <p className="flex items-center gap-2 font-mono text-base text-primary">
            <Terminal className="size-4" aria-hidden /> Linux · Fachvortrag
          </p>
          <h1 className="mt-2 text-4xl font-bold leading-tight lg:text-5xl">Vortrag 4 – Benutzer- und Gruppenverwaltung</h1>
          <p className="mt-4 text-xl text-foreground/60">
            <span className="font-semibold text-foreground">Arbeitsauftrag:</span> Erklärt, wie Linux Benutzerkonten und Gruppen organisiert und wie ein Administrator Zugriffsrechte gezielt zuweist.
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          {s.demo.running ? (
            <Button variant="destructive" size="lg" onClick={() => store.abortDemo()}>
              <Square /> Vorführung stoppen
            </Button>
          ) : (
            <Button size="lg" onClick={() => store.runSolution("all")} data-testid="run-all" title="Startet die Maschine neu und spielt alle Tasks ab">
              <Clapperboard /> Lösungsweg zeigen
            </Button>
          )}
          <Button variant="outline" size="lg" asChild>
            <Link href="/handout/">
              <Printer /> Handout (Druckansicht)
            </Link>
          </Button>
          <Button variant="ghost" size="lg" onClick={() => store.resetProgress()} disabled={s.demo.running}>
            <RotateCcw /> Fortschritt zurücksetzen
          </Button>
        </div>
      </div>
    </header>
  );
}
