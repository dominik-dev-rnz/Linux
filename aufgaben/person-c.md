# Person C: Sicherheit und Web-Terminal

## Im Vortrag
- Konto- und Passwortablauf, gesperrte Konten, sudo und das Prinzip
  minimaler Rechte
- Demo-Teil 3: chage -l, -M und -E, Konto sperren mit passwd -l,
  Status mit passwd -S, zeigen wer sudo darf, zum Schluss alles mit
  userdel -r und groupdel aufräumen
- Stellt die zwei Verständnisfragen mündlich

## Abgabe
Zwei Verständnisfragen und die Übungsaufgabe (das Web-Terminal).

## Auftrag für Claude Code
Lies zuerst CLAUDE.md. Arbeite nur in room/index.html, room/ui.js,
room/src/aufgaben.js, room/build.js und den Tests dazu.

Oberfläche im Stil eines TryHackMe-Rooms: links ein Terminal
(Prompt, Verlauf mit Pfeiltasten, Tab-Ergänzung, versteckte
Passworteingabe), rechts die Aufgaben mit Fortschrittsbalken.

aufgaben.js: fünf Aufgaben mit Prüffunktionen, die nach jedem
Befehl system.state prüfen und automatisch grün abhaken. Es gibt
keine Antwortfelder.
1. lkofler und tsteiner mit Home und /bin/bash anlegen
2. Gruppe projekt anlegen, beide als Mitglieder hinzufügen
3. /srv/projekt anlegen, Gruppe projekt, Rechte 2770
4. Als lkofler eine Datei in /srv/projekt anlegen, die der Gruppe
   projekt gehört
5. Beide Benutzer, die Gruppe und den Ordner wieder entfernen
