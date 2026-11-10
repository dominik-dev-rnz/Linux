# Person A: Benutzer und Gruppen

## Im Vortrag
- Einstieg: die IT-Abteilung einer Schule und warum es Benutzer
  und Gruppen gibt
- UID, GID, primäre und zusätzliche Gruppen, die drei Kontotypen
- Aufbau von /etc/passwd, /etc/shadow, /etc/group und warum
  Passwort-Hashes geschützt sein müssen
- Demo-Teil 1: mmaier und jgruber anlegen, Passwort setzen, Gruppe
  informatik anlegen, beide zuordnen, prüfen mit id und groups.
  Typischen Fehler zeigen: usermod -G ohne -a.
- Zusammenfassung am Schluss

## Abgabe
Das einseitige Handout (alle liefern Inhalte, A setzt es zusammen).

## Auftrag für Claude Code
Lies zuerst CLAUDE.md. Arbeite nur in room/src/benutzer.js und
room/tests/benutzer.test.js. Exportiere installBenutzer(system).

Baue: useradd, usermod, userdel, groupadd, groupmod, groupdel,
gpasswd, passwd, chage, id, groups und getent.
- Ausgaben und Fehlermeldungen wie bei Ubuntu 24.04
- /etc/passwd, /etc/shadow, /etc/group und /etc/gshadow werden
  aus system.state erzeugt (content als Funktion)
- Nur erfundene Hashes. UID-Vergabe wie echt: normale Konten ab
  1000, Systemkonten (-r) unter 1000, eigene Gruppe pro Benutzer
- useradd ohne -m legt kein Home an, Standard-Shell ist /bin/sh
- usermod -G ohne -a ersetzt alle Zusatzgruppen
- Grundzustand über system.onReset (root, Systemkonten, itadmin)
Schreibe Tests mit node --test, auch für typische Fehler.
