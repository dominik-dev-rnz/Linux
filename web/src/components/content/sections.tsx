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
    <Section
      id="grundlagen"
      lead="Jeder Prozess und jede Datei gehört einem Benutzer und einer Gruppe. Linux rechnet intern nur mit Nummern: der UID (User ID) und der GID (Group ID). Die Namen dazu stehen in /etc/passwd und /etc/group."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Benutzer und UID", "Eindeutige Nummer pro Konto. Rechte hängen an der UID, nicht am Namen: Wird ein Konto gelöscht, zeigt `ls -l` bei seinen Dateien nur noch die Zahl."],
          ["Primäre Gruppe (GID)", "Steht in /etc/passwd. Neue Dateien bekommen diese Gruppe. Ubuntu legt für jeden Benutzer eine gleichnamige Gruppe an (User Private Group)."],
          ["Zusätzliche Gruppen", "Stehen in /etc/group im 4. Feld. Sie geben weitere Rechte, z. B. `sudo` für Administration oder `projektgruppe` für einen gemeinsamen Ordner."],
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
            <TableHead>UID (Ubuntu)</TableHead>
            <TableHead>Beispiele</TableHead>
            <TableHead>Merkmale</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-semibold">root</TableCell>
            <TableCell className="font-mono">0</TableCell>
            <TableCell className="font-mono">root</TableCell>
            <TableCell>Superuser, für ihn entfällt die Rechteprüfung. Unter Ubuntu ist der direkte Login gesperrt, Admins nutzen sudo.</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-semibold">Systemkonten</TableCell>
            <TableCell className="font-mono">1–999</TableCell>
            <TableCell className="font-mono">www-data, sshd, nobody (65534)</TableCell>
            <TableCell>Für Dienste, nicht für Menschen. Kein Passwort, Shell meist /usr/sbin/nologin. Anlegen mit useradd -r.</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-semibold">Normale Konten</TableCell>
            <TableCell className="font-mono">ab 1000</TableCell>
            <TableCell className="font-mono">student, testuser1</TableCell>
            <TableCell>Für Menschen. Home unter /home, Login-Shell z. B. /bin/bash. Die Grenzen stehen in /etc/login.defs (UID_MIN 1000).</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <CodeBlock
        label="Beispiel: id zeigt UID, primäre Gruppe und alle Gruppen"
        code={"$ id\nuid=1000(student) gid=1000(student) groups=1000(student),4(adm),24(cdrom),27(sudo),30(dip),46(plugdev),100(users)"}
      />
      <TaskList section="grundlagen" />
    </Section>
  );
}

// ------------------------------------------------------------------ 2 Dateien

function Dateien() {
  return (
    <Section
      id="dateien"
      lead="Die Kontodaten stehen in einfachen Textdateien: eine Zeile pro Konto bzw. Gruppe, Felder durch Doppelpunkte getrennt. Bearbeitet werden sie mit den Befehlen aus Abschnitt 3, nicht mit einem Editor."
    >
      <H3>/etc/passwd: Konten (Rechte 644, lesbar für alle)</H3>
      <FieldTable
        line="testuser1:x:1001:1001:Test User:/home/testuser1:/bin/bash"
        fields={[
          ["Benutzername", "Login-Name, klein geschrieben"],
          ["Passwort", "`x` heißt: Der Hash steht in /etc/shadow"],
          ["UID", "Benutzernummer"],
          ["GID", "Nummer der primären Gruppe"],
          ["GECOS", "Kommentar, z. B. voller Name (useradd -c)"],
          ["Home", "Home-Verzeichnis (useradd -m legt es an)"],
          ["Shell", "Login-Shell; `/usr/sbin/nologin` verhindert die Anmeldung"],
        ]}
      />

      <H3>/etc/shadow: Passwörter und Ablaufdaten (Rechte 640, root:shadow)</H3>
      <FieldTable
        line="testuser1:$y$…(gekürzt):20767:0:99999:7:::"
        fields={[
          ["Benutzername", "wie in /etc/passwd"],
          ["Passwort-Hash", "`$y$` = yescrypt (Standard seit Ubuntu 22.04), `$6$` = SHA-512. `!` davor = gesperrt, `*` = kein Login mit Passwort. Hier nur ein Platzhalter!"],
          ["Letzte Änderung", "Tage seit dem 1. 1. 1970 (20767 = 10. 11. 2026); 0 = Änderung beim nächsten Login erzwingen"],
          ["Minimum", "Tage, bis das Passwort wieder geändert werden darf"],
          ["Maximum", "Tage, bis das Passwort abläuft (99999 = nie)"],
          ["Warnung", "Tage vorher wird gewarnt"],
          ["Inaktiv", "Tage nach Ablauf, bis das Konto deaktiviert wird"],
          ["Kontoablauf", "Datum (Tage seit 1970), ab dem das Konto gesperrt ist"],
          ["Reserviert", "ungenutzt"],
        ]}
      />

      <H3>/etc/group: Gruppen (Rechte 644)</H3>
      <FieldTable
        line="projektgruppe:x:1003:testuser1,testuser2"
        fields={[
          ["Gruppenname", "Name der Gruppe"],
          ["Passwort", "`x`: ein Gruppenpasswort stünde in /etc/gshadow (selten genutzt)"],
          ["GID", "Gruppennummer"],
          ["Mitglieder", "Benutzer, für die das eine zusätzliche Gruppe ist (Komma, ohne Leerzeichen)"],
        ]}
      />

      <CodeBlock
        label="Vergleich der Rechte"
        code={"$ ls -l /etc/passwd /etc/shadow /etc/group\n-rw-r--r-- 1 root root    636 Nov 10 09:16 /etc/group\n-rw-r--r-- 1 root root   1251 Nov 10 09:16 /etc/passwd\n-rw-r----- 1 root shadow  716 Nov 10 09:16 /etc/shadow"}
      />

      <KeyPoint title="Warum Passwort-Hashes geschützt sein müssen" tone="warn">
        <ul className="flex list-disc flex-col gap-2 pl-6">
          <li>Ein Hash lässt sich nicht zurückrechnen, aber offline durchprobieren: Wörterbuch- und Brute-Force-Angriffe testen Millionen Passwörter, ohne dass das System etwas merkt.</li>
          <li>Früher stand der Hash in /etc/passwd, die jeder lesen darf. Deshalb wurde er nach /etc/shadow ausgelagert: Nur root und die Gruppe shadow dürfen lesen.</li>
          <li>Salt und langsame Verfahren wie yescrypt bremsen Angriffe, schützen aber keine schwachen Passwörter.</li>
          <li>In Präsentationen und Screenshots nie echte Hashes zeigen. Hier steht immer nur ein Platzhalter wie <InlineCode>$y$…(gekürzt)</InlineCode>.</li>
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
    desc: "Legt ein Konto an. Ohne -m kein Home-Verzeichnis, ohne -s die Shell /bin/sh. (adduser ist unter Ubuntu ein interaktives Hilfsprogramm, das useradd aufruft.)",
    opts: [["-m", "Home anlegen, Dateien aus /etc/skel kopieren"], ["-s SHELL", "Login-Shell"], ["-c TEXT", "Kommentar (GECOS)"], ["-g / -G", "primäre / zusätzliche Gruppen"], ["-u UID", "UID selbst wählen"], ["-e DATUM", "Ablaufdatum des Kontos"], ["-r", "Systemkonto (UID < 1000)"]],
    example: 'sudo useradd -m -s /bin/bash -c "Test User" testuser1',
  },
  {
    cmd: "usermod",
    syntax: "usermod [Optionen] NAME",
    desc: "Ändert ein bestehendes Konto. Typischer Fehler: -G ohne -a ersetzt alle Zusatzgruppen.",
    opts: [["-aG GRUPPE", "Zusatzgruppe anhängen"], ["-G LISTE", "Zusatzgruppen ersetzen"], ["-g GRUPPE", "primäre Gruppe"], ["-l NEU", "umbenennen"], ["-d DIR -m", "Home verschieben"], ["-s SHELL", "Shell ändern"], ["-L / -U", "sperren / entsperren"]],
    example: "sudo usermod -aG projektgruppe testuser1",
  },
  {
    cmd: "userdel",
    syntax: "userdel [Optionen] NAME",
    desc: "Löscht ein Konto. Dateien außerhalb des Home bleiben und zeigen danach nur noch die UID.",
    opts: [["-r", "Home und Mail-Spool mitlöschen"], ["-f", "auch wenn der Benutzer angemeldet ist"]],
    example: "sudo userdel -r testuser1",
  },
  {
    cmd: "groupadd",
    syntax: "groupadd [Optionen] GRUPPE",
    desc: "Legt eine Gruppe an. Die GID wird automatisch ab 1000 vergeben.",
    opts: [["-g GID", "GID selbst wählen"], ["-r", "Systemgruppe"]],
    example: "sudo groupadd projektgruppe",
  },
  {
    cmd: "groupmod",
    syntax: "groupmod [Optionen] GRUPPE",
    desc: "Ändert Name oder GID einer Gruppe. Dateien behalten die alte GID!",
    opts: [["-n NEU", "umbenennen"], ["-g GID", "neue GID"]],
    example: "sudo groupmod -n team projektgruppe",
  },
  {
    cmd: "gpasswd",
    syntax: "gpasswd [Option] GRUPPE",
    desc: "Verwaltet Mitglieder einer Gruppe, gut lesbar für Einzelne.",
    opts: [["-a NAME", "Mitglied hinzufügen"], ["-d NAME", "Mitglied entfernen"], ["-M LISTE", "Mitgliederliste setzen"], ["-A LISTE", "Gruppen-Admins festlegen"]],
    example: "sudo gpasswd -a testuser2 projektgruppe",
  },
  {
    cmd: "passwd",
    syntax: "passwd [Optionen] [NAME]",
    desc: "Setzt Passwörter. Ohne Namen ändert man das eigene, mit Namen braucht man root.",
    opts: [["(ohne)", "neues Passwort setzen"], ["-l / -u", "sperren / entsperren"], ["-S", "Status (P, L, NP)"], ["-e", "Änderung beim nächsten Login erzwingen"], ["-d", "Passwort löschen (gefährlich)"]],
    example: "sudo passwd testuser1",
  },
  {
    cmd: "chage",
    syntax: "chage [Optionen] NAME",
    desc: "Passwort- und Kontoablauf (change age). Daten als JJJJ-MM-TT.",
    opts: [["-l", "Ablaufdaten anzeigen"], ["-M TAGE", "maximale Gültigkeit"], ["-m TAGE", "Mindestalter"], ["-W TAGE", "Warnzeit"], ["-I TAGE", "inaktiv nach Ablauf"], ["-E DATUM", "Konto läuft ab"], ["-d 0", "Änderung erzwingen"]],
    example: "sudo chage -M 90 -W 7 testuser2",
  },
];

function Befehle() {
  return (
    <Section
      id="befehle"
      lead="Alle Verwaltungsbefehle ändern Systemdateien und brauchen deshalb Root-Rechte: unter Ubuntu mit `sudo` davor. Sie sperren die Dateien während der Änderung, damit nichts kaputtgeht."
    >
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
    <Section
      id="pruefen"
      lead="Nach jeder Änderung prüft man das Ergebnis: Wer ist in welcher Gruppe, und wem gehört welcher Ordner?"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <CodeBlock label="Gruppen prüfen" code={"$ id testuser1\nuid=1001(testuser1) gid=1001(testuser1) groups=1001(testuser1),1003(projektgruppe)\n$ groups testuser2\ntestuser2 : testuser2 projektgruppe\n$ getent group projektgruppe\nprojektgruppe:x:1003:testuser1,testuser2"} />
        <CodeBlock label="Eigentümer ändern" code={"$ sudo chown testuser1 /srv/projekt\n$ sudo chgrp projektgruppe /srv/projekt\n$ sudo chown testuser1:projektgruppe /srv/projekt\n$ sudo chown -R testuser1:projektgruppe /srv/projekt"} />
      </div>
      <KeyPoint title="Neue Gruppen gelten erst nach neuer Anmeldung">
        <InlineCode>id</InlineCode> und <InlineCode>groups</InlineCode> ohne Namen zeigen die Gruppen der <em>laufenden Sitzung</em>. Wer gerade einer Gruppe hinzugefügt wurde, muss sich neu anmelden (oder <InlineCode>su - name</InlineCode>), damit die Gruppe wirkt. Mit Namen (<InlineCode>id testuser1</InlineCode>) liest der Befehl die aktuelle Datenbank.
      </KeyPoint>

      <H3>ls -ld lesen</H3>
      <div className="overflow-x-auto rounded-base border border-foreground/10 p-4 font-mono text-lg">
        <div className="flex min-w-max gap-3">
          {[
            ["d", "Typ (d = Ordner)"],
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
            <TableCell>Summe pro Stelle: 7 = rwx, 5 = r-x, 0 = ---</TableCell>
            <TableCell className="font-mono">770 → rwx rwx ---</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-mono">4 / 2 / 1 (vorne)</TableCell>
            <TableCell>Sonderbits: setuid / setgid / sticky</TableCell>
            <TableCell className="font-mono">2 → setgid: neue Dateien erben die Gruppe des Ordners</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <P className="text-foreground/60">
        Nur root darf den Besitzer ändern. Der Besitzer einer Datei darf mit <InlineCode>chgrp</InlineCode> nur zu einer Gruppe wechseln, in der er selbst Mitglied ist.
      </P>
      <TaskList section="pruefen" />
    </Section>
  );
}

// ------------------------------------------------------------------ 5 Ablauf, Sperren, sudo

function Ablauf() {
  return (
    <Section
      id="ablauf"
      lead="Ein Konto ist nur so sicher wie seine Verwaltung: Passwörter laufen ab, Konten werden gesperrt, Admin-Rechte gibt es nur gezielt."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Passwortablauf</CardTitle>
            <CardDescription>chage -M, -m, -W, -I</CardDescription>
          </CardHeader>
          <CardContent>
            <P className="text-base">Ubuntu-Standard aus /etc/login.defs: PASS_MAX_DAYS 99999, also läuft das Passwort nie ab. <InlineCode>chage -M 90</InlineCode> erzwingt alle 90 Tage ein neues. <InlineCode>chage -d 0</InlineCode> erzwingt die Änderung beim nächsten Login.</P>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Kontoablauf</CardTitle>
            <CardDescription>chage -E oder usermod -e</CardDescription>
          </CardHeader>
          <CardContent>
            <P className="text-base">Ab dem Datum kann sich niemand mehr anmelden, egal mit welchem Passwort. Ideal für Praktikanten oder Testkonten: <InlineCode>chage -E 2027-06-30 gast</InlineCode>.</P>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gesperrte Konten</CardTitle>
            <CardDescription>passwd -l / usermod -L</CardDescription>
          </CardHeader>
          <CardContent>
            <P className="text-base">Setzt ein <InlineCode>!</InlineCode> vor den Hash: Passwort-Login unmöglich, <InlineCode>passwd -S</InlineCode> zeigt L. Achtung: SSH-Schlüssel funktionieren weiter. Ganz sperren: zusätzlich <InlineCode>usermod -e 1</InlineCode> oder die Shell auf /usr/sbin/nologin.</P>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>sudo sinnvoll nutzen</CardTitle>
            <CardDescription>Gruppe sudo, /etc/sudoers</CardDescription>
          </CardHeader>
          <CardContent>
            <P className="text-base">Mitglieder der Gruppe <InlineCode>sudo</InlineCode> dürfen alles (<InlineCode>%sudo ALL=(ALL:ALL) ALL</InlineCode>). Jeder Aufruf wird protokolliert (/var/log/auth.log). Lieber einzelne Befehle mit sudo als dauerhaft <InlineCode>sudo -i</InlineCode>. /etc/sudoers nur mit <InlineCode>visudo</InlineCode> bearbeiten.</P>
          </CardContent>
        </Card>
      </div>

      <CodeBlock
        label="Beispiel: Status und Ablaufdaten"
        code={"$ sudo passwd -S testuser2\ntestuser2 P 11/10/2026 0 90 7 -1\n$ sudo -l -U testuser2\nUser testuser2 is not allowed to run sudo on linux-lab."}
      />

      <KeyPoint title="Prinzip der minimalen Rechte (Least Privilege)">
        <ul className="flex list-disc flex-col gap-2 pl-6">
          <li>Jedes Konto bekommt nur die Rechte, die es für seine Aufgabe braucht, nicht mehr.</li>
          <li>Rechte über Gruppen vergeben statt über einzelne Personen: Wer das Projekt verlässt, verliert mit der Gruppe alle Rechte.</li>
          <li>Testkonten und normale Benutzer kommen nicht in die Gruppe sudo. Gezielte Regeln sind besser, z. B. <InlineCode>%webteam ALL=(root) /usr/bin/systemctl restart nginx</InlineCode>.</li>
          <li>Ordner mit 770 statt 777, Konten mit Ablaufdatum, nicht mehr benötigte Konten entfernen (userdel -r).</li>
        </ul>
      </KeyPoint>
      <TaskList section="ablauf" />
    </Section>
  );
}

// ------------------------------------------------------------------ 6 Demo

function Demo() {
  return (
    <Section
      id="demo"
      lead="Die Live-Demo in drei Teilen. In echt nur in einer Test-VM ausführen! Rechts kannst du alles mitmachen, mit „Lösung vorführen“ läuft ein Task automatisch ab."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["1", "Benutzer und Gruppe", "testuser1, testuser2 und projektgruppe anlegen und zuordnen"],
          ["2", "Verzeichnis und Rechte", "/srv/projekt mit Besitzer, Gruppe und 2770; prüfen mit id, groups, ls -ld"],
          ["3", "Ablauf und Aufräumen", "chage -l zeigen, Testkonten mit userdel -r entfernen"],
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
        In der Demo wird <InlineCode>/etc/shadow</InlineCode> nur mit Platzhaltern gezeigt (<InlineCode>$y$…(gekürzt)</InlineCode>, <InlineCode>!</InlineCode>, <InlineCode>*</InlineCode>). Für die Ablaufdaten reicht <InlineCode>chage -l</InlineCode>, das zeigt keine Hashes.
      </KeyPoint>
      <TaskList section="demo" />
    </Section>
  );
}

// ------------------------------------------------------------------ 7 Übersicht

function Uebersicht() {
  return (
    <Section id="uebersicht" lead="Alle Befehle des Vortrags auf einen Blick. Für den Ausdruck gibt es oben das Handout.">
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
