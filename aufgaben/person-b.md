# Person B: Kern, Dateisystem und Rechte

## Im Vortrag
- Befehlsübersicht als Tabelle mit den wichtigsten Parametern
- Demo-Teil 2: /srv/informatik anlegen, chgrp und chown, Rechte
  2770, prüfen mit ls -ld, als mmaier eine Datei anlegen und
  zeigen, dass sie der Gruppe gehört. Typischen Fehler zeigen:
  neue Gruppen gelten erst nach einer neuen Anmeldung.
- Leitet das Mitmachen im Web-Terminal

## Abgabe
Der Ablaufplan für Anlegen, Ändern und Entfernen (in demo/).

## Auftrag für Claude Code
Lies zuerst CLAUDE.md. Arbeite nur in room/src/shell.js,
room/src/dateisystem.js und den Tests dazu. Die anderen bauen auf
deinem Teil auf, setze die Schnittstelle deshalb genau um.

shell.js: createSystem() mit Zustand, Befehlsregister, Zerlegen der
Eingabe (Anführungszeichen, Variablen wie $USER, Pipes mit |,
&& und ;), Sitzungen mit su, su -, exit und sudo, Prompt (# für
root, $ sonst) und Rückfragen wie Password:.

dateisystem.js: exportiere installDateisystem(system). Befehle: ls
(-l, -a, -d), cd, pwd, mkdir, touch, rm, cat, chown, chgrp, chmod
(Zahlen und Buchstaben), grep, head, tail, cut. Rechte werden bei
jedem Zugriff geprüft (Permission denied). Das setgid-Bit sorgt
dafür, dass neue Dateien die Gruppe des Ordners erben.
Schreibe Tests mit node --test.
