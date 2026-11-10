import { describe, expect, test } from "vitest";
import { createLab, type SimSystem } from "@/lib/sim";
import { ALL_QUESTIONS, TASKS, answerFor, checkAnswer, isSudoPrompt, stateReady, SUDO_PW, type Step } from "@/lib/room/tasks";

const NOW = Date.UTC(2026, 10, 10, 9, 16);

/** Führt einen Schritt wie der Vorführmodus aus (sudo-Passwort automatisch). */
function runCmd(sys: SimSystem, step: Extract<Step, { cmd: string }>) {
  const gen = sys.run(step.cmd);
  const inputs = [...(step.inputs ?? [])];
  const out: string[] = [];
  let input: string | undefined;
  while (true) {
    const r = gen.next(input);
    if (r.done) return { code: r.value, out };
    input = undefined;
    const ev = r.value;
    if (ev.type === "output") out.push(`${ev.tone}:${ev.text}`);
    if (ev.type === "ask") {
      if (isSudoPrompt(ev.prompt)) input = SUDO_PW;
      else if (inputs.length) input = inputs.shift();
      else throw new Error(`unerwartete Rückfrage ${ev.prompt} bei ${step.cmd}`);
    }
  }
}

describe("Lösungsweg", () => {
  test("im Grundzustand ist keine Zustandsaufgabe erledigt", () => {
    const sys = createLab({ now: () => NOW });
    const ready = ALL_QUESTIONS.filter((q) => q.kind === "state" && stateReady(q, () => false) && q.check(sys));
    expect(ready.map((q) => q.id)).toEqual([]);
  });

  test("löst alle Aufgaben ohne Fehlermeldungen", () => {
    const sys = createLab({ now: () => NOW });
    const done = new Set<string>();
    const evaluate = () => {
      for (const q of ALL_QUESTIONS) if (q.kind === "state" && stateReady(q, (id) => done.has(id)) && q.check(sys)) done.add(q.id);
    };
    for (const task of TASKS) {
      for (const step of task.solution) {
        if ("cmd" in step) {
          const r = runCmd(sys, step);
          // Erwartete Fehler in der Demo: cat /etc/shadow und ls auf geschützten Ordner als student
          const expectedFail = step.cmd === "cat /etc/shadow" || step.cmd === "ls /srv/projekt";
          if (!expectedFail) expect(r.out.filter((o) => o.startsWith("err:") && !o.includes("mail spool")), step.cmd).toEqual([]);
          if (!expectedFail) expect(r.code, step.cmd).toBe(0);
          evaluate();
        } else {
          const q = ALL_QUESTIONS.find((x) => x.id === step.answer)!;
          if (q.kind !== "answer") throw new Error("keine Antwortfrage");
          const value = answerFor(q, sys);
          expect(value, q.id).not.toBeNull();
          expect(checkAnswer(q, value!, sys), q.id).toEqual({ ok: true });
          done.add(q.id);
        }
      }
      // Am Ende jedes Tasks müssen alle seine Fragen erledigt sein
      for (const q of task.questions) expect(done.has(q.id), `${task.id}/${q.id}`).toBe(true);
    }
    expect(done.size).toBe(ALL_QUESTIONS.length);
  });

  test("Antworten passen zur Terminal-Ausgabe", () => {
    const sys = createLab({ now: () => NOW });
    const ask = (id: string, input: string) => {
      const q = ALL_QUESTIONS.find((x) => x.id === id)!;
      if (q.kind !== "answer") throw new Error();
      return checkAnswer(q, input, sys).ok;
    };
    expect(ask("t1-uid", "1000")).toBe(true);
    expect(ask("t1-uid", " 1000 ")).toBe(true);
    expect(ask("t1-uid", "1001")).toBe(false);
    expect(ask("t1-sudo", "SUDO")).toBe(true);
    expect(ask("t2-shell", "/usr/sbin/nologin")).toBe(true);
    expect(ask("t2-group", "shadow")).toBe(true);
    expect(ask("t6-uid", "1001")).toBe(false); // testuser1 gibt es noch nicht
    for (const step of TASKS.flatMap((t) => t.solution)) {
      if ("cmd" in step && /^sudo (useradd|groupadd|usermod|gpasswd|mkdir|chown|chgrp|chmod|chage -M|passwd [a-z])/.test(step.cmd) && !step.cmd.includes("-l ")) runCmd(sys, step);
    }
    expect(ask("t4-groups", "gast : users gast")).toBe(true);
    expect(ask("t4-groups", "gast")).toBe(false);
    expect(ask("t6-uid", "1002")).toBe(true);
    expect(ask("t7-mode", "drwxrws---")).toBe(true);
    expect(ask("t7-mode", "rwxrws---")).toBe(true);
    expect(ask("t7-mode", "drwxrwx---")).toBe(false);
    expect(ask("t8-expires", "Feb 08, 2027")).toBe(true);
    expect(ask("t8-expires", "08.02.2027")).toBe(true);
    expect(ask("t8-expires", "2027-02-08")).toBe(true);
    expect(ask("t8-expires", "never")).toBe(false);
  });
});
