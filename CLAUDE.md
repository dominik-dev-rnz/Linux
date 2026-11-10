# Linux-Fachvortrag 4: Benutzer- und Gruppenverwaltung

Drei Schüler bereiten einen Fachvortrag für den Linux-Unterricht vor.
Dieses Repo enthält Präsentation, Demo-Ablaufplan, Handout und ein
Web-Terminal, in dem die Klasse selbst üben kann.

## Regeln
- Das Repo ist öffentlich: keine echten Passwörter, keine echten
  Passwort-Hashes, keine echten Namen. Nur erfundene Testdaten.
- Jeder arbeitet nur in seinen eigenen Dateien (siehe Zuständigkeiten).
- Vor dem Arbeiten git pull, danach committen und pushen.
  Commit-Nachrichten kurz und auf Deutsch.
- Antworte auf Deutsch und erkläre, was du gebaut hast, damit wir
  es im Vortrag erklären können.
- Fachlich muss alles stimmen und sich wie Ubuntu 24.04 LTS verhalten.

## Auftrag vom Arbeitsblatt
Erklären, wie Linux Benutzerkonten und Gruppen organisiert und wie
ein Administrator Zugriffsrechte gezielt zuweist.

Inhalte:
- Benutzer, UID, primäre und zusätzliche Gruppen, GID; normale
  Konten, Systemkonten und root
- Aufbau und Aufgaben von /etc/passwd, /etc/shadow, /etc/group;
  warum Passwort-Hashes geschützt sein müssen
- useradd, usermod, userdel, groupadd, groupmod, gpasswd, passwd und
  chage mit wichtigen Parametern
- id und groups zum Prüfen; chown und chgrp für Eigentümer
- Konto- und Passwortablauf, gesperrte Konten, sudo und das Prinzip
  minimaler Rechte

Praktische Demonstration in einer Test-VM:
1. Zwei Testbenutzer und eine gemeinsame Gruppe anlegen, zuordnen
2. Gemeinsames Verzeichnis mit Besitzer, Gruppe und Rechten,
   prüfen mit id, groups und ls -ld
3. Passwortablauf mit chage -l zeigen, danach Testkonten entfernen.
   Keine echten Passwort-Hashes zeigen.

Abgaben: Präsentation mit eigenen Beispielen, Ablaufplan für
Anlegen, Ändern und Entfernen mit Befehlsübersicht, einseitiges
Handout mit Quellen, zwei Verständnisfragen und eine Übungsaufgabe.
Alle drei sprechen etwa gleich viel und alle programmieren.

## Szenario
Die IT-Abteilung einer Schule richtet Konten ein.
- Live-Demo: Lehrkräfte mmaier (Maria Maier) und jgruber (Jakob
  Gruber), Gruppe informatik, Ordner /srv/informatik mit Rechten
  2770. Lehrkräfte bekommen kein sudo.
- Web-Terminal für die Klasse: Schüler lkofler (Lena Kofler) und
  tsteiner (Tim Steiner), Gruppe projekt, Ordner /srv/projekt.
- Im System gibt es den Administrator itadmin (UID 1000, Gruppe sudo).

## Zuständigkeiten
- Person A: Grundlagen und die drei Dateien, Demo-Teil 1 (Benutzer
  und Gruppe anlegen). Code: room/src/benutzer.js. Abgabe: Handout.
- Person B (Repo-Besitzer): Befehlsübersicht, Demo-Teil 2
  (Verzeichnis und Rechte), leitet das Mitmachen. Code:
  room/src/shell.js und room/src/dateisystem.js. Abgabe: Ablaufplan.
- Person C: Ablauf, Sperren und sudo, Demo-Teil 3 (chage, sperren,
  aufräumen), Verständnisfragen. Code: room/index.html, room/ui.js,
  room/src/aufgaben.js, room/build.js. Abgabe: Verständnisfragen
  und Übungsaufgabe.
Details stehen in aufgaben/person-a.md, person-b.md, person-c.md.

## Ordner
- praesentation/  Gliederung und Folientexte
- demo/           Ablaufplan für die Live-Demo in der VM
- handout/        Einseitiges Handout mit Quellen
- room/           Web-Terminal (Quellcode und Tests)
- docs/           Fertig gebündeltes Web-Terminal für GitHub Pages
- aufgaben/       Aufgaben für jede Person

## Web-Terminal: Technik
- Reines JavaScript mit ES-Modulen, läuft im Browser ohne
  Installation. Es ist eine Simulation, kein echtes Linux.
- Jeder Besucher hat seine eigene Kopie, nichts geht an einen Server.
- Tests: node --test room/tests/ (Node 20 oder neuer).
- node room/build.js bündelt alles in eine Datei docs/index.html.
  Dafür darf esbuild als devDependency verwendet werden.

## Schnittstelle zwischen den Modulen
shell.js (Person B) exportiert createSystem(). Das System hat:

    system.state = {
      users:  [{ name, uid, gid, gecos, home, shell,
                 shadow: { hash, plain, lastChange, min, max,
                           warn, inactive, expire } }],
      groups: [{ name, gid, members: [], admins: [], password }],
      fs:     Map von Pfad zu { type: 'dir' oder 'file', uid, gid,
                                mode, content, mtime },
      sessions: [{ user, uid, gid, groups, cwd, home, shell, login }]
    }
    system.register(name, handler)   Befehl anmelden
    system.run(line)                 Generator, liefert Ereignisse
    system.prompt()                  { user, host, cwd, symbol }
    system.reset()                   Grundzustand herstellen
    system.onReset(fn)               fn baut beim Reset Daten auf
    system.mkdir(pfad, uid, gid, mode)
    system.writeFile(pfad, inhalt, uid, gid, mode)
    system.removeTree(pfad)
    system.copyTree(quelle, ziel, uid, gid)
    system.canAccess(pfad, 'r' | 'w' | 'x', sitzung)

- content einer Datei ist ein Text oder eine Funktion, die Text
  liefert. So erzeugt benutzer.js /etc/passwd usw. immer aktuell.
- shadow.plain ist nur für die Simulation (Passwortprüfung bei su)
  und wird nie angezeigt. hash ist immer erfunden.
- Ereignisse von system.run: { type: 'output', text },
  { type: 'ask', prompt, hidden } (Antwort mit gen.next(antwort)),
  { type: 'clear' }.

Ein Befehl sieht so aus:

    function* handler(args, ctx) {
      ctx.print('Text')         Ausgabe
      ctx.error('Text')         Fehlermeldung, Exit-Code 1
      ctx.stdin                 Eingabe aus einer Pipe
      ctx.isRoot()              root oder über sudo
      ctx.session()             aktuelle Sitzung
      const pw = yield* ctx.ask('Password: ', true)
    }

Module werden so eingebunden:
    const system = createSystem();
    installDateisystem(system);   aus dateisystem.js (Person B)
    installBenutzer(system);      aus benutzer.js (Person A)

Grundzustand: shell.js legt /, /root, /home, /etc, /etc/skel (mit
.bashrc, .profile, .bash_logout), /srv und /tmp an. benutzer.js
legt über onReset root, typische Systemkonten, itadmin und die
Gruppen an. Die Sitzung startet als root in /root.
Die Aufgabenprüfung (Person C) liest system.state nur, sie ändert
nie etwas.
