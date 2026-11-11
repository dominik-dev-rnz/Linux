"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TaskList } from "@/components/room/task-list";
import { RoomComplete } from "@/components/room/room-complete";
import { COMMANDS } from "@/lib/content/data";
import { CodeBlock, FieldTable, H3, KeyPoint, P, Section } from "./blocks";
import { InlineCode, RichText } from "./rich-text";

// ------------------------------------------------------------------ 1 Grundlagen

function Grundlagen() {
  return (
    <Section id="grundlagen" lead="Jede Datei und jeder Prozess gehört einem Benutzer (UID) und einer Gruppe (GID). Linux rechnet mit Nummern, die Namen stehen in /etc/passwd und /etc/group.">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Benutzer und UID", "Eindeutige Nummer pro Konto. Rechte hängen an der UID, nicht am Namen."],
          ["Primäre Gruppe", "Steht in /etc/passwd. Neue Dateien bekommen diese Gruppe. Ubuntu legt pro Benutzer eine gleichnamige an."],
          ["Zusätzliche Gruppen", "Stehen in /etc/group und geben weitere Rechte, z. B. `sudo` oder `projektgruppe`."],
        ].map(([t, d]) => (
          <Card key={t}>
            <CardHeader>
              <CardTitle>{t}</CardTitle>
            </CardHeader>
            <CardContent>
              <P>
                <RichText text={d} />
              </P>
            </CardContent>
          </Card>
        ))}
      </div>

      <H3>Drei Arten von Konten</H3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kontotyp</TableHead>
            <TableHead>UID</TableHead>
            <TableHead>Beispiele</TableHead>
            <TableHead>Merkmale</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-semibold">root</TableCell>
            <TableCell className="font-mono">0</TableCell>
            <TableCell className="font-mono">root</TableCell>
            <TableCell>Darf alles. Unter Ubuntu kein direkter Login, stattdessen sudo.</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-semibold">Systemkonten</TableCell>
            <TableCell className="font-mono">1–999</TableCell>
            <TableCell className="font-mono">www-data, sshd</TableCell>
            <TableCell>Für Dienste. Kein Passwort, Shell /usr/sbin/nologin.</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-semibold">Normale Konten</TableCell>
            <TableCell className="font-mono">ab 1000</TableCell>
            <TableCell className="font-mono">student, testuser1</TableCell>
            <TableCell>Für Menschen. Home unter /home, Shell /bin/bash.</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <CodeBlock
        label="id zeigt UID, primäre Gruppe und alle Gruppen"
        code={"$ id\nuid=1000(student) gid=1000(student) groups=1000(student),4(adm),24(cdrom),27(sudo),30(dip),46(plugdev),100(users)"}
      />
      <TaskList section="grundlagen" />
    </Section>
  );
}

// ------------------------------------------------------------------ 2 Dateien

function Dateien() {
  return (
    <Section id="dateien" lead="Eine Zeile pro Konto bzw. Gruppe, Felder durch „:“ getrennt. Geändert wird mit Befehlen, nicht mit dem Editor.">
      <H3>/etc/passwd: Konten (644, für alle lesbar)</H3>
      <FieldTable
        line="testuser1:x:1001:1001:Test User:/home/testuser1:/bin/bash"
        fields={[
          ["Name", "Login-Name"],
          ["Passwort", "`x` = steht in /etc/shadow"],
          ["UID", "Benutzernummer"],
          ["GID", "primäre Gruppe"],
          ["GECOS", "Kommentar, z. B. voller Name"],
          ["Home", "Home-Verzeichnis"],
          ["Shell", "Login-Shell; `/usr/sbin/nologin` = kein Login"],
        ]}
      />

      <H3>/etc/shadow: Passwörter und Ablauf (640, root:shadow)</H3>
      <FieldTable
        line="testuser1:$y$…(gekürzt):20767:0:99999:7:::"
        fields={[
          ["Name", "wie in /etc/passwd"],
          ["Hash", "`$y$` = yescrypt (Ubuntu-Standard). `!` = gesperrt, `*` = kein Passwort-Login. Hier nur Platzhalter!"],
          ["Letzte Änderung", "Tage seit 1. 1. 1970; 0 = beim nächsten Login ändern"],
          ["Minimum", "Tage bis zur nächsten erlaubten Änderung"],
          ["Maximum", "Tage bis zum Ablauf (99999 = nie)"],
          ["Warnung", "Tage Vorwarnung"],
          ["Inaktiv", "Tage nach Ablauf bis zur Sperre"],
          ["Kontoablauf", "Ab diesem Tag ist das Konto gesperrt"],
          ["Reserviert", "ungenutzt"],
        ]}
      />

      <H3>/etc/group: Gruppen (644)</H3>
      <FieldTable
        line="projektgruppe:x:1003:testuser1,testuser2"
        fields={[
          ["Name", "Gruppenname"],
          ["Passwort", "`x` = steht in /etc/gshadow (selten genutzt)"],
          ["GID", "Gruppennummer"],
          ["Mitglieder", "Zusatzgruppe für diese Benutzer"],
        ]}
      />

      <CodeBlock
        label="Rechte im Vergleich"
        code={"$ ls -l /etc/passwd /etc/shadow /etc/group\n-rw-r--r-- 1 root root    636 Nov 10 09:16 /etc/group\n-rw-r--r-- 1 root root   1251 Nov 10 09:16 /etc/passwd\n-rw-r----- 1 root shadow  716 Nov 10 09:16 /etc/shadow"}
      />

      <KeyPoint title="Warum Hashes geschützt sein müssen" tone="warn">
        <ul className="flex list-disc flex-col gap-2 pl-6">
          <li>Hashes lassen sich offline durchprobieren (Wörterbuch, Brute Force).</li>
          <li>Darum liegen sie nicht im lesbaren /etc/passwd, sondern in /etc/shadow.</li>
          <li>Nie echte Hashes zeigen, nur Platzhalter wie <InlineCode>$y$…(gekürzt)</InlineCode>.</li>
        </ul>
      </KeyPoint>
      <TaskList section="dateien" />
    </Section>
  );
}

// ------------------------------------------------------------------ 3 Befehle

const COMMAND_CARDS: { cmd: string; syntax: string; desc: string; opts: [string, string][]; example: string }[] = [
  {
    cmd: "useradd",
    syntax: "useradd [Optionen] NAME",
    desc: "Legt ein Konto an. Ohne -m kein Home, ohne -s nur /bin/sh.",
    opts: [["-m", "Home anlegen"], ["-s SHELL", "Login-Shell"], ["-c TEXT", "Kommentar"], ["-g / -G", "primäre / Zusatzgruppen"], ["-u UID", "UID wählen"], ["-r", "Systemkonto"]],
    example: "sudo useradd -m -s /bin/bash testuser1",
  },
  {
    cmd: "usermod",
    syntax: "usermod [Optionen] NAME",
    desc: "Ändert ein Konto. Achtung: -G ohne -a ersetzt alle Zusatzgruppen.",
    opts: [["-aG GRUPPE", "Gruppe anhängen"], ["-G LISTE", "Gruppen ersetzen"], ["-l NEU", "umbenennen"], ["-s SHELL", "Shell ändern"], ["-L / -U", "sperren / entsperren"]],
    example: "sudo usermod -aG projektgruppe testuser1",
  },
  {
    cmd: "userdel",
    syntax: "userdel [Optionen] NAME",
    desc: "Löscht ein Konto.",
    opts: [["-r", "Home mitlöschen"], ["-f", "auch wenn angemeldet"]],
    example: "sudo userdel -r testuser1",
  },
  {
    cmd: "groupadd",
    syntax: "groupadd [Optionen] GRUPPE",
    desc: "Legt eine Gruppe an (GID ab 1000).",
    opts: [["-g GID", "GID wählen"], ["-r", "Systemgruppe"]],
    example: "sudo groupadd projektgruppe",
  },
  {
    cmd: "groupmod",
    syntax: "groupmod [Optionen] GRUPPE",
    desc: "Ändert Name oder GID einer Gruppe.",
    opts: [["-n NEU", "umbenennen"], ["-g GID", "neue GID"]],
    example: "sudo groupmod -n team projektgruppe",
  },
  {
    cmd: "gpasswd",
    syntax: "gpasswd [Option] GRUPPE",
    desc: "Verwaltet Gruppenmitglieder.",
    opts: [["-a NAME", "hinzufügen"], ["-d NAME", "entfernen"], ["-M LISTE", "Mitglieder setzen"], ["-A LISTE", "Gruppen-Admins"]],
    example: "sudo gpasswd -a testuser2 projektgruppe",
  },
  {
    cmd: "passwd",
    syntax: "passwd [Optionen] [NAME]",
    desc: "Setzt Passwörter. Für andere Konten braucht man root.",
    opts: [["(ohne)", "Passwort setzen"], ["-l / -u", "sperren / entsperren"], ["-S", "Status (P, L, NP)"], ["-e", "Änderung erzwingen"]],
    example: "sudo passwd testuser1",
  },
  {
    cmd: "chage",
    syntax: "chage [Optionen] NAME",
    desc: "Passwort- und Kontoablauf.",
    opts: [["-l", "anzeigen"], ["-M TAGE", "max. Gültigkeit"], ["-m TAGE", "Mindestalter"], ["-W TAGE", "Warnzeit"], ["-E DATUM", "Konto läuft ab"], ["-d 0", "Änderung erzwingen"]],
    example: "sudo chage -M 90 testuser2",
  },
];

function Befehle() {
  return (
    <Section id="befehle" lead="Alle Befehle ändern Systemdateien und brauchen Root-Rechte, also `sudo` davor.">
      <div className="grid gap-4 xl:grid-cols-2">
        {COMMAND_CARDS.map((c) => (
          <Card key={c.cmd}>
            <CardHeader>
              <CardTitle className="font-mono text-2xl text-primary">{c.cmd}</CardTitle>
              <CardDescription className="font-mono">{c.syntax}</CardDescription>
            </CardHeader>
            <CardContent>
              <P className="text-base">{c.desc}</P>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base">
                {c.opts.map(([o, d]) => (
                  <div key={o} className="contents">
                    <dt className="font-mono text-primary">{o}</dt>
                    <dd>{d}</dd>
                  </div>
                ))}
              </dl>
              <pre className="overflow-x-auto rounded-base bg-foreground/10 p-3 font-mono text-base">
                <span className="select-none text-primary">$ </span>
                {c.example}
              </pre>
            </CardContent>
          </Card>
        ))}
      </div>
      <TaskList section="befehle" />
    </Section>
  );
}

// ------------------------------------------------------------------ 4 Prüfen und Ändern

function Pruefen() {
  return (
    <Section id="pruefen" lead="Nach jeder Änderung prüfen: Wer ist in welcher Gruppe, wem gehört der Ordner?">
      <div className="grid gap-4 md:grid-cols-2">
        <CodeBlock label="Gruppen prüfen" code={"$ id testuser1\nuid=1001(testuser1) gid=1001(testuser1) groups=1001(testuser1),1003(projektgruppe)\n$ groups testuser2\ntestuser2 : testuser2 projektgruppe"} />
        <CodeBlock label="Eigentümer ändern" code={"$ sudo chown testuser1 /srv/projekt\n$ sudo chgrp projektgruppe /srv/projekt\n$ sudo chown testuser1:projektgruppe /srv/projekt"} />
      </div>
      <KeyPoint title="Neue Gruppen gelten erst nach neuer Anmeldung">
        <InlineCode>groups</InlineCode> ohne Namen zeigt die laufende Sitzung, <InlineCode>groups testuser1</InlineCode> die aktuelle Datenbank.
      </KeyPoint>

      <H3>ls -ld lesen</H3>
      <div className="overflow-x-auto rounded-base border border-foreground/10 p-4 font-mono text-lg">
        <div className="flex min-w-max gap-3">
          {[
            ["d", "Ordner"],
            ["rwx", "Besitzer"],
            ["rws", "Gruppe (s = setgid)"],
            ["---", "andere"],
            ["2", "Links"],
            ["testuser1", "Besitzer"],
            ["projektgruppe", "Gruppe"],
            ["4096 Nov 10 09:16 /srv/projekt", "Größe, Datum, Name"],
          ].map(([v, l], i) => (
            <div key={i} className="flex flex-col items-start gap-1">
              <span className={i < 4 ? "text-primary" : ""}>{v}</span>
              <span className="font-sans text-sm text-foreground/60">{l}</span>
            </div>
          ))}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ziffer</TableHead>
            <TableHead>Bedeutung</TableHead>
            <TableHead>Beispiel 2770</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-mono">r = 4, w = 2, x = 1</TableCell>
            <TableCell>Summe pro Stelle: 7 = rwx, 0 = ---</TableCell>
            <TableCell className="font-mono">770 → rwx rwx ---</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-mono">4 / 2 / 1 (vorne)</TableCell>
            <TableCell>setuid / setgid / sticky</TableCell>
            <TableCell className="font-mono">2 → neue Dateien erben die Gruppe</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <P className="text-foreground/60">Nur root ändert den Besitzer. Der Besitzer darf nur zu eigenen Gruppen wechseln.</P>
      <TaskList section="pruefen" />
    </Section>
  );
}

// ------------------------------------------------------------------ 5 Ablauf, Sperren, sudo

function Ablauf() {
  return (
    <Section id="ablauf" lead="Passwörter laufen ab, Konten werden gesperrt, Admin-Rechte gibt es nur gezielt.">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Passwortablauf</CardTitle>
            <CardDescription>chage -M</CardDescription>
          </CardHeader>
          <CardContent>
            <P className="text-base">
              Standard: läuft nie ab (99999). <InlineCode>chage -M 90</InlineCode> erzwingt alle 90 Tage ein neues.
            </P>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Kontoablauf</CardTitle>
            <CardDescription>chage -E</CardDescription>
          </CardHeader>
          <CardContent>
            <P className="text-base">Ab dem Datum ist kein Login mehr möglich. Ideal für Testkonten.</P>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gesperrte Konten</CardTitle>
            <CardDescription>passwd -l</CardDescription>
          </CardHeader>
          <CardContent>
            <P className="text-base">
              Setzt <InlineCode>!</InlineCode> vor den Hash. SSH-Schlüssel funktionieren aber weiter!
            </P>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>sudo</CardTitle>
            <CardDescription>Gruppe sudo</CardDescription>
          </CardHeader>
          <CardContent>
            <P className="text-base">
              Mitglieder dürfen alles, jeder Aufruf wird protokolliert. /etc/sudoers nur mit <InlineCode>visudo</InlineCode> bearbeiten.
            </P>
          </CardContent>
        </Card>
      </div>

      <CodeBlock label="Status prüfen" code={"$ sudo passwd -S testuser2\ntestuser2 P 11/10/2026 0 90 7 -1\n$ sudo -l -U testuser2\nUser testuser2 is not allowed to run sudo on linux-lab."} />

      <KeyPoint title="Prinzip der minimalen Rechte">
        <ul className="flex list-disc flex-col gap-2 pl-6">
          <li>Nur die Rechte, die für die Aufgabe nötig sind.</li>
          <li>Rechte über Gruppen statt über Einzelpersonen.</li>
          <li>770 statt 777, Testkonten ohne sudo, alte Konten löschen.</li>
        </ul>
      </KeyPoint>
      <TaskList section="ablauf" />
    </Section>
  );
}

// ------------------------------------------------------------------ 6 Demo

function Demo() {
  return (
    <Section id="demo" lead="Die Live-Demo in drei Teilen. In echt nur in einer Test-VM!">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["1", "Benutzer und Gruppe", "testuser1, testuser2 und projektgruppe anlegen"],
          ["2", "Verzeichnis und Rechte", "/srv/projekt mit 2770, prüfen mit ls -ld"],
          ["3", "Ablauf und Aufräumen", "chage -l, dann userdel -r"],
        ].map(([n, t, d]) => (
          <Card key={n}>
            <CardHeader>
              <Badge variant="outline" className="w-fit">
                Teil {n}
              </Badge>
              <CardTitle>{t}</CardTitle>
            </CardHeader>
            <CardContent>
              <P className="text-base text-foreground/60">{d}</P>
            </CardContent>
          </Card>
        ))}
      </div>
      <KeyPoint title="Keine echten Passwort-Hashes" tone="warn">
        In /etc/shadow stehen hier nur Platzhalter. Für die Ablaufdaten reicht <InlineCode>chage -l</InlineCode>.
      </KeyPoint>
      <TaskList section="demo" />
    </Section>
  );
}

// ------------------------------------------------------------------ 7 Übersicht

function Uebersicht() {
  return (
    <Section id="uebersicht" lead="Alle Befehle auf einen Blick.">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Befehl</TableHead>
            <TableHead>Zweck</TableHead>
            <TableHead>Wichtige Optionen</TableHead>
            <TableHead>Beispiel</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {COMMANDS.map((c) => (
            <TableRow key={c.cmd}>
              <TableCell className="whitespace-nowrap font-mono font-semibold text-primary">{c.cmd}</TableCell>
              <TableCell>{c.zweck}</TableCell>
              <TableCell className="text-base">{c.optionen}</TableCell>
              <TableCell className="font-mono text-base">{c.beispiel}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <RoomComplete />
    </Section>
  );
}

export function ContentSections() {
  return (
    <>
      <Grundlagen />
      <Dateien />
      <Befehle />
      <Pruefen />
      <Ablauf />
      <Demo />
      <Uebersicht />
    </>
  );
}
