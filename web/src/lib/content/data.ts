/** Inhalte, die Seite und Handout gemeinsam verwenden. */

export interface CommandInfo {
  cmd: string;
  zweck: string;
  optionen: string;
  beispiel: string;
}

export const COMMANDS: CommandInfo[] = [
  { cmd: "useradd", zweck: "Benutzer anlegen", optionen: "-m Home anlegen, -s Shell, -c Kommentar, -g primäre Gruppe, -G Zusatzgruppen, -u UID, -e Ablaufdatum, -r Systemkonto", beispiel: "sudo useradd -m -s /bin/bash testuser1" },
  { cmd: "usermod", zweck: "Benutzer ändern", optionen: "-aG Gruppe anhängen, -G Zusatzgruppen ersetzen, -g primäre Gruppe, -l umbenennen, -d -m Home verschieben, -s Shell, -L/-U sperren/entsperren, -e Ablaufdatum", beispiel: "sudo usermod -aG projektgruppe testuser1" },
  { cmd: "userdel", zweck: "Benutzer löschen", optionen: "-r Home und Mail-Spool mitlöschen, -f erzwingen", beispiel: "sudo userdel -r testuser1" },
  { cmd: "groupadd", zweck: "Gruppe anlegen", optionen: "-g GID, -r Systemgruppe, -U Mitglieder", beispiel: "sudo groupadd projektgruppe" },
  { cmd: "groupmod", zweck: "Gruppe ändern", optionen: "-n neuer Name, -g neue GID", beispiel: "sudo groupmod -n team projektgruppe" },
  { cmd: "groupdel", zweck: "Gruppe löschen", optionen: "(nicht, solange sie primäre Gruppe eines Benutzers ist)", beispiel: "sudo groupdel projektgruppe" },
  { cmd: "gpasswd", zweck: "Gruppenmitglieder verwalten", optionen: "-a hinzufügen, -d entfernen, -M Mitgliederliste setzen, -A Gruppenadmins", beispiel: "sudo gpasswd -a testuser2 projektgruppe" },
  { cmd: "passwd", zweck: "Passwort setzen und Status", optionen: "(ohne) neues Passwort, -l sperren, -u entsperren, -S Status, -e Änderung erzwingen, -d löschen", beispiel: "sudo passwd testuser1" },
  { cmd: "chage", zweck: "Passwort- und Kontoablauf", optionen: "-l anzeigen, -M max. Tage, -m min. Tage, -W Warntage, -I inaktiv, -E Kontoablauf, -d 0 Änderung erzwingen", beispiel: "sudo chage -M 90 testuser2" },
  { cmd: "id", zweck: "UID, GID und Gruppen anzeigen", optionen: "-u nur UID, -g nur GID, -G alle GIDs, -n Namen statt Zahlen", beispiel: "id testuser1" },
  { cmd: "groups", zweck: "Gruppen eines Benutzers", optionen: "(ohne) eigene Sitzung, NAME aus der Datenbank", beispiel: "groups testuser2" },
  { cmd: "getent", zweck: "Einträge aus passwd/group lesen", optionen: "passwd, group, shadow (root) + Name", beispiel: "getent group projektgruppe" },
  { cmd: "chown", zweck: "Besitzer (und Gruppe) ändern", optionen: "BENUTZER:GRUPPE, -R rekursiv (nur root ändert Besitzer)", beispiel: "sudo chown testuser1:projektgruppe /srv/projekt" },
  { cmd: "chgrp", zweck: "Gruppe ändern", optionen: "-R rekursiv", beispiel: "sudo chgrp projektgruppe /srv/projekt" },
  { cmd: "chmod", zweck: "Rechte setzen", optionen: "Oktal (2770) oder symbolisch (g+s, o-rwx), -R rekursiv", beispiel: "sudo chmod 2770 /srv/projekt" },
  { cmd: "ls -ld", zweck: "Rechte eines Ordners prüfen", optionen: "-l lang, -d Ordner selbst, -a versteckte Dateien", beispiel: "ls -ld /srv/projekt" },
  { cmd: "sudo", zweck: "Befehl mit Root-Rechten", optionen: "-l Rechte anzeigen, -U Benutzer, -u als anderer Benutzer, -i Login-Shell (sparsam!)", beispiel: "sudo -l -U testuser1" },
  { cmd: "su", zweck: "Benutzer wechseln", optionen: "- als Login-Shell (Home, Umgebung)", beispiel: "su - testuser2" },
];

export interface PlanStep {
  title: string;
  commands: string[];
  note?: string;
}

export const ABLAUFPLAN: { phase: string; steps: PlanStep[] }[] = [
  {
    phase: "Anlegen",
    steps: [
      { title: "Gruppe anlegen", commands: ["sudo groupadd projektgruppe"] },
      { title: "Benutzer mit Home und Bash anlegen", commands: ["sudo useradd -m -s /bin/bash testuser1", "sudo useradd -m -s /bin/bash testuser2"] },
      { title: "Passwort setzen", commands: ["sudo passwd testuser1"], note: "Eingabe bleibt unsichtbar" },
      { title: "Gemeinsames Verzeichnis", commands: ["sudo mkdir /srv/projekt", "sudo chown testuser1:projektgruppe /srv/projekt", "sudo chmod 2770 /srv/projekt"] },
    ],
  },
  {
    phase: "Ändern",
    steps: [
      { title: "Zur Gruppe hinzufügen", commands: ["sudo usermod -aG projektgruppe testuser1", "sudo gpasswd -a testuser2 projektgruppe"], note: "-G ohne -a ersetzt alle Zusatzgruppen!" },
      { title: "Prüfen", commands: ["id testuser1", "groups testuser2", "ls -ld /srv/projekt"] },
      { title: "Passwortablauf setzen und anzeigen", commands: ["sudo chage -M 90 testuser2", "sudo chage -l testuser2"] },
      { title: "Konto sperren / entsperren", commands: ["sudo passwd -l testuser1", "sudo passwd -S testuser1", "sudo passwd -u testuser1"] },
    ],
  },
  {
    phase: "Entfernen",
    steps: [
      { title: "Benutzer samt Home löschen", commands: ["sudo userdel -r testuser1", "sudo userdel -r testuser2"] },
      { title: "Gruppe und Ordner entfernen", commands: ["sudo groupdel projektgruppe", "sudo rm -r /srv/projekt"] },
      { title: "Kontrolle", commands: ["getent passwd testuser1", "getent group projektgruppe"], note: "keine Ausgabe = entfernt" },
    ],
  },
];

export const QUELLEN = [
  "Ubuntu Server Documentation: User management – documentation.ubuntu.com/server",
  "Linux man-pages: useradd(8), usermod(8), userdel(8), groupadd(8), gpasswd(1), passwd(1), chage(1), shadow(5), group(5) – man7.org",
  "GNU Coreutils Manual: id, groups, chown, chgrp, chmod – gnu.org/software/coreutils",
  "sudo Manual: sudoers(5) – sudo.ws",
];
