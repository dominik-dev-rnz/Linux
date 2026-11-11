import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ABLAUFPLAN, COMMANDS, QUELLEN } from "@/lib/content/data";

export const metadata: Metadata = { title: "Handout – Vortrag 4: Benutzer- und Gruppenverwaltung" };

const PAGES = 3;

/** Ein A4-Blatt: auf dem Bildschirm als Papier, beim Drucken mit Seitenumbruch danach. */
function Sheet({ nr, title, children }: { nr: number; title: string; children: React.ReactNode }) {
  return (
    <section className="theme-light mx-auto flex aspect-[210/297] w-full max-w-4xl flex-col gap-4 bg-background p-12 text-foreground break-after-page last:break-after-auto print:aspect-auto print:max-w-none print:p-0">
      <header className="flex items-end justify-between gap-4 border-b-2 border-foreground pb-2">
        <div>
          <p className="font-mono text-xs">Linux · Fachvortrag 4 · Benutzer- und Gruppenverwaltung</p>
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        <p className="font-mono text-xs text-foreground/60">Handout</p>
      </header>
      <div className="flex flex-1 flex-col gap-4 text-sm leading-relaxed">{children}</div>
      <footer className="flex justify-between border-t border-foreground/20 pt-2 text-xs text-foreground/60">
        <span>Ubuntu 24.04 LTS · Beispiele nur in einer Test-VM ausführen</span>
        <span>
          Seite {nr} von {PAGES}
        </span>
      </footer>
    </section>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold">{children}</h2>;
}

const Code = ({ children }: { children: React.ReactNode }) => <code className="font-mono font-semibold">{children}</code>;

function Line({ children }: { children: React.ReactNode }) {
  return <pre className="whitespace-pre-wrap break-all rounded-base border border-foreground/20 px-3 py-1 font-mono text-xs">{children}</pre>;
}

function FileBlock({ path, rights, line, fields }: { path: string; rights: string; line: string; fields: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p>
        <Code>{path}</Code> <span className="text-foreground/60">({rights})</span>
      </p>
      <Line>{line}</Line>
      <p className="text-xs">{fields}</p>
    </div>
  );
}

export default function HandoutPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-foreground/10 px-4 py-4 lg:px-8">
        <Button variant="ghost" size="lg" asChild>
          <Link href="/">
            <ArrowLeft /> Zurück zur Präsentation
          </Link>
        </Button>
        <p className="text-base text-foreground/60">Druckansicht: {PAGES} Seiten A4. Kopf- und Fußzeilen des Browsers im Druckdialog am besten ausschalten.</p>
        <div className="flex flex-wrap gap-2">
          <ThemeToggle />
          <PrintButton />
        </div>
      </div>

      <article className="flex flex-col gap-8 px-4 py-8 print:gap-0 print:p-0">
        {/* ------------------------------------------------ Seite 1 */}
        <Sheet nr={1} title="Grundlagen und die drei Dateien">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <H2>Benutzer und Gruppen</H2>
              <p>
                <b>UID</b> (User ID): eindeutige Nummer eines Kontos. <b>GID</b> (Group ID): Nummer einer Gruppe. Linux prüft Rechte über diese Nummern, nicht über
                Namen.
              </p>
              <p>
                <b>Primäre Gruppe</b>: steht in /etc/passwd, neue Dateien bekommen diese Gruppe. Ubuntu legt pro Benutzer eine gleichnamige Gruppe an.
              </p>
              <p>
                <b>Zusätzliche Gruppen</b>: stehen in /etc/group und geben weitere Rechte, z. B. <Code>sudo</Code> oder <Code>projektgruppe</Code>.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <H2>Drei Arten von Konten</H2>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-foreground text-left">
                    <th className="py-1 pr-2">Typ</th>
                    <th className="py-1 pr-2">UID</th>
                    <th className="py-1">Merkmale</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <tr className="border-b border-foreground/20">
                    <td className="py-1 pr-2 font-semibold">root</td>
                    <td className="py-1 pr-2 font-mono">0</td>
                    <td className="py-1">darf alles; Login unter Ubuntu gesperrt, stattdessen sudo</td>
                  </tr>
                  <tr className="border-b border-foreground/20">
                    <td className="py-1 pr-2 font-semibold">Systemkonten</td>
                    <td className="py-1 pr-2 font-mono">1–999</td>
                    <td className="py-1">für Dienste (www-data, sshd), kein Passwort, Shell /usr/sbin/nologin</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-2 font-semibold">normale Konten</td>
                    <td className="py-1 pr-2 font-mono">ab 1000</td>
                    <td className="py-1">für Menschen, Home unter /home, Shell /bin/bash</td>
                  </tr>
                </tbody>
              </table>
              <Line>{"$ id\nuid=1000(student) gid=1000(student)\ngroups=1000(student),27(sudo),…"}</Line>
            </div>
          </div>

          <H2>Die drei Dateien (eine Zeile pro Konto bzw. Gruppe, Felder mit „:“ getrennt)</H2>
          <FileBlock
            path="/etc/passwd"
            rights="644, lesbar für alle"
            line="testuser1:x:1001:1001:Test User:/home/testuser1:/bin/bash"
            fields="Name : x (Hash steht in /etc/shadow) : UID : GID der primären Gruppe : Kommentar : Home-Verzeichnis : Login-Shell"
          />
          <FileBlock
            path="/etc/shadow"
            rights="640, nur root und Gruppe shadow"
            line="testuser1:$y$…(gekürzt):20767:0:99999:7:::"
            fields="Name : Passwort-Hash : letzte Änderung (Tage seit 1.1.1970) : Minimum : Maximum : Warntage : inaktiv : Kontoablauf : reserviert. ! vor dem Hash = gesperrt, * = kein Passwort-Login."
          />
          <FileBlock
            path="/etc/group"
            rights="644, lesbar für alle"
            line="projektgruppe:x:1003:testuser1,testuser2"
            fields="Gruppenname : x (Gruppenpasswort in /etc/gshadow) : GID : Mitglieder (Komma, ohne Leerzeichen)"
          />

          <div className="rounded-base border-2 border-foreground p-3">
            <H2>Warum Passwort-Hashes geschützt sein müssen</H2>
            <ul className="list-disc pl-4">
              <li>Ein Hash lässt sich nicht zurückrechnen, aber offline durchprobieren (Wörterbuch- und Brute-Force-Angriffe), ohne dass das System es merkt.</li>
              <li>Früher stand der Hash im lesbaren /etc/passwd. Deshalb wurde er nach /etc/shadow ausgelagert.</li>
              <li>Salt und langsame Verfahren wie yescrypt ($y$, Standard seit Ubuntu 22.04) bremsen Angriffe, schützen aber keine schwachen Passwörter.</li>
              <li>Nie echte Hashes zeigen: in Vorträgen und Screenshots nur Platzhalter wie $y$…(gekürzt).</li>
            </ul>
          </div>
        </Sheet>

        {/* ------------------------------------------------ Seite 2 */}
        <Sheet nr={2} title="Ablaufplan: Anlegen, Ändern, Entfernen">
          <p>
            Szenario der Demo: zwei Testkonten teilen sich über die Gruppe <Code>projektgruppe</Code> den Ordner <Code>/srv/projekt</Code>. Alle Befehle brauchen
            Root-Rechte, daher <Code>sudo</Code>.
          </p>
          {ABLAUFPLAN.map((phase, pi) => (
            <div key={phase.phase} className="flex flex-col gap-2">
              <H2>
                {pi + 1}. {phase.phase}
              </H2>
              <ol className="grid grid-cols-2 gap-x-4 gap-y-2">
                {phase.steps.map((step, si) => (
                  <li key={step.title} className="break-inside-avoid rounded-base border border-foreground/20 p-2">
                    <p className="font-semibold">
                      {pi + 1}.{si + 1} {step.title}
                    </p>
                    {step.commands.map((c) => (
                      <p key={c} className="font-mono text-xs">
                        $ {c}
                      </p>
                    ))}
                    {step.note && <p className="text-xs italic text-foreground/60">{step.note}</p>}
                  </li>
                ))}
              </ol>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <H2>ls -ld lesen</H2>
              <Line>{"$ ls -ld /srv/projekt\ndrwxrws--- 2 testuser1 projektgruppe …"}</Line>
              <p className="text-xs">
                d = Ordner · rwx = Besitzer · rws = Gruppe (s = setgid) · --- = andere · dann Besitzer und Gruppe. Neue Gruppen gelten erst nach neuer Anmeldung.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <H2>Rechte 2770</H2>
              <p className="text-xs">
                r = 4, w = 2, x = 1, pro Stelle addiert. <b>2</b> = setgid: neue Dateien erben die Gruppe des Ordners. <b>7</b> = Besitzer rwx, <b>7</b> = Gruppe rwx,{" "}
                <b>0</b> = andere nichts. Nur root ändert den Besitzer (chown); der Besitzer darf mit chgrp nur auf eigene Gruppen wechseln.
              </p>
            </div>
          </div>
        </Sheet>

        {/* ------------------------------------------------ Seite 3 */}
        <Sheet nr={3} title="Befehlsübersicht, Sicherheit und Quellen">
          <table className="w-full border-collapse text-xs leading-snug">
            <thead>
              <tr className="border-b-2 border-foreground text-left">
                <th className="py-1 pr-2">Befehl</th>
                <th className="py-1 pr-2">Zweck</th>
                <th className="py-1 pr-2">Wichtige Optionen</th>
                <th className="py-1">Beispiel</th>
              </tr>
            </thead>
            <tbody>
              {COMMANDS.map((c) => (
                <tr key={c.cmd} className="break-inside-avoid border-b border-foreground/20 align-top">
                  <td className="whitespace-nowrap py-1 pr-2 font-mono font-bold">{c.cmd}</td>
                  <td className="py-1 pr-2">{c.zweck}</td>
                  <td className="py-1 pr-2">{c.optionen}</td>
                  <td className="py-1 font-mono">{c.beispiel}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-base border border-foreground/20 p-3">
              <H2>Ablauf, Sperren, sudo</H2>
              <ul className="list-disc pl-4 text-xs">
                <li>
                  <Code>chage -M 90</Code>: Passwort läuft nach 90 Tagen ab; <Code>chage -E DATUM</Code>: Konto läuft ab; <Code>chage -l</Code> zeigt alles.
                </li>
                <li>
                  <Code>passwd -l</Code> sperrt das Passwort (SSH-Schlüssel gehen weiter!), <Code>passwd -S</Code> zeigt P / L / NP.
                </li>
                <li>sudo nur für Admins (Gruppe sudo); jeder Aufruf wird protokolliert; /etc/sudoers nur mit visudo bearbeiten.</li>
              </ul>
            </div>
            <div className="rounded-base border-2 border-foreground p-3">
              <H2>Prinzip der minimalen Rechte</H2>
              <ul className="list-disc pl-4 text-xs">
                <li>Nur die Rechte vergeben, die für die Aufgabe nötig sind.</li>
                <li>Rechte über Gruppen statt über Einzelpersonen.</li>
                <li>Ordner mit 770 statt 777, Testkonten ohne sudo.</li>
                <li>Nicht mehr benötigte Konten entfernen (userdel -r).</li>
              </ul>
            </div>
          </div>

          <div>
            <H2>Quellen</H2>
            <ul className="list-disc pl-4 text-xs">
              {QUELLEN.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        </Sheet>
      </article>
    </div>
  );
}
