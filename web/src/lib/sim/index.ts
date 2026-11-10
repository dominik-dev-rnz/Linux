import { installBenutzer } from "./commands/benutzer";
import { installDateisystem } from "./commands/dateisystem";
import { installShell } from "./commands/shell";
import { createSystem, type SystemOptions } from "./system";
import type { SimSystem } from "./types";

export type { SimEvent, SimSystem, User, Group, FsNode, Session } from "./types";
export { modeString } from "./commands/dateisystem";
export { chageLines, statusLine, isSudoer, HASH_PLACEHOLDER } from "./commands/benutzer";

/** Baut die komplette Simulation im Grundzustand. */
export function createLab(options: SystemOptions = {}): SimSystem {
  const sys = createSystem(options);
  installShell(sys);
  installDateisystem(sys);
  installBenutzer(sys);
  sys.reset();
  return sys;
}

/** Führt eine Zeile aus und beantwortet Rückfragen mit den Werten aus `answers`. */
export function runLine(sys: SimSystem, line: string, answers: string[] = []) {
  const gen = sys.run(line);
  const out: { text: string; tone: "out" | "err" }[] = [];
  const asks: string[] = [];
  let input: string | undefined;
  let k = 0;
  while (true) {
    const step = gen.next(input);
    if (step.done) return { code: step.value, out, asks, text: out.map((o) => o.text).join("\n") };
    const ev = step.value;
    input = undefined;
    if (ev.type === "output") out.push({ text: ev.text, tone: ev.tone });
    else if (ev.type === "ask") {
      asks.push(ev.prompt);
      if (k >= answers.length) throw new Error(`Keine Antwort für Rückfrage "${ev.prompt}" in "${line}"`);
      input = answers[k++];
    }
  }
}
