import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";
import { ABLAUFPLAN, COMMANDS, QUELLEN } from "@/lib/content/data";

export const metadata: Metadata = { title: "Handout – Vortrag 4: Benutzer- und Gruppenverwaltung" };

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-base border border-background/20 p-3">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide">{title}</h2>
      <div className="text-sm leading-snug">{children}</div>
    </section>
  );
}

const Code = ({ children }: { children: React.ReactNode }) => <code className="font-mono font-semibold">{children}</code>;

export default function HandoutPage() {
  return (
    <div className="min-h-screen bg-background print:bg-foreground">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-foreground/10 px-4 py-4 lg:px-8">
        <Button variant="ghost" size="lg" asChild>
          <Link href="/">
            <ArrowLeft /> Zurück zur Präsentation
          </Link>
        </Button>
        <p className="text-base text-foreground/60">Druckansicht: A4, 2 Seiten. Im Druckdialog „Hintergrundgrafiken“ ist nicht nötig.</p>
        <PrintButton />
      </div>

      <article className="handout mx-auto my-8 flex max-w-5xl flex-col gap-3 bg-foreground p-8 text-background print:m-0 print:max-w-none print:p-0">
        <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-background pb-2">
          <div>
            <p className="font-mono text-xs">Linux · Fachvortrag 4 · Handout</p>
            <h1 className="text-2xl font-bold">Benutzer- und Gruppenverwaltung</h1>
          </div>
          <p className="max-w-md text-xs text-background/60">Wie Linux Benutzerkonten und Gruppen organisiert und wie ein Administrator Zugriffsrechte gezielt zuweist (Ubuntu 24.04 LTS).</p>
        </header>

        <div className="grid grid-cols-3 gap-3">
          <Box title="Grundbegriffe">
            <p><b>UID</b>: Nummer eines Benutzers; <b>GID</b>: Nummer einer Gruppe. Rechte hängen an den Nummern.</p>
            <p className="mt-1"><b>Primäre Gruppe</b> (in /etc/passwd): Gruppe neuer Dateien. <b>Zusätzliche Gruppen</b> (in /etc/group): weitere Rechte.</p>
            <p className="mt-1"><b>root</b> UID 0 · <b>Systemkonten</b> 1–999 (Dienste, nologin) · <b>normale Konten</b> ab 1000.</p>
          </Box>
          <Box title="Die drei Dateien">
            <p><Code>/etc/passwd</Code> (644): name:x:UID:GID:Kommentar:Home:Shell</p>
            <p className="mt-1"><Code>/etc/shadow</Code> (640, root:shadow): name:Hash:letzte Änderung:min:max:Warnung:inaktiv:Ablauf:</p>
            <p className="mt-1"><Code>/etc/group</Code> (644): gruppe:x:GID:mitglied1,mitglied2</p>
          </Box>
          <Box title="Warum Hashes schützen?">
            <p>Hashes lassen sich offline per Wörterbuch und Brute Force durchprobieren. Deshalb stehen sie nicht im lesbaren /etc/passwd, sondern im geschützten /etc/shadow. <b>!</b> vor dem Hash = gesperrt, <b>*</b> = kein Passwort-Login.</p>
          </Box>
        </div>

        <h2 className="mt-1 text-lg font-bold">Ablaufplan</h2>
        <div className="grid grid-cols-3 gap-3">
          {ABLAUFPLAN.map((phase, pi) => (
            <Box key={phase.phase} title={`${pi + 1}. ${phase.phase}`}>
              <ol className="flex flex-col gap-1">
                {phase.steps.map((step) => (
                  <li key={step.title}>
                    <p className="font-semibold">{step.title}</p>
                    {step.commands.map((c) => (
                      <p key={c} className="font-mono text-xs">$ {c}</p>
                    ))}
                    {step.note && <p className="text-xs italic text-background/60">{step.note}</p>}
                  </li>
                ))}
              </ol>
            </Box>
          ))}
        </div>

        <h2 className="mt-1 text-lg font-bold">Befehlsübersicht</h2>
        <table className="w-full border-collapse text-xs leading-snug">
          <thead>
            <tr className="border-b-2 border-background text-left">
              <th className="py-1 pr-2">Befehl</th>
              <th className="py-1 pr-2">Zweck</th>
              <th className="py-1 pr-2">Wichtige Optionen</th>
              <th className="py-1">Beispiel</th>
            </tr>
          </thead>
          <tbody>
            {COMMANDS.map((c) => (
              <tr key={c.cmd} className="break-inside-avoid border-b border-background/20 align-top">
                <td className="whitespace-nowrap py-1 pr-2 font-mono font-bold">{c.cmd}</td>
                <td className="py-1 pr-2">{c.zweck}</td>
                <td className="py-1 pr-2">{c.optionen}</td>
                <td className="py-1 font-mono">{c.beispiel}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-3">
          <Box title="Sicherheit: Ablauf, Sperren, sudo">
            <ul className="list-disc pl-4">
              <li><Code>chage -M 90</Code> Passwort läuft nach 90 Tagen ab, <Code>chage -E DATUM</Code> Konto läuft ab.</li>
              <li><Code>passwd -l</Code> sperrt das Passwort (SSH-Schlüssel gehen weiter!), <Code>passwd -S</Code> zeigt P / L / NP.</li>
              <li>sudo nur für Admins (Gruppe sudo), Aufrufe werden protokolliert, /etc/sudoers nur mit visudo.</li>
              <li><b>Minimale Rechte</b>: Rechte über Gruppen, 770 statt 777, Testkonten ohne sudo, alte Konten löschen.</li>
            </ul>
          </Box>
          <Box title="Quellen">
            <ul className="list-disc pl-4">
              {QUELLEN.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </Box>
        </div>
      </article>
    </div>
  );
}
