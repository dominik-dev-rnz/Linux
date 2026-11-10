/**
 * Tasks des Rooms. Prüffunktionen lesen den Zustand der Simulation nur.
 * Antworten stehen im Terminal, nicht im Text: Die erwarteten Werte werden
 * deshalb immer aus dem aktuellen Zustand berechnet.
 */
import { dateVariants, parseShadowDate } from "../sim/dates";
import { chageDate } from "../sim/dates";
import { isSudoer, modeString, type SimSystem } from "../sim";

export type SectionId = "grundlagen" | "dateien" | "befehle" | "pruefen" | "ablauf" | "demo" | "uebersicht";

export interface Expected {
  /** Text, den der Vorführmodus eintippt */
  value: string;
  accept: (normalizedInput: string) => boolean;
}

export interface AnswerQuestion {
  id: string;
  kind: "answer";
  prompt: string;
  placeholder: string;
  hint: string;
  expected: (sys: SimSystem) => Expected | { unavailable: string };
}

export interface StateQuestion {
  id: string;
  kind: "state";
  prompt: string;
  hint: string;
  check: (sys: SimSystem) => boolean;
  /** Wird erst geprüft, wenn diese Fragen erledigt sind (z. B. „entfernt“ erst nach „angelegt“) */
  requires?: string[];
}

export type Question = AnswerQuestion | StateQuestion;

export type Step = { cmd: string; inputs?: string[] } | { answer: string };

export interface Task {
  id: string;
  section: SectionId;
  title: string;
  intro: string;
  questions: Question[];
  solution: Step[];
}

// ------------------------------------------------------------------ Hilfen

export function normalize(input: string): string {
  return input
    .trim()
    .replace(/^["'`„“]+|["'`“”]+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const exact = (value: string): Expected => ({ value, accept: (s) => s === normalize(value) });
const oneOf = (value: string, ...others: string[]): Expected => ({
  value,
  accept: (s) => [value, ...others].some((v) => normalize(v) === s),
});

function nameSet(value: string[]): Expected {
  const want = [...value].sort().join(" ");
  return {
    value: value.join(" "),
    accept: (s) => {
      const cleaned = s.replace(/^[a-z0-9_-]+\s*:\s*/, "");
      return cleaned.split(/[\s,]+/).filter(Boolean).sort().join(" ") === want;
    },
  };
}

const missing = (name: string) => ({
  unavailable: `${name} existiert gerade nicht. Lege das Konto (erneut) an und prüfe dann im Terminal.`,
});

const GAST_EXPIRE = "2027-06-30";
const PW_DEMO = "Projekt2026!";
const PW_GAST = "Gast2026!";
/** Passwort von student (für sudo); der Vorführmodus tippt es automatisch. */
export const SUDO_PW = "student";

/** Erkennt die Passwortabfrage von sudo. */
export const isSudoPrompt = (prompt: string) => prompt.startsWith("[sudo] password for");

// ------------------------------------------------------------------ Tasks

export const TASKS: Task[] = [
  {
    id: "t1",
    section: "grundlagen",
    title: "Wer bin ich?",
    intro:
      "Starte die Maschine rechts. Mit `id` siehst du die UID, die primäre Gruppe (gid=) und alle zusätzlichen Gruppen (groups=) des angemeldeten Benutzers. `groups` zeigt nur die Gruppennamen.",
    questions: [
      {
        id: "t1-uid",
        kind: "answer",
        prompt: "Welche UID hat der Benutzer student?",
        placeholder: "z. B. 1234",
        hint: "Gib `id` ein und lies die Zahl hinter uid= ab.",
        expected: (sys) => {
          const u = sys.user("student");
          return u ? exact(String(u.uid)) : missing("student");
        },
      },
      {
        id: "t1-sudo",
        kind: "answer",
        prompt: "Über welche zusätzliche Gruppe darf student Befehle mit sudo ausführen?",
        placeholder: "Gruppenname",
        hint: "`groups` listet alle Gruppen auf. Unter Ubuntu ist es die Gruppe mit der GID 27 (siehe `id`).",
        expected: () => exact("sudo"),
      },
    ],
    solution: [{ cmd: "id" }, { answer: "t1-uid" }, { cmd: "groups" }, { answer: "t1-sudo" }],
  },
  {
    id: "t2",
    section: "dateien",
    title: "Die drei Dateien lesen",
    intro:
      "/etc/passwd und /etc/group darf jeder lesen. /etc/shadow enthält die Passwort-Hashes und ist geschützt. Probiere `cat /etc/shadow` als student aus und vergleiche mit `ls -l /etc/passwd /etc/shadow`.",
    questions: [
      {
        id: "t2-shell",
        kind: "answer",
        prompt: "Welche Login-Shell hat das Systemkonto www-data?",
        placeholder: "Pfad der Shell",
        hint: "`grep www-data /etc/passwd`: Die Shell steht im 7. (letzten) Feld.",
        expected: (sys) => {
          const u = sys.user("www-data");
          return u ? exact(u.shell) : missing("www-data");
        },
      },
      {
        id: "t2-group",
        kind: "answer",
        prompt: "Welcher Gruppe gehört die Datei /etc/shadow?",
        placeholder: "Gruppenname",
        hint: "`ls -l /etc/shadow`: Spalte 3 ist der Besitzer, Spalte 4 die Gruppe.",
        expected: (sys) => {
          const n = sys.get("/etc/shadow");
          return n ? exact(sys.groupById(n.gid)?.name ?? String(n.gid)) : { unavailable: "/etc/shadow fehlt." };
        },
      },
    ],
    solution: [
      { cmd: "grep www-data /etc/passwd" },
      { answer: "t2-shell" },
      { cmd: "cat /etc/shadow" },
      { cmd: "ls -l /etc/passwd /etc/shadow" },
      { answer: "t2-group" },
    ],
  },
  {
    id: "t3",
    section: "befehle",
    title: "Ein Konto anlegen",
    intro:
      "Verwaltungsbefehle brauchen Root-Rechte, also `sudo` davor. Das sudo-Passwort von student ist student (Eingabe bleibt unsichtbar). Ohne -m gibt es kein Home-Verzeichnis, ohne -s bekommt das Konto /bin/sh.",
    questions: [
      {
        id: "t3-gast",
        kind: "state",
        prompt: "Lege den Benutzer gast mit Home-Verzeichnis und der Shell /bin/bash an.",
        hint: "`sudo useradd -m -s /bin/bash gast`",
        check: (sys) => {
          const u = sys.user("gast");
          return !!u && u.shell === "/bin/bash" && sys.get(u.home)?.type === "dir";
        },
      },
      {
        id: "t3-pw",
        kind: "state",
        prompt: "Setze ein Passwort für gast.",
        hint: "`sudo passwd gast`: Das Passwort zweimal eingeben, man sieht beim Tippen nichts.",
        check: (sys) => {
          const u = sys.user("gast");
          return !!u && !!u.shadow.plain;
        },
      },
    ],
    solution: [
      { cmd: "sudo useradd -m -s /bin/bash gast" },
      { cmd: "sudo passwd gast", inputs: [PW_GAST, PW_GAST] },
      { cmd: "grep gast /etc/passwd" },
    ],
  },
  {
    id: "t4",
    section: "pruefen",
    title: "Gruppen prüfen und ergänzen",
    intro:
      "`usermod -aG` hängt eine Gruppe an. Ohne -a ersetzt -G alle bisherigen Zusatzgruppen, ein typischer Fehler! Prüfe vorher und nachher mit `groups gast`.",
    questions: [
      {
        id: "t4-users",
        kind: "state",
        prompt: "Füge gast zusätzlich der Gruppe users hinzu.",
        hint: "`sudo usermod -aG users gast` (oder `sudo gpasswd -a gast users`)",
        check: (sys) => !!sys.group("users")?.members.includes("gast"),
      },
      {
        id: "t4-groups",
        kind: "answer",
        prompt: "Welche Gruppen zeigt `groups gast` jetzt an? (alle, mit Leerzeichen getrennt)",
        placeholder: "gruppe1 gruppe2 …",
        hint: "Die Ausgabe hat die Form „gast : gruppe1 gruppe2“. Die Reihenfolge ist egal.",
        expected: (sys) => {
          const u = sys.user("gast");
          if (!u) return missing("gast");
          return nameSet(sys.groupIdsOf(u).map((g) => sys.groupById(g)?.name ?? String(g)));
        },
      },
    ],
    solution: [
      { cmd: "groups gast" },
      { cmd: "sudo usermod -aG users gast" },
      { cmd: "groups gast" },
      { answer: "t4-groups" },
    ],
  },
  {
    id: "t5",
    section: "ablauf",
    title: "Ablauf, Sperre und sudo",
    intro:
      "`chage -E` setzt ein Ablaufdatum für das ganze Konto, `passwd -l` sperrt das Passwort (in /etc/shadow steht dann ein ! vor dem Hash). `passwd -S` zeigt den Status: P = Passwort gesetzt, L = gesperrt, NP = kein Passwort.",
    questions: [
      {
        id: "t5-expire",
        kind: "state",
        prompt: `Lass das Konto gast am ${GAST_EXPIRE} ablaufen.`,
        hint: `\`sudo chage -E ${GAST_EXPIRE} gast\`, prüfen mit \`sudo chage -l gast\``,
        check: (sys) => sys.user("gast")?.shadow.expire === parseShadowDate(GAST_EXPIRE),
      },
      {
        id: "t5-lock",
        kind: "state",
        prompt: "Sperre das Passwort von gast (gast muss vorher ein Passwort haben).",
        hint: "`sudo passwd -l gast` oder `sudo usermod -L gast`",
        check: (sys) => {
          const u = sys.user("gast");
          return !!u && !!u.shadow.plain && u.shadow.hash.startsWith("!");
        },
      },
      {
        id: "t5-status",
        kind: "answer",
        prompt: "Welchen Status (2. Feld) zeigt `sudo passwd -S gast` an?",
        placeholder: "P, L oder NP",
        hint: "Die Ausgabe beginnt mit „gast X …“. Gesucht ist das X.",
        expected: (sys) => {
          const u = sys.user("gast");
          if (!u) return missing("gast");
          const h = u.shadow.hash;
          return exact(h.startsWith("!") || h === "*" ? "L" : h === "" ? "NP" : "P");
        },
      },
      {
        id: "t5-sudo",
        kind: "answer",
        prompt: "Darf gast Befehle mit sudo ausführen? Prüfe mit `sudo -l -U gast`. (ja/nein)",
        placeholder: "ja oder nein",
        hint: "Bei „is not allowed to run sudo“ lautet die Antwort nein. Prinzip der minimalen Rechte!",
        expected: (sys) => {
          if (!sys.user("gast")) return missing("gast");
          return isSudoer(sys, "gast") ? oneOf("ja", "yes", "j") : oneOf("nein", "no", "n");
        },
      },
    ],
    solution: [
      { cmd: `sudo chage -E ${GAST_EXPIRE} gast` },
      { cmd: "sudo chage -l gast" },
      { cmd: "sudo passwd -l gast" },
      { cmd: "sudo passwd -S gast" },
      { answer: "t5-status" },
      { cmd: "sudo -l -U gast" },
      { answer: "t5-sudo" },
    ],
  },
  {
    id: "t6",
    section: "demo",
    title: "Demo 1: Testbenutzer und gemeinsame Gruppe",
    intro:
      "Lege testuser1 und testuser2 mit Home-Verzeichnis an, dann die Gruppe projektgruppe, und ordne beide Benutzer zu. Zwei Wege: `usermod -aG` oder `gpasswd -a`. Prüfe mit `id` und `getent group projektgruppe`.",
    questions: [
      {
        id: "t6-users",
        kind: "state",
        prompt: "Lege testuser1 und testuser2 jeweils mit Home-Verzeichnis an.",
        hint: "`sudo useradd -m -s /bin/bash testuser1`, danach dasselbe für testuser2",
        check: (sys) =>
          ["testuser1", "testuser2"].every((n) => {
            const u = sys.user(n);
            return !!u && sys.get(u.home)?.type === "dir";
          }),
      },
      {
        id: "t6-group",
        kind: "state",
        prompt: "Lege die Gruppe projektgruppe an und mache beide Benutzer zu Mitgliedern.",
        hint: "`sudo groupadd projektgruppe`, dann `sudo usermod -aG projektgruppe testuser1` und `sudo gpasswd -a testuser2 projektgruppe`",
        check: (sys) => {
          const g = sys.group("projektgruppe");
          if (!g) return false;
          return ["testuser1", "testuser2"].every((n) => {
            const u = sys.user(n);
            return !!u && sys.groupIdsOf(u).includes(g.gid);
          });
        },
      },
      {
        id: "t6-uid",
        kind: "answer",
        prompt: "Welche UID hat testuser1?",
        placeholder: "z. B. 1234",
        hint: "`id testuser1`: die Zahl hinter uid=",
        expected: (sys) => {
          const u = sys.user("testuser1");
          return u ? exact(String(u.uid)) : missing("testuser1");
        },
      },
    ],
    solution: [
      { cmd: "sudo useradd -m -s /bin/bash testuser1" },
      { cmd: "sudo useradd -m -s /bin/bash testuser2" },
      { cmd: "sudo groupadd projektgruppe" },
      { cmd: "sudo usermod -aG projektgruppe testuser1" },
      { cmd: "sudo gpasswd -a testuser2 projektgruppe" },
      { cmd: "getent group projektgruppe" },
      { cmd: "id testuser1" },
      { answer: "t6-uid" },
    ],
  },
  {
    id: "t7",
    section: "demo",
    title: "Demo 2: Gemeinsames Verzeichnis mit Rechten",
    intro:
      "Erstelle /srv/projekt, setze Besitzer und Gruppe und gib die Rechte 2770: Besitzer und Gruppe dürfen alles, andere nichts, und das setgid-Bit (2) sorgt dafür, dass neue Dateien automatisch der Gruppe gehören. Prüfe mit `ls -ld`, `id` und `groups`.",
    questions: [
      {
        id: "t7-dir",
        kind: "state",
        prompt: "Erstelle /srv/projekt mit der Gruppe projektgruppe und den Rechten 2770.",
        hint: "`sudo mkdir /srv/projekt`, `sudo chgrp projektgruppe /srv/projekt`, `sudo chmod 2770 /srv/projekt`",
        check: (sys) => {
          const n = sys.get("/srv/projekt");
          const g = sys.group("projektgruppe");
          return !!n && !!g && n.type === "dir" && n.gid === g.gid && (n.mode & 0o7777) === 0o2770;
        },
      },
      {
        id: "t7-group",
        kind: "answer",
        prompt: "Welcher Gruppe gehört das Verzeichnis /srv/projekt?",
        placeholder: "Gruppenname",
        hint: "`ls -ld /srv/projekt`: die 4. Spalte",
        expected: (sys) => {
          const n = sys.get("/srv/projekt");
          return n ? exact(sys.groupById(n.gid)?.name ?? String(n.gid)) : { unavailable: "/srv/projekt existiert gerade nicht." };
        },
      },
      {
        id: "t7-mode",
        kind: "answer",
        prompt: "Welches Rechte-Muster zeigt `ls -ld /srv/projekt`?",
        placeholder: "z. B. drwxr-xr-x",
        hint: "Die erste Spalte der Ausgabe, 10 Zeichen. Achte auf das s bei der Gruppe.",
        expected: (sys) => {
          const n = sys.get("/srv/projekt");
          if (!n) return { unavailable: "/srv/projekt existiert gerade nicht." };
          const m = modeString(n);
          return oneOf(m, m.slice(1));
        },
      },
    ],
    solution: [
      { cmd: "sudo mkdir /srv/projekt" },
      { cmd: "sudo chown testuser1 /srv/projekt" },
      { cmd: "sudo chgrp projektgruppe /srv/projekt" },
      { cmd: "sudo chmod 2770 /srv/projekt" },
      { cmd: "ls -ld /srv/projekt" },
      { answer: "t7-group" },
      { answer: "t7-mode" },
      { cmd: "groups testuser2" },
      { cmd: "ls /srv/projekt" },
      { cmd: "sudo passwd testuser2", inputs: [PW_DEMO, PW_DEMO] },
      { cmd: "su - testuser2", inputs: [PW_DEMO] },
      { cmd: "touch /srv/projekt/protokoll.txt" },
      { cmd: "ls -l /srv/projekt" },
      { cmd: "exit" },
    ],
  },
  {
    id: "t8",
    section: "demo",
    title: "Demo 3: Passwortablauf und Aufräumen",
    intro:
      "`chage -M 90` erzwingt alle 90 Tage ein neues Passwort, `chage -l` zeigt alle Ablaufdaten. Zum Schluss werden die Testkonten mit `userdel -r` samt Home-Verzeichnis entfernt. Keine echten Hashes: In dieser Simulation steht in /etc/shadow nur ein Platzhalter.",
    questions: [
      {
        id: "t8-max",
        kind: "state",
        prompt: "Setze für testuser2 die maximale Gültigkeit des Passworts auf 90 Tage.",
        hint: "`sudo chage -M 90 testuser2`",
        check: (sys) => sys.user("testuser2")?.shadow.max === 90,
      },
      {
        id: "t8-expires",
        kind: "answer",
        prompt: "Wann läuft das Passwort von testuser2 ab?",
        placeholder: "Datum wie in der Ausgabe",
        hint: "`sudo chage -l testuser2`: die Zeile „Password expires“",
        expected: (sys) => {
          const u = sys.user("testuser2");
          if (!u) return missing("testuser2");
          const s = u.shadow;
          if (s.lastChange === 0) return oneOf("password must be changed");
          if (s.lastChange < 0 || s.max < 0 || s.max >= 10000) return oneOf("never", "nie", "niemals");
          const day = s.lastChange + s.max;
          const variants = dateVariants(day);
          return { value: chageDate(day), accept: (x) => variants.includes(x) };
        },
      },
      {
        id: "t8-removed",
        kind: "state",
        requires: ["t6-users"],
        prompt: "Entferne testuser1 und testuser2 samt Home-Verzeichnis.",
        hint: "`sudo userdel -r testuser1` und `sudo userdel -r testuser2`",
        check: (sys) =>
          !sys.user("testuser1") && !sys.user("testuser2") && !sys.get("/home/testuser1") && !sys.get("/home/testuser2"),
      },
    ],
    solution: [
      { cmd: "sudo chage -M 90 testuser2" },
      { cmd: "sudo chage -l testuser2" },
      { answer: "t8-expires" },
      { cmd: "sudo userdel -r testuser1" },
      { cmd: "sudo userdel -r testuser2" },
      { cmd: "sudo groupdel projektgruppe" },
      { cmd: "sudo rm -r /srv/projekt" },
      { cmd: "sudo userdel -r gast" },
      { cmd: "ls /home" },
    ],
  },
];

export const ALL_QUESTIONS: Question[] = TASKS.flatMap((t) => t.questions);

export function findQuestion(id: string): Question | undefined {
  return ALL_QUESTIONS.find((q) => q.id === id);
}

/** Darf die Zustandsfrage jetzt geprüft werden? */
export function stateReady(q: StateQuestion, isDone: (id: string) => boolean): boolean {
  return (q.requires ?? []).every(isDone);
}

export type CheckResult = { ok: true } | { ok: false; message: string };

export function checkAnswer(q: AnswerQuestion, input: string, sys: SimSystem): CheckResult {
  const n = normalize(input);
  if (!n) return { ok: false, message: "Bitte gib zuerst eine Antwort ein." };
  const exp = q.expected(sys);
  if ("unavailable" in exp) return { ok: false, message: exp.unavailable };
  return exp.accept(n) ? { ok: true } : { ok: false, message: "Leider falsch. Schau dir die Terminal-Ausgabe noch einmal genau an." };
}

/** Text, den der Vorführmodus für eine Frage eintippt. */
export function answerFor(q: AnswerQuestion, sys: SimSystem): string | null {
  const exp = q.expected(sys);
  return "unavailable" in exp ? null : exp.value;
}
