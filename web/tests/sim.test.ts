import { describe, expect, test } from "vitest";
import { createLab, runLine } from "@/lib/sim";

const NOW = Date.UTC(2026, 10, 10, 9, 16);
const lab = () => createLab({ now: () => NOW });
const SUDO = ["student"];

describe("Benutzer und Gruppen", () => {
  test("Grundzustand: student mit UID 1000 und Gruppe sudo", () => {
    const sys = lab();
    expect(runLine(sys, "id").text).toBe(
      "uid=1000(student) gid=1000(student) groups=1000(student),4(adm),24(cdrom),27(sudo),30(dip),46(plugdev),100(users)",
    );
    expect(runLine(sys, "whoami").text).toBe("student");
    expect(sys.prompt()).toEqual({ user: "student", host: "linux-lab", cwd: "~", symbol: "$" });
  });

  test("ohne sudo: Permission denied wie bei Ubuntu", () => {
    const sys = lab();
    const r = runLine(sys, "useradd -m testuser1");
    expect(r.code).toBe(1);
    expect(r.text).toBe("useradd: Permission denied.\nuseradd: cannot lock /etc/passwd; try again later.");
    expect(runLine(sys, "groupadd x").text).toContain("cannot lock /etc/group");
  });

  test("sudo fragt das Passwort und merkt es sich", () => {
    const sys = lab();
    const r1 = runLine(sys, "sudo useradd -m testuser1", ["falsch", "student"]);
    expect(r1.asks).toEqual(["[sudo] password for student: ", "[sudo] password for student: "]);
    expect(r1.text).toBe("Sorry, try again.");
    const r2 = runLine(sys, "sudo useradd testuser2");
    expect(r2.asks).toEqual([]);
    const u = sys.user("testuser2")!;
    expect(u.shell).toBe("/bin/sh"); // Ubuntu-Standard ohne -s
    expect(sys.get("/home/testuser2")).toBeUndefined(); // ohne -m kein Home
    expect(sys.get("/home/testuser1")?.mode).toBe(0o750);
    expect(runLine(sys, "sudo -k").code).toBe(0);
    expect(runLine(sys, "sudo id", ["a", "b", "c"]).text).toBe("Sorry, try again.\nSorry, try again.\nsudo: 3 incorrect password attempts");
  });

  test("UID- und GID-Vergabe, eigene Gruppe pro Benutzer", () => {
    const sys = lab();
    runLine(sys, "sudo useradd -m testuser1", SUDO);
    runLine(sys, "sudo groupadd projektgruppe");
    runLine(sys, "sudo useradd -r dienst");
    expect(runLine(sys, "id testuser1").text).toBe("uid=1001(testuser1) gid=1001(testuser1) groups=1001(testuser1)");
    expect(runLine(sys, "getent group projektgruppe").text).toBe("projektgruppe:x:1002:");
    expect(sys.user("dienst")!.uid).toBeLessThan(1000);
    expect(runLine(sys, "sudo useradd testuser1").text).toBe("useradd: user 'testuser1' already exists");
    expect(runLine(sys, "sudo useradd Gross").text).toBe("useradd: invalid user name 'Gross': use --badname to ignore");
  });

  test("usermod -G ohne -a ersetzt alle Zusatzgruppen", () => {
    const sys = lab();
    runLine(sys, "sudo useradd -m testuser1", SUDO);
    runLine(sys, "sudo groupadd a");
    runLine(sys, "sudo groupadd b");
    runLine(sys, "sudo usermod -aG a testuser1");
    runLine(sys, "sudo usermod -aG b testuser1");
    expect(runLine(sys, "groups testuser1").text).toBe("testuser1 : testuser1 a b");
    runLine(sys, "sudo usermod -G b testuser1");
    expect(runLine(sys, "groups testuser1").text).toBe("testuser1 : testuser1 b");
    expect(runLine(sys, "sudo usermod -a testuser1").text.split("\n")[0]).toBe("usermod: -a flag is ONLY allowed with the -G flag");
    expect(runLine(sys, "sudo usermod -aG gibtsnicht testuser1").text).toBe("usermod: group 'gibtsnicht' does not exist");
  });

  test("neue Gruppen gelten erst nach neuer Anmeldung", () => {
    const sys = lab();
    runLine(sys, "sudo groupadd projektgruppe", SUDO);
    runLine(sys, "sudo usermod -aG projektgruppe student");
    expect(runLine(sys, "groups").text).not.toContain("projektgruppe");
    expect(runLine(sys, "groups student").text).toContain("projektgruppe");
  });

  test("passwd, Status und Sperre", () => {
    const sys = lab();
    runLine(sys, "sudo useradd -m testuser1", SUDO);
    expect(runLine(sys, "sudo passwd -S testuser1").text).toBe("testuser1 L 11/10/2026 0 99999 7 -1");
    const r = runLine(sys, "sudo passwd testuser1", ["geheim", "geheim"]);
    expect(r.asks).toEqual(["New password: ", "Retype new password: "]);
    expect(r.text).toBe("passwd: password updated successfully");
    expect(runLine(sys, "sudo passwd -S testuser1").text).toMatch(/^testuser1 P /);
    expect(runLine(sys, "sudo passwd -l testuser1").text).toBe("passwd: password expiry information changed.");
    expect(runLine(sys, "sudo passwd -S testuser1").text).toMatch(/^testuser1 L /);
    expect(runLine(sys, "sudo passwd x", ["a", "b"]).text).toContain("passwd: user 'x' does not exist");
    expect(runLine(sys, "passwd testuser1").text).toBe("passwd: You may not view or modify password information for testuser1.");
    const mismatch = runLine(sys, "sudo passwd testuser1", ["a", "b"]);
    expect(mismatch.text).toBe("Sorry, passwords do not match.\npasswd: Authentication token manipulation error\npasswd: password unchanged");
  });

  test("chage -l zeigt die Ablaufdaten, -M und -E ändern sie", () => {
    const sys = lab();
    runLine(sys, "sudo useradd -m testuser2", SUDO);
    runLine(sys, "sudo chage -M 90 -E 2027-06-30 testuser2");
    const lines = runLine(sys, "sudo chage -l testuser2").text.split("\n");
    expect(lines[0]).toBe("Last password change\t\t\t\t\t: Nov 10, 2026");
    expect(lines[1]).toBe("Password expires\t\t\t\t\t: Feb 08, 2027");
    expect(lines[3]).toBe("Account expires\t\t\t\t\t\t: Jun 30, 2027");
    expect(lines[5]).toBe("Maximum number of days between password change\t\t: 90");
    expect(runLine(sys, "chage -l testuser2").text).toBe("chage: Permission denied.");
    expect(runLine(sys, "sudo chage -E morgen testuser2").text).toBe("chage: invalid date 'morgen'");
  });

  test("userdel -r entfernt Konto, Gruppe und Home", () => {
    const sys = lab();
    runLine(sys, "sudo useradd -m testuser1", SUDO);
    const r = runLine(sys, "sudo userdel -r testuser1");
    expect(r.text).toBe("userdel: testuser1 mail spool (/var/mail/testuser1) not found");
    expect(sys.user("testuser1")).toBeUndefined();
    expect(sys.group("testuser1")).toBeUndefined();
    expect(sys.get("/home/testuser1")).toBeUndefined();
    expect(runLine(sys, "sudo userdel testuser1").text).toBe("userdel: user 'testuser1' does not exist");
  });

  test("/etc/shadow ist geschützt und enthält nur Platzhalter", () => {
    const sys = lab();
    expect(runLine(sys, "cat /etc/shadow").text).toBe("cat: /etc/shadow: Permission denied");
    const shadow = runLine(sys, "sudo cat /etc/shadow", SUDO).text;
    expect(shadow).toContain("student:$y$…(gekürzt):");
    expect(shadow).toMatch(/^root:\*:/);
    // keine echten Hashes: nach $y$ / $6$ folgt immer der Platzhalter
    expect(shadow).not.toMatch(/\$(y|6)\$(?!…)/);
    expect(runLine(sys, "ls -l /etc/shadow").text).toMatch(/^-rw-r----- 1 root shadow /);
  });

  test("gpasswd und groupdel", () => {
    const sys = lab();
    runLine(sys, "sudo useradd testuser1", SUDO);
    runLine(sys, "sudo groupadd projektgruppe");
    expect(runLine(sys, "sudo gpasswd -a testuser1 projektgruppe").text).toBe("Adding user testuser1 to group projektgruppe");
    expect(runLine(sys, "sudo gpasswd -d testuser1 projektgruppe").text).toBe("Removing user testuser1 from group projektgruppe");
    expect(runLine(sys, "sudo groupdel testuser1").text).toBe("groupdel: cannot remove the primary group of user 'testuser1'");
    expect(runLine(sys, "sudo groupdel projektgruppe").code).toBe(0);
  });
});

describe("Dateisystem und Rechte", () => {
  test("Verzeichnis 2770, setgid vererbt die Gruppe", () => {
    const sys = lab();
    runLine(sys, "sudo useradd -m -s /bin/bash testuser1", SUDO);
    runLine(sys, "sudo groupadd projektgruppe");
    runLine(sys, "sudo usermod -aG projektgruppe testuser1");
    runLine(sys, "sudo passwd testuser1", ["pw1", "pw1"]);
    runLine(sys, "sudo mkdir /srv/projekt");
    runLine(sys, "sudo chown testuser1:projektgruppe /srv/projekt");
    runLine(sys, "sudo chmod 2770 /srv/projekt");
    expect(runLine(sys, "ls -ld /srv/projekt").text).toMatch(/^drwxrws--- 2 testuser1 projektgruppe 4096 .* \/srv\/projekt$/);
    expect(runLine(sys, "ls /srv/projekt").text).toBe("ls: cannot open directory '/srv/projekt': Permission denied");
    expect(runLine(sys, "su - testuser1", ["pw1"]).code).toBe(0);
    expect(sys.prompt().user).toBe("testuser1");
    runLine(sys, "touch /srv/projekt/a.txt");
    expect(runLine(sys, "ls -l /srv/projekt").text).toMatch(/-rw-rw-r-- 1 testuser1 projektgruppe 0 .* a\.txt/);
    expect(runLine(sys, "exit").text).toBe("logout");
    // chmod 770 behält bei Ordnern das setgid-Bit (GNU-Verhalten)
    runLine(sys, "sudo chmod 770 /srv/projekt");
    expect(sys.get("/srv/projekt")!.mode & 0o7777).toBe(0o2770);
    runLine(sys, "sudo chmod g-s /srv/projekt");
    expect(sys.get("/srv/projekt")!.mode & 0o7777).toBe(0o770);
  });

  test("Fehlermeldungen wie GNU coreutils", () => {
    const sys = lab();
    expect(runLine(sys, "mkdir /srv/x").text).toBe("mkdir: cannot create directory ‘/srv/x’: Permission denied");
    expect(runLine(sys, "chown student /etc/passwd").text).toBe("chown: changing ownership of '/etc/passwd': Operation not permitted");
    expect(runLine(sys, "sudo chown nobody2 /srv", SUDO).text).toBe("chown: invalid user: ‘nobody2’");
    expect(runLine(sys, "sudo chgrp gibtsnicht /srv").text).toBe("chgrp: invalid group: ‘gibtsnicht’");
    expect(runLine(sys, "cd /root").text).toBe("-bash: cd: /root: Permission denied");
    expect(runLine(sys, "foo").text).toBe("foo: command not found");
    expect(runLine(sys, "foo").code).toBe(127);
    expect(runLine(sys, "sudo cd /").text).toBe("sudo: cd: command not found");
    expect(runLine(sys, "ls -z").text).toBe("ls: invalid option -- 'z'\nTry 'ls --help' for more information.");
  });

  test("Pipes, Platzhalter und Verkettung", () => {
    const sys = lab();
    expect(runLine(sys, "grep www-data /etc/passwd | cut -d: -f7").text).toBe("/usr/sbin/nologin");
    expect(runLine(sys, "ls -d /etc/sk*").text).toBe("/etc/skel");
    expect(runLine(sys, "false && echo nein; echo ja").text).toBe("ja");
    expect(runLine(sys, "echo $USER $HOME").text).toBe("student /home/student");
  });

  test("Tab-Ergänzung", () => {
    const sys = lab();
    expect(sys.complete("userm").line).toBe("usermod ");
    expect(sys.complete("sudo groupa").line).toBe("sudo groupadd ");
    expect(sys.complete("id stu").line).toBe("id student ");
    expect(sys.complete("ls /et").line).toBe("ls /etc/");
    expect(sys.complete("getent gr").line).toBe("getent group ");
    expect(sys.complete("user").candidates).toEqual(["useradd", "userdel", "usermod"]);
  });
});
