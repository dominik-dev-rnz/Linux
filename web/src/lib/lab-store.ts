"use client";
/**
 * Zentraler Zustand der Seite: Maschine (Start/Stop/Neustart), Terminal,
 * Aufgabenfortschritt und Vorführmodus. Läuft komplett im Browser.
 */
import { useSyncExternalStore } from "react";
import { createLab, type SimEvent, type SimSystem } from "./sim";
import type { Prompt } from "./sim/types";
import {
  ALL_QUESTIONS,
  TASKS,
  answerFor,
  checkAnswer,
  findQuestion,
  isSudoPrompt,
  stateReady,
  SUDO_PW,
  type Step,
} from "./room/tasks";

export type MachineStatus = "off" | "starting" | "running";

type LineInput =
  | { kind: "prompt"; prompt: Prompt; text: string }
  | { kind: "ask"; prompt: string; text: string }
  | { kind: "out" | "err" | "info"; text: string };

export type Line = LineInput & { id: number };

export interface QuestionState {
  done: boolean;
  draft: string;
  /** Rückmeldung nach dem letzten Submit */
  feedback: { ok: boolean; message: string } | null;
  showHint: boolean;
}

export interface LabSnapshot {
  machine: MachineStatus;
  startedAt: number | null;
  lines: Line[];
  input: string;
  ask: { prompt: string; hidden: boolean } | null;
  prompt: Prompt;
  questions: Record<string, QuestionState>;
  openTasks: string[];
  demo: { running: boolean; taskId: string | null };
  /** Element, das ins Bild gescrollt werden soll (Vorführmodus) */
  focus: { id: string; n: number } | null;
  fontStep: number;
  hydrated: boolean;
}

const STORAGE_KEY = "vortrag4-room-v1";
const MAX_LINES = 600;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function freshQuestions(): Record<string, QuestionState> {
  return Object.fromEntries(ALL_QUESTIONS.map((q) => [q.id, { done: false, draft: "", feedback: null, showHint: false }]));
}

const BOOT_LINES = [
  "[  OK  ] Started systemd-journald.service - Journal Service.",
  "[  OK  ] Reached target local-fs.target - Local File Systems.",
  "[  OK  ] Started systemd-logind.service - User Login Management.",
  "[  OK  ] Started ssh.service - OpenBSD Secure Shell server.",
  "[  OK  ] Reached target multi-user.target - Multi-User System.",
  "",
  "Ubuntu 24.04.1 LTS linux-lab tty1",
  "",
  "linux-lab login: student",
];

function motd(): string[] {
  return [
    "Welcome to Ubuntu 24.04.1 LTS (GNU/Linux 6.8.0-45-generic x86_64)",
    "",
    " * Simulation: kein echtes Linux, echt nur in einer Test-VM",
    " * Hilfe:      help, Tab ergänzt, ↑/↓ = Verlauf",
    " * sudo:       Passwort von student ist student",
    "",
  ];
}

export class LabStore {
  private sys: SimSystem = createLab();
  private snap: LabSnapshot;
  private listeners = new Set<() => void>();
  private nextId = 1;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private pending: Generator<SimEvent, number, string | undefined> | null = null;
  private historyIndex: number | null = null;
  private demoAbort = false;
  private bootPromise: Promise<void> | null = null;
  /** Geschwindigkeit des Vorführmodus (1 = normal, 0 = sofort; für Tests) */
  speed = 1;

  constructor() {
    this.snap = {
      machine: "off",
      startedAt: null,
      lines: [],
      input: "",
      ask: null,
      prompt: this.sys.prompt(),
      questions: freshQuestions(),
      openTasks: ["t1"],
      demo: { running: false, taskId: null },
      focus: null,
      fontStep: 1,
      hydrated: false,
    };
  }

  // ------------------------------------------------------------ Grundlagen
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snap;
  /** Nur für Prüfungen und Tests: Zustand der Simulation (lesend verwenden!) */
  get system(): SimSystem {
    return this.sys;
  }

  private set(patch: Partial<LabSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    for (const l of this.listeners) l();
  }

  private push(...lines: LineInput[]) {
    const withIds = lines.map((l) => ({ ...l, id: this.nextId++ }) as Line);
    const all = [...this.snap.lines, ...withIds];
    this.set({ lines: all.length > MAX_LINES ? all.slice(-MAX_LINES) : all });
  }

  // ------------------------------------------------------------ Speicher
  hydrate() {
    if (this.snap.hydrated) return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("speed") === "0") this.speed = 0;
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { done?: string[]; drafts?: Record<string, string> };
        const questions = freshQuestions();
        for (const id of saved.done ?? []) if (questions[id]) questions[id].done = true;
        for (const [id, d] of Object.entries(saved.drafts ?? {})) if (questions[id]) questions[id].draft = d;
        this.set({ questions, hydrated: true });
        return;
      }
    } catch {
      // localStorage nicht verfügbar: ohne Speichern weitermachen
    }
    this.set({ hydrated: true });
  }

  private persist() {
    try {
      const q = this.snap.questions;
      const done = Object.keys(q).filter((id) => q[id].done);
      const drafts = Object.fromEntries(Object.entries(q).filter(([, s]) => s.draft).map(([id, s]) => [id, s.draft]));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ done, drafts }));
    } catch {
      // ignorieren
    }
  }

  // ------------------------------------------------------------ Maschine
  start(): Promise<void> {
    if (this.snap.machine === "running") return Promise.resolve();
    if (this.bootPromise) return this.bootPromise;
    this.set({ machine: "starting", lines: [], input: "", ask: null });
    const step = this.speed === 0 ? 0 : 260;
    this.bootPromise = new Promise<void>((resolve) => {
      BOOT_LINES.forEach((text, i) => {
        this.timers.push(setTimeout(() => this.push({ kind: "info", text }), step * (i + 1)));
      });
      this.timers.push(
        setTimeout(() => {
          this.bootPromise = null;
          this.set({ machine: "running", startedAt: Date.now(), lines: [], prompt: this.sys.prompt() });
          this.push(...motd().map((text) => ({ kind: "info" as const, text })));
          resolve();
        }, step * (BOOT_LINES.length + 2)),
      );
    });
    return this.bootPromise;
  }

  stop() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.bootPromise = null;
    this.pending = null;
    if (this.snap.demo.running) this.demoAbort = true;
    this.set({ machine: "off", startedAt: null, lines: [], input: "", ask: null });
  }

  /** Neustart: Zustand der Simulation zurücksetzen und neu booten. */
  restart(): Promise<void> {
    this.stop();
    this.sys.reset();
    this.historyIndex = null;
    this.set({ prompt: this.sys.prompt() });
    return this.start();
  }

  // ------------------------------------------------------------ Terminal
  setInput(value: string) {
    this.historyIndex = null;
    this.set({ input: value });
  }

  submit() {
    if (this.snap.machine !== "running") return;
    const text = this.snap.input;
    if (this.pending && this.snap.ask) {
      this.push({ kind: "ask", prompt: this.snap.ask.prompt, text: this.snap.ask.hidden ? "" : text });
      this.set({ input: "", ask: null });
      this.drive(text);
      return;
    }
    this.push({ kind: "prompt", prompt: this.sys.prompt(), text });
    this.set({ input: "" });
    this.historyIndex = null;
    this.pending = this.sys.run(text);
    this.drive(undefined);
  }

  /** Treibt den laufenden Befehl weiter, bis er fertig ist oder eine Rückfrage stellt. */
  private drive(value: string | undefined) {
    const gen = this.pending;
    if (!gen) return;
    let input = value;
    while (true) {
      const step = gen.next(input);
      input = undefined;
      if (step.done) {
        this.pending = null;
        this.set({ ask: null, prompt: this.sys.prompt() });
        this.evaluateState();
        return;
      }
      const ev = step.value;
      if (ev.type === "output") {
        this.push(...ev.text.split("\n").map((t) => ({ kind: ev.tone === "err" ? ("err" as const) : ("out" as const), text: t })));
      } else if (ev.type === "clear") {
        this.set({ lines: [] });
      } else {
        this.set({ ask: { prompt: ev.prompt, hidden: ev.hidden } });
        return;
      }
    }
  }

  interrupt() {
    if (this.snap.machine !== "running") return;
    if (this.pending && this.snap.ask) {
      this.push({ kind: "ask", prompt: this.snap.ask.prompt, text: "^C" });
      this.pending = null;
      this.set({ ask: null, input: "", prompt: this.sys.prompt() });
      return;
    }
    this.push({ kind: "prompt", prompt: this.sys.prompt(), text: this.snap.input + "^C" });
    this.set({ input: "" });
  }

  clearScreen() {
    this.set({ lines: [] });
  }

  historyStep(dir: -1 | 1) {
    if (this.snap.ask) return;
    const h = this.sys.history;
    if (!h.length) return;
    let i = this.historyIndex ?? h.length;
    i = Math.min(h.length, Math.max(0, i + dir));
    this.historyIndex = i;
    this.set({ input: i === h.length ? "" : h[i] });
  }

  tab() {
    if (this.snap.ask || this.snap.machine !== "running") return;
    const { line, candidates } = this.sys.complete(this.snap.input);
    if (candidates.length) {
      this.push({ kind: "prompt", prompt: this.sys.prompt(), text: this.snap.input }, { kind: "out", text: candidates.join("  ") });
    }
    this.set({ input: line });
  }

  setFontStep(step: number) {
    this.set({ fontStep: Math.max(0, Math.min(3, step)) });
  }

  // ------------------------------------------------------------ Aufgaben
  private evaluateState() {
    let changed = false;
    const questions = { ...this.snap.questions };
    for (const q of ALL_QUESTIONS) {
      if (q.kind === "state" && !questions[q.id].done && stateReady(q, (id) => questions[id].done) && q.check(this.sys)) {
        questions[q.id] = { ...questions[q.id], done: true, feedback: { ok: true, message: "Im Terminal erkannt" } };
        changed = true;
      }
    }
    if (changed) {
      this.set({ questions });
      this.persist();
    }
  }

  private patchQuestion(id: string, patch: Partial<QuestionState>) {
    this.set({ questions: { ...this.snap.questions, [id]: { ...this.snap.questions[id], ...patch } } });
  }

  setDraft(id: string, draft: string) {
    this.patchQuestion(id, { draft, feedback: null });
    this.persist();
  }

  submitAnswer(id: string) {
    const q = findQuestion(id);
    if (!q || q.kind !== "answer") return;
    const res = checkAnswer(q, this.snap.questions[id].draft, this.sys);
    if (res.ok) this.patchQuestion(id, { done: true, feedback: { ok: true, message: "Richtig!" } });
    else this.patchQuestion(id, { feedback: { ok: false, message: res.message } });
    this.persist();
  }

  toggleHint(id: string) {
    this.patchQuestion(id, { showHint: !this.snap.questions[id].showHint });
  }

  setOpenTasks(openTasks: string[]) {
    this.set({ openTasks });
  }

  resetProgress() {
    this.set({ questions: freshQuestions() });
    this.persist();
  }

  // ------------------------------------------------------------ Vorführmodus
  private focusOn(id: string) {
    this.set({ focus: { id, n: (this.snap.focus?.n ?? 0) + 1 } });
  }

  private async typeText(text: string, apply: (partial: string) => void) {
    const delay = 32 * this.speed;
    if (delay === 0) {
      apply(text);
      return;
    }
    for (let i = 1; i <= text.length; i++) {
      if (this.demoAbort) return;
      apply(text.slice(0, i));
      await sleep(delay + (text[i - 1] === " " ? delay : 0));
    }
  }

  private async runStep(step: Step) {
    const pause = (ms: number) => sleep(ms * this.speed);
    if ("cmd" in step) {
      if (this.snap.machine !== "running") await this.start();
      this.focusOn("terminal");
      await this.typeText(step.cmd, (t) => this.set({ input: t }));
      if (this.demoAbort) return;
      await pause(250);
      this.submit();
      const inputs = [...(step.inputs ?? [])];
      // Rückfragen (Passwörter) beantworten
      while (this.snap.ask && !this.demoAbort) {
        await pause(450);
        const answer = isSudoPrompt(this.snap.ask.prompt) ? SUDO_PW : inputs.shift();
        if (answer === undefined) {
          this.interrupt();
          break;
        }
        await this.typeText(answer, (t) => this.set({ input: t }));
        await pause(150);
        this.submit();
      }
      await pause(700);
    } else {
      const q = findQuestion(step.answer);
      if (!q || q.kind !== "answer") return;
      if (this.snap.questions[q.id].done) return;
      const value = answerFor(q, this.sys);
      if (value === null) return;
      this.focusOn(`q-${q.id}`);
      await pause(400);
      await this.typeText(value, (t) => this.patchQuestion(q.id, { draft: t, feedback: null }));
      if (this.demoAbort) return;
      await pause(300);
      this.submitAnswer(q.id);
      await pause(800);
    }
  }

  /** Spielt den Lösungsweg ab: alle Tasks (mit Neustart) oder nur einen. */
  async runSolution(taskId: string | "all") {
    if (this.snap.demo.running) return;
    this.demoAbort = false;
    const tasks = taskId === "all" ? TASKS : TASKS.filter((t) => t.id === taskId);
    this.set({ demo: { running: true, taskId: tasks[0]?.id ?? null } });
    try {
      if (taskId === "all") {
        this.resetProgress();
        const booting = this.restart();
        this.demoAbort = false; // restart() ruft stop() auf, das würde die Vorführung abbrechen
        await booting;
      } else if (this.snap.machine !== "running") {
        await this.start();
      }
      for (const task of tasks) {
        if (this.demoAbort) break;
        const open = this.snap.openTasks.includes(task.id) ? this.snap.openTasks : [...this.snap.openTasks, task.id];
        this.set({ demo: { running: true, taskId: task.id }, openTasks: open });
        this.focusOn(`task-${task.id}`);
        await sleep(500 * this.speed);
        for (const step of task.solution) {
          if (this.demoAbort) break;
          await this.runStep(step);
        }
      }
    } finally {
      this.set({ demo: { running: false, taskId: null } });
    }
  }

  abortDemo() {
    this.demoAbort = true;
  }
}

// ------------------------------------------------------------ React-Anbindung

let store: LabStore | null = null;
export function getLabStore(): LabStore {
  store ??= new LabStore();
  return store;
}

export function useLab(): LabSnapshot {
  const s = getLabStore();
  return useSyncExternalStore(s.subscribe, s.getSnapshot, s.getSnapshot);
}

export const TOTAL_QUESTIONS = ALL_QUESTIONS.length;

export function countDone(questions: Record<string, QuestionState>): number {
  return Object.values(questions).filter((q) => q.done).length;
}
