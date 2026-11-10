"use client";
import { useEffect, useRef } from "react";
import { Play, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLabStore, useLab, type Line } from "@/lib/lab-store";
import type { Prompt } from "@/lib/sim/types";
import { cn } from "@/lib/utils";

const FONT = ["text-sm", "text-base", "text-lg", "text-xl"];

function PromptLabel({ p }: { p: Prompt }) {
  return (
    <span className="select-none">
      <span className="font-bold text-primary">
        {p.user}@{p.host}
      </span>
      :<span className="font-bold">{p.cwd}</span>
      {p.symbol}{" "}
    </span>
  );
}

function LineView({ line }: { line: Line }) {
  if (line.kind === "prompt")
    return (
      <div>
        <PromptLabel p={line.prompt} />
        {line.text}
      </div>
    );
  if (line.kind === "ask")
    return (
      <div>
        {line.prompt}
        {line.text}
      </div>
    );
  return (
    <div className={cn(line.kind === "err" && "text-destructive", line.kind === "info" && "text-foreground/60")}>
      {line.text || " "}
    </div>
  );
}

export function Terminal() {
  const s = useLab();
  const store = getLabStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const running = s.machine === "running";

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [s.lines, s.input, s.ask, s.machine]);

  useEffect(() => {
    if (running && !s.demo.running) inputRef.current?.focus({ preventScroll: true });
  }, [running, s.demo.running]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (s.demo.running) {
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      store.submit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      store.historyStep(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      store.historyStep(1);
    } else if (e.key === "Tab") {
      e.preventDefault();
      store.tab();
    } else if (e.ctrlKey && e.key.toLowerCase() === "c" && !window.getSelection()?.toString()) {
      e.preventDefault();
      store.interrupt();
    } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      store.clearScreen();
    }
  };

  return (
    <div
      id="terminal"
      className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-base border border-foreground/20 bg-background font-mono", FONT[s.fontStep])}
      onClick={() => {
        if (!window.getSelection()?.toString()) inputRef.current?.focus({ preventScroll: true });
      }}
    >
      <div className="flex items-center gap-2 border-b border-foreground/10 px-4 py-2 font-sans text-sm text-foreground/60">
        <span className="size-3 rounded-base bg-destructive" aria-hidden />
        <span className="size-3 rounded-base bg-foreground/20" aria-hidden />
        <span className="size-3 rounded-base bg-primary" aria-hidden />
        <span className="ml-2">student@linux-lab: ~ (Simulation)</span>
      </div>

      {s.machine === "off" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center font-sans">
          <Power className="size-12 text-foreground/60" aria-hidden />
          <p className="text-xl">Die Maschine ist aus.</p>
          <p className="max-w-md text-base text-foreground/60">
            Starte die Maschine, um im simulierten Terminal Benutzer und Gruppen anzulegen. Alles läuft nur in deinem Browser.
          </p>
          <Button size="lg" onClick={() => store.start()}>
            <Play /> Maschine starten
          </Button>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words p-4 leading-relaxed"
          data-testid="terminal-output"
          aria-live="polite"
        >
          {s.lines.map((l) => (
            <LineView key={l.id} line={l} />
          ))}
          {running && (
            <label className="flex items-baseline">
              <span className="sr-only">Befehl eingeben</span>
              <span className="whitespace-pre">{s.ask ? s.ask.prompt : <PromptLabel p={s.prompt} />}</span>
              {s.ask?.hidden && <span className="inline-block h-4 w-2 animate-pulse bg-foreground/60" aria-hidden />}
              <input
                ref={inputRef}
                data-testid="terminal-input"
                value={s.input}
                onChange={(e) => store.setInput(e.target.value)}
                onKeyDown={onKeyDown}
                readOnly={s.demo.running}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label={s.ask ? s.ask.prompt : "Befehl eingeben"}
                className={cn(
                  "min-w-0 flex-1 bg-transparent p-0 outline-none caret-primary",
                  s.ask?.hidden && "text-transparent caret-transparent",
                )}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
