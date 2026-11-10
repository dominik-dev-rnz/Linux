/**
 * Benutzer- und Gruppenverwaltung: useradd, usermod, userdel, groupadd,
 * groupmod, groupdel, gpasswd, passwd, chage, id, groups, getent.
 * Dazu Grundzustand und die Dateien /etc/passwd, /etc/shadow, /etc/group, /etc/gshadow.
 */
import { chageDate, isoDate, parseShadowDate, usDate } from "../dates";
import { getopt, has, val, type OptSpec } from "../getopt";
import type { Ctx, CmdGen, Group, Shadow, SimSystem, User } from "../types";
import { USAGE } from "../usage";

/** Platzhalter statt echter Hashes (yescrypt ist Standard seit Ubuntu 22.04). */
export const HASH_PLACEHOLDER = "$y$…(gekürzt)";

const NAME_RE = /^[a-z_][a-z0-9_-]*\$?$/;
const SHELLS = ["/bin/sh", "/bin/bash", "/usr/bin/sh", "/usr/bin/bash", "/bin/dash", "/usr/bin/dash", "/bin/rbash", "/usr/sbin/nologin", "/bin/false", "/usr/bin/false"];
const UID_MIN = 1000;
const UID_MAX = 60000;
const SYS_MAX = 999;
const SYS_MIN = 100;

// ------------------------------------------------------------------ Hilfen

function shadowFor(sys: SimSystem, opts: Partial<Shadow> = {}): Shadow {
  return { hash: "!", plain: null, lastChange: sys.today(), min: 0, max: 99999, warn: 7, inactive: -1, expire: -1, ...opts };
}

const field = (n: number) => (n < 0 ? "" : String(n));

function denyLock(ctx: Ctx, file: "/etc/passwd" | "/etc/group") {
  ctx.error(`${ctx.name}: Permission denied.`);
  ctx.error(`${ctx.name}: cannot lock ${file}; try again later.`);
  return 1;
}

function usageError(ctx: Ctx, message: string) {
  ctx.error(message);
  ctx.error(USAGE[ctx.name].replace(/\n$/, ""));
  return 2;
}

/** Sucht eine Gruppe über Namen oder GID. */
function findGroup(sys: SimSystem, ref: string): Group | undefined {
  return /^\d+$/.test(ref) ? sys.groupById(Number(ref)) : sys.group(ref);
}

function nextId(used: number[], min: number, max: number, preferred?: number): number {
  if (preferred !== undefined && !used.includes(preferred)) return preferred;
  const inRange = used.filter((n) => n >= min && n <= max);
  const top = inRange.length ? Math.max(...inRange) + 1 : min;
  if (top <= max) return top;
  for (let n = min; n <= max; n++) if (!used.includes(n)) return n;
  return -1;
}

function nextSystemId(used: number[], preferred?: number): number {
  if (preferred !== undefined && preferred <= SYS_MAX && !used.includes(preferred)) return preferred;
  for (let n = SYS_MAX; n >= SYS_MIN; n--) if (!used.includes(n)) return n;
  return -1;
}

function userInUse(sys: SimSystem, name: string): boolean {
  return sys.state.sessions.some((s) => s.user === name);
}

const fakePid = (name: string) => 1000 + [...name].reduce((a, c) => a + c.charCodeAt(0), 0);

function passwordStatus(u: User): string {
  const h = u.shadow.hash;
  if (h.startsWith("!") || h === "*") return "L";
  if (h === "") return "NP";
  return "P";
}

export function statusLine(u: User): string {
  const s = u.shadow;
  const date = s.lastChange > 0 ? usDate(s.lastChange) : s.lastChange === 0 ? "01/01/1970" : "never";
  return `${u.name} ${passwordStatus(u)} ${date} ${s.min} ${s.max} ${s.warn} ${s.inactive}`;
}

/** Zeilen von chage -l */
export function chageLines(u: User, iso = false): string[] {
  const s = u.shadow;
  const fmt = (d: number) => (iso ? isoDate(d) : chageDate(d));
  const last = s.lastChange === 0 ? "password must be changed" : s.lastChange < 0 ? "never" : fmt(s.lastChange);
  let expires: string;
  let inactive: string;
  if (s.lastChange === 0) {
    expires = inactive = "password must be changed";
  } else if (s.lastChange < 0 || s.max >= 10000 || s.max < 0) {
    expires = inactive = "never";
  } else {
    expires = fmt(s.lastChange + s.max);
    inactive = s.inactive < 0 ? "never" : fmt(s.lastChange + s.max + s.inactive);
  }
  const acct = s.expire < 0 ? "never" : fmt(s.expire);
  return [
    `Last password change\t\t\t\t\t: ${last}`,
    `Password expires\t\t\t\t\t: ${expires}`,
    `Password inactive\t\t\t\t\t: ${inactive}`,
    `Account expires\t\t\t\t\t\t: ${acct}`,
    `Minimum number of days between password change\t\t: ${s.min}`,
    `Maximum number of days between password change\t\t: ${s.max}`,
    `Number of days of warning before password expires\t: ${s.warn}`,
  ];
}

function idLine(sys: SimSystem, uid: number, gid: number, gids: number[]): string {
  const uname = sys.userById(uid)?.name;
  const gname = (g: number) => sys.groupById(g)?.name;
  const fmt = (n: number, name?: string) => (name ? `${n}(${name})` : `${n}`);
  return `uid=${fmt(uid, uname)} gid=${fmt(gid, gname(gid))} groups=${gids.map((g) => fmt(g, gname(g))).join(",")}`;
}

export function isSudoer(sys: SimSystem, name: string): boolean {
  if (name === "root") return true;
  const u = sys.user(name);
  if (!u) return false;
  return ["sudo", "admin"].some((g) => {
    const grp = sys.group(g);
    return grp && (grp.members.includes(name) || grp.gid === u.gid);
  });
}

/** Verlangt eine neue Passworteingabe (2x), gibt das Passwort oder null zurück. */
function* askNewPassword(ctx: Ctx, newPrompt = "New password: ", retypePrompt = "Retype new password: "): Generator<import("../types").SimEvent, string | null, string | undefined> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const pw = yield* ctx.ask(newPrompt, true);
    if (!pw) {
      ctx.error("No password has been supplied.");
      continue;
    }
    const again = yield* ctx.ask(retypePrompt, true);
    if (pw !== again) {
      ctx.error("Sorry, passwords do not match.");
      return null;
    }
    return pw;
  }
  ctx.error("passwd: Have exhausted maximum number of retries for service");
  return null;
}

// ------------------------------------------------------------------ Grundzustand

const SYSTEM_USERS: [string, number, number, string, string, string][] = [
  ["root", 0, 0, "root", "/root", "/bin/bash"],
  ["daemon", 1, 1, "daemon", "/usr/sbin", "/usr/sbin/nologin"],
  ["bin", 2, 2, "bin", "/bin", "/usr/sbin/nologin"],
  ["sys", 3, 3, "sys", "/dev", "/usr/sbin/nologin"],
  ["sync", 4, 65534, "sync", "/bin", "/bin/sync"],
  ["games", 5, 60, "games", "/usr/games", "/usr/sbin/nologin"],
  ["man", 6, 12, "man", "/var/cache/man", "/usr/sbin/nologin"],
  ["lp", 7, 7, "lp", "/var/spool/lpd", "/usr/sbin/nologin"],
  ["mail", 8, 8, "mail", "/var/mail", "/usr/sbin/nologin"],
  ["news", 9, 9, "news", "/var/spool/news", "/usr/sbin/nologin"],
  ["uucp", 10, 10, "uucp", "/var/spool/uucp", "/usr/sbin/nologin"],
  ["proxy", 13, 13, "proxy", "/bin", "/usr/sbin/nologin"],
  ["www-data", 33, 33, "www-data", "/var/www", "/usr/sbin/nologin"],
  ["backup", 34, 34, "backup", "/var/backups", "/usr/sbin/nologin"],
  ["list", 38, 38, "Mailing List Manager", "/var/list", "/usr/sbin/nologin"],
  ["irc", 39, 39, "ircd", "/run/ircd", "/usr/sbin/nologin"],
  ["_apt", 42, 65534, "", "/nonexistent", "/usr/sbin/nologin"],
  ["nobody", 65534, 65534, "nobody", "/nonexistent", "/usr/sbin/nologin"],
  ["systemd-network", 998, 998, "systemd Network Management", "/", "/usr/sbin/nologin"],
  ["systemd-timesync", 996, 996, "systemd Time Synchronization", "/", "/usr/sbin/nologin"],
  ["messagebus", 101, 102, "", "/nonexistent", "/usr/sbin/nologin"],
  ["systemd-resolve", 991, 991, "systemd Resolver", "/", "/usr/sbin/nologin"],
  ["syslog", 102, 104, "", "/nonexistent", "/usr/sbin/nologin"],
  ["sshd", 103, 65534, "", "/run/sshd", "/usr/sbin/nologin"],
];

const SYSTEM_GROUPS: [string, number, string[]][] = [
  ["root", 0, []], ["daemon", 1, []], ["bin", 2, []], ["sys", 3, []],
  ["adm", 4, ["syslog", "student"]], ["tty", 5, []], ["disk", 6, []], ["lp", 7, []],
  ["mail", 8, []], ["news", 9, []], ["uucp", 10, []], ["man", 12, []], ["proxy", 13, []],
  ["kmem", 15, []], ["dialout", 20, []], ["fax", 21, []], ["voice", 22, []],
  ["cdrom", 24, ["student"]], ["floppy", 25, []], ["tape", 26, []], ["sudo", 27, ["student"]],
  ["audio", 29, []], ["dip", 30, ["student"]], ["www-data", 33, []], ["backup", 34, []],
  ["operator", 37, []], ["list", 38, []], ["irc", 39, []], ["src", 40, []],
  ["shadow", 42, []], ["utmp", 43, []], ["video", 44, []], ["sasl", 45, []],
  ["plugdev", 46, ["student"]], ["staff", 50, []], ["games", 60, []], ["users", 100, ["student"]],
  ["nogroup", 65534, []], ["systemd-journal", 999, []], ["systemd-network", 998, []],
  ["systemd-timesync", 996, []], ["messagebus", 102, []], ["systemd-resolve", 991, []],
  ["syslog", 104, []], ["_ssh", 105, []], ["student", 1000, []],
];

const LOGIN_DEFS = `# /etc/login.defs - Configuration control definitions for the login package.
# (Auszug, Ubuntu 24.04)
MAIL_DIR        /var/mail
#
# Password aging controls:
#
#	PASS_MAX_DAYS	Maximum number of days a password may be used.
#	PASS_MIN_DAYS	Minimum number of days allowed between password changes.
#	PASS_WARN_AGE	Number of days warning given before a password expires.
#
PASS_MAX_DAYS	99999
PASS_MIN_DAYS	0
PASS_WARN_AGE	7
#
# Min/max values for automatic uid selection in useradd
#
UID_MIN			 1000
UID_MAX			60000
SYS_UID_MAX		  999
GID_MIN			 1000
GID_MAX			60000
SYS_GID_MAX		  999
#
UMASK		022
HOME_MODE	0750
USERGROUPS_ENAB yes
ENCRYPT_METHOD YESCRYPT
`;

const SUDOERS = `#
# This file MUST be edited with the 'visudo' command as root.
#
Defaults	env_reset
Defaults	mail_badpass
Defaults	secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin"
Defaults	use_pty

# User privilege specification
root	ALL=(ALL:ALL) ALL

# Members of the admin group may gain root privileges
%admin ALL=(ALL) ALL

# Allow members of group sudo to execute any command
%sudo	ALL=(ALL:ALL) ALL

@includedir /etc/sudoers.d
`;

function setupBase(sys: SimSystem) {
  const today = sys.today();
  const installDay = today - 30;
  for (const [name, uid, gid, gecos, home, shell] of SYSTEM_USERS) {
    sys.state.users.push({
      name, uid, gid, gecos, home, shell,
      shadow: shadowFor(sys, { hash: "*", lastChange: installDay }),
    });
  }
  sys.state.users.push({
    name: "student", uid: 1000, gid: 1000, gecos: "Student", home: "/home/student", shell: "/bin/bash",
    shadow: shadowFor(sys, { hash: HASH_PLACEHOLDER, plain: "student", lastChange: installDay }),
  });
  for (const [name, gid, members] of SYSTEM_GROUPS) {
    sys.state.groups.push({ name, gid, members: [...members], admins: [], password: gid >= 1000 ? "!" : "*" });
  }

  const gen = (fn: () => string) => fn;
  sys.writeFile("/etc/passwd", gen(() => sys.state.users.map((u) => `${u.name}:x:${u.uid}:${u.gid}:${u.gecos}:${u.home}:${u.shell}`).join("\n") + "\n"), 0, 0, 0o644);
  sys.writeFile("/etc/shadow", gen(() => sys.state.users.map((u) => {
    const s = u.shadow;
    return `${u.name}:${s.hash}:${field(s.lastChange)}:${field(s.min)}:${field(s.max)}:${field(s.warn)}:${field(s.inactive)}:${field(s.expire)}:`;
  }).join("\n") + "\n"), 0, 42, 0o640);
  sys.writeFile("/etc/group", gen(() => sys.state.groups.map((g) => `${g.name}:x:${g.gid}:${g.members.join(",")}`).join("\n") + "\n"), 0, 0, 0o644);
  sys.writeFile("/etc/gshadow", gen(() => sys.state.groups.map((g) => `${g.name}:${g.password}:${g.admins.join(",")}:${g.members.join(",")}`).join("\n") + "\n"), 0, 42, 0o640);
  sys.writeFile("/etc/login.defs", LOGIN_DEFS, 0, 0, 0o644);
  sys.writeFile("/etc/sudoers", SUDOERS, 0, 0, 0o440);
  sys.writeFile("/etc/hostname", "linux-lab\n", 0, 0, 0o644);
  sys.writeFile("/etc/shells", "# /etc/shells: valid login shells\n/bin/sh\n/usr/bin/sh\n/bin/bash\n/usr/bin/bash\n/bin/rbash\n/usr/bin/rbash\n/usr/bin/dash\n", 0, 0, 0o644);
  sys.writeFile("/etc/os-release", 'PRETTY_NAME="Ubuntu 24.04.1 LTS"\nNAME="Ubuntu"\nVERSION_ID="24.04"\nVERSION="24.04.1 LTS (Noble Numbat)"\nID=ubuntu\n', 0, 0, 0o644);
  sys.mkdir("/etc/sudoers.d", 0, 0, 0o750);
  sys.mkdir("/var/mail", 0, 8, 0o2775);
  sys.mkdir("/var/www", 0, 0, 0o755);

  // Home von student
  sys.copyTree("/etc/skel", "/home/student", 1000, 1000);
  sys.get("/home/student")!.mode = 0o750;
  sys.writeFile("/home/student/notizen.txt", "Simulation: Hier darfst du alles ausprobieren.\nEcht nur in einer Test-VM!\n", 1000, 1000, 0o664);

  const student = sys.user("student")!;
  sys.state.sessions = [sys.loginSession(student)];
}

// ------------------------------------------------------------------ useradd

const USERADD: OptSpec[] = [
  { name: "badname", long: "badname" }, { name: "base", short: "b", long: "base-dir", arg: true },
  { name: "comment", short: "c", long: "comment", arg: true }, { name: "home", short: "d", long: "home-dir", arg: true },
  { name: "defaults", short: "D", long: "defaults" }, { name: "expire", short: "e", long: "expiredate", arg: true },
  { name: "inactive", short: "f", long: "inactive", arg: true }, { name: "gid", short: "g", long: "gid", arg: true },
  { name: "groups", short: "G", long: "groups", arg: true }, { name: "help", short: "h", long: "help" },
  { name: "skel", short: "k", long: "skel", arg: true }, { name: "key", short: "K", long: "key", arg: true },
  { name: "nolog", short: "l", long: "no-log-init" }, { name: "createHome", short: "m", long: "create-home" },
  { name: "noHome", short: "M", long: "no-create-home" }, { name: "noUserGroup", short: "N", long: "no-user-group" },
  { name: "nonUnique", short: "o", long: "non-unique" }, { name: "password", short: "p", long: "password", arg: true },
  { name: "system", short: "r", long: "system" }, { name: "root", short: "R", long: "root", arg: true },
  { name: "prefix", short: "P", long: "prefix", arg: true }, { name: "shell", short: "s", long: "shell", arg: true },
  { name: "uid", short: "u", long: "uid", arg: true }, { name: "userGroup", short: "U", long: "user-group" },
  { name: "selinux", short: "Z", long: "selinux-user", arg: true },
];

function* useradd(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  const r = getopt("useradd", args, USERADD);
  if (!r.ok) return usageError(ctx, r.message);
  const o = r.opts;
  if (has(o, "help")) {
    ctx.print(USAGE.useradd.replace(/\n$/, ""));
    return 0;
  }
  if (has(o, "defaults") && r.operands.length === 0) {
    ctx.print("GROUP=100\nHOME=/home\nINACTIVE=-1\nEXPIRE=\nSHELL=/bin/sh\nSKEL=/etc/skel\nCREATE_MAIL_SPOOL=no\nLOG_INIT=yes");
    return 0;
  }
  if (r.operands.length !== 1) {
    ctx.error(USAGE.useradd.replace(/\n$/, ""));
    return 2;
  }
  const name = r.operands[0];
  if (!has(o, "badname") && (!NAME_RE.test(name) || name.length > 32)) {
    ctx.error(`useradd: invalid user name '${name}': use --badname to ignore`);
    return 3;
  }
  if (!ctx.isRoot()) return denyLock(ctx, "/etc/passwd");
  if (sys.user(name)) {
    ctx.error(`useradd: user '${name}' already exists`);
    return 9;
  }
  const system = has(o, "system");

  // Primärgruppe
  let gid: number | undefined;
  const gref = val(o, "gid");
  if (gref !== undefined) {
    const g = findGroup(sys, gref);
    if (!g) {
      ctx.error(`useradd: group '${gref}' does not exist`);
      return 6;
    }
    gid = g.gid;
  }
  // Zusatzgruppen
  const extra: Group[] = [];
  const glist = val(o, "groups");
  if (glist !== undefined) {
    for (const ref of glist.split(",").filter(Boolean)) {
      const g = findGroup(sys, ref);
      if (!g) {
        ctx.error(`useradd: group '${ref}' does not exist`);
        return 6;
      }
      extra.push(g);
    }
  }
  const createUserGroup = gid === undefined && !has(o, "noUserGroup");
  if (createUserGroup && sys.group(name)) {
    ctx.error(`useradd: group ${name} exists - if you want to add this user to that group, use -g.`);
    return 9;
  }
  // UID
  const usedUids = sys.state.users.map((u) => u.uid);
  let uid: number;
  const uidArg = val(o, "uid");
  if (uidArg !== undefined) {
    if (!/^\d+$/.test(uidArg)) {
      ctx.error(`useradd: invalid user ID '${uidArg}'`);
      return 3;
    }
    uid = Number(uidArg);
    if (usedUids.includes(uid) && !has(o, "nonUnique")) {
      ctx.error(`useradd: UID ${uid} is not unique`);
      return 4;
    }
  } else {
    uid = system ? nextSystemId(usedUids) : nextId(usedUids, UID_MIN, UID_MAX);
  }
  // Datumswerte
  let expire = -1;
  const e = val(o, "expire");
  if (e !== undefined && e !== "") {
    const d = parseShadowDate(e);
    if (d === null) {
      ctx.error(`useradd: invalid date '${e}'`);
      return 3;
    }
    expire = d;
  }
  let inactive = -1;
  const f = val(o, "inactive");
  if (f !== undefined) {
    if (!/^-?\d+$/.test(f)) {
      ctx.error(`useradd: invalid numeric argument '${f}'`);
      return 3;
    }
    inactive = Number(f);
  }
  const shell = val(o, "shell") ?? "/bin/sh";
  if (shell && !SHELLS.includes(shell) && shell !== "/bin/sync") {
    ctx.error(`useradd: Warning: missing or non-executable shell '${shell}'`);
  }

  if (createUserGroup) {
    const usedGids = sys.state.groups.map((g) => g.gid);
    gid = system ? nextSystemId(usedGids, uid) : nextId(usedGids, UID_MIN, UID_MAX, uid >= UID_MIN ? uid : undefined);
    sys.state.groups.push({ name, gid, members: [], admins: [], password: "!" });
  }
  gid ??= 100;
  const home = val(o, "home") ?? `${val(o, "base") ?? "/home"}/${name}`;
  const password = val(o, "password");
  const user: User = {
    name, uid, gid,
    gecos: val(o, "comment") ?? "",
    home,
    shell,
    shadow: system
      ? shadowFor(sys, { min: -1, max: -1, warn: -1, inactive, expire })
      : shadowFor(sys, { inactive, expire }),
  };
  if (password !== undefined) user.shadow.hash = password;
  sys.state.users.push(user);
  for (const g of extra) if (!g.members.includes(name)) g.members.push(name);

  if (has(o, "createHome") && !has(o, "noHome")) {
    if (sys.get(home)) {
      ctx.error(`useradd: warning: the home directory ${home} already exists.`);
      ctx.error("useradd: Not copying any file from skel directory into it.");
    } else {
      const skel = val(o, "skel") ?? "/etc/skel";
      if (sys.get(skel)?.type === "dir") sys.copyTree(skel, home, uid, gid);
      else sys.mkdir(home, uid, gid, 0o750);
      sys.get(home)!.mode = 0o750;
    }
  }
  return 0;
}

// ------------------------------------------------------------------ usermod

const USERMOD: OptSpec[] = [
  { name: "append", short: "a", long: "append" }, { name: "badname", short: "b", long: "badname" },
  { name: "comment", short: "c", long: "comment", arg: true }, { name: "home", short: "d", long: "home", arg: true },
  { name: "expire", short: "e", long: "expiredate", arg: true }, { name: "inactive", short: "f", long: "inactive", arg: true },
  { name: "gid", short: "g", long: "gid", arg: true }, { name: "groups", short: "G", long: "groups", arg: true },
  { name: "help", short: "h", long: "help" }, { name: "login", short: "l", long: "login", arg: true },
  { name: "lock", short: "L", long: "lock" }, { name: "move", short: "m", long: "move-home" },
  { name: "nonUnique", short: "o", long: "non-unique" }, { name: "password", short: "p", long: "password", arg: true },
  { name: "prefix", short: "P", long: "prefix", arg: true }, { name: "remove", short: "r", long: "remove" },
  { name: "root", short: "R", long: "root", arg: true }, { name: "shell", short: "s", long: "shell", arg: true },
  { name: "uid", short: "u", long: "uid", arg: true }, { name: "unlock", short: "U", long: "unlock" },
];

function* usermod(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  const r = getopt("usermod", args, USERMOD);
  if (!r.ok) return usageError(ctx, r.message);
  const o = r.opts;
  if (has(o, "help")) {
    ctx.print(USAGE.usermod.replace(/\n$/, ""));
    return 0;
  }
  if (r.operands.length !== 1 || o.size === 0) {
    ctx.error(USAGE.usermod.replace(/\n$/, ""));
    return 2;
  }
  if (has(o, "append") && !has(o, "groups")) {
    ctx.error("usermod: -a flag is ONLY allowed with the -G flag");
    ctx.error(USAGE.usermod.replace(/\n$/, ""));
    return 2;
  }
  if (has(o, "remove") && !has(o, "groups")) {
    ctx.error("usermod: -r flag is ONLY allowed with the -G flag");
    ctx.error(USAGE.usermod.replace(/\n$/, ""));
    return 2;
  }
  if (has(o, "move") && !has(o, "home")) {
    ctx.error("usermod: -m flag is ONLY allowed with the -d flag");
    ctx.error(USAGE.usermod.replace(/\n$/, ""));
    return 2;
  }
  if (has(o, "lock") && has(o, "unlock")) {
    ctx.error("usermod: the -L, -p, and -U flags are exclusive");
    ctx.error(USAGE.usermod.replace(/\n$/, ""));
    return 2;
  }
  const name = r.operands[0];
  if (!ctx.isRoot()) return denyLock(ctx, "/etc/passwd");
  const user = sys.user(name);
  if (!user) {
    ctx.error(`usermod: user '${name}' does not exist`);
    return 6;
  }
  if ((has(o, "login") || has(o, "uid") || has(o, "home")) && userInUse(sys, name)) {
    ctx.error(`usermod: user ${name} is currently used by process ${fakePid(name)}`);
    return 8;
  }

  // alles prüfen, bevor etwas geändert wird
  let newGid: number | undefined;
  const gref = val(o, "gid");
  if (gref !== undefined) {
    const g = findGroup(sys, gref);
    if (!g) {
      ctx.error(`usermod: group '${gref}' does not exist`);
      return 6;
    }
    newGid = g.gid;
  }
  let groupList: Group[] | undefined;
  const glist = val(o, "groups");
  if (glist !== undefined) {
    groupList = [];
    for (const ref of glist.split(",").filter(Boolean)) {
      const g = findGroup(sys, ref);
      if (!g) {
        ctx.error(`usermod: group '${ref}' does not exist`);
        return 6;
      }
      groupList.push(g);
    }
  }
  const newLogin = val(o, "login");
  if (newLogin !== undefined) {
    if (!has(o, "badname") && !NAME_RE.test(newLogin)) {
      ctx.error(`usermod: invalid user name '${newLogin}': use --badname to ignore`);
      return 3;
    }
    if (newLogin !== name && sys.user(newLogin)) {
      ctx.error(`usermod: user '${newLogin}' already exists`);
      return 9;
    }
  }
  let newUid: number | undefined;
  const uidArg = val(o, "uid");
  if (uidArg !== undefined) {
    if (!/^\d+$/.test(uidArg)) {
      ctx.error(`usermod: invalid user ID '${uidArg}'`);
      return 3;
    }
    newUid = Number(uidArg);
    if (newUid !== user.uid && sys.userById(newUid) && !has(o, "nonUnique")) {
      ctx.error(`usermod: UID '${newUid}' already exists`);
      return 4;
    }
  }
  let expire: number | undefined;
  const e = val(o, "expire");
  if (e !== undefined) {
    const d = e === "" ? -1 : parseShadowDate(e);
    if (d === null) {
      ctx.error(`usermod: invalid date '${e}'`);
      return 3;
    }
    expire = d;
  }
  let inactive: number | undefined;
  const f = val(o, "inactive");
  if (f !== undefined) {
    if (!/^-?\d+$/.test(f)) {
      ctx.error(`usermod: invalid numeric argument '${f}'`);
      return 3;
    }
    inactive = Number(f);
  }
  if (has(o, "unlock") && /^!*$/.test(user.shadow.hash)) {
    ctx.error("usermod: unlocking the user's password would result in a passwordless account.");
    ctx.error("You should set a password with usermod -p to unlock this user's password.");
    return 0;
  }

  const before = JSON.stringify({ user, groups: sys.state.groups });

  if (groupList) {
    const ids = new Set(groupList.map((g) => g.gid));
    for (const g of sys.state.groups) {
      const member = g.members.includes(name);
      if (has(o, "remove")) {
        if (ids.has(g.gid) && member) g.members = g.members.filter((m) => m !== name);
      } else if (ids.has(g.gid)) {
        if (!member) g.members.push(name);
      } else if (!has(o, "append") && member) {
        // usermod -G ohne -a ersetzt alle Zusatzgruppen
        g.members = g.members.filter((m) => m !== name);
      }
    }
  }
  if (newGid !== undefined) user.gid = newGid;
  const c = val(o, "comment");
  if (c !== undefined) user.gecos = c;
  const sh = val(o, "shell");
  if (sh !== undefined) user.shell = sh;
  if (expire !== undefined) user.shadow.expire = expire;
  if (inactive !== undefined) user.shadow.inactive = inactive;
  const pw = val(o, "password");
  if (pw !== undefined) user.shadow.hash = pw;
  if (has(o, "lock") && !user.shadow.hash.startsWith("!")) user.shadow.hash = "!" + user.shadow.hash;
  if (has(o, "unlock") && user.shadow.hash.startsWith("!")) user.shadow.hash = user.shadow.hash.slice(1);
  if (newUid !== undefined && newUid !== user.uid) {
    const old = user.uid;
    for (const [path, node] of sys.state.fs) {
      if ((path === user.home || path.startsWith(user.home + "/")) && node.uid === old) node.uid = newUid;
    }
    user.uid = newUid;
  }
  const newHome = val(o, "home");
  if (newHome !== undefined && newHome !== user.home) {
    if (has(o, "move")) {
      if (sys.get(newHome)) {
        ctx.error(`usermod: directory ${newHome} exists`);
        return 12;
      }
      if (sys.get(user.home)) sys.moveTree(user.home, newHome);
    }
    user.home = newHome;
  }
  if (newLogin !== undefined && newLogin !== name) {
    for (const g of sys.state.groups) {
      g.members = g.members.map((m) => (m === name ? newLogin : m));
      g.admins = g.admins.map((m) => (m === name ? newLogin : m));
    }
    user.name = newLogin;
  }
  if (JSON.stringify({ user, groups: sys.state.groups }) === before) {
    ctx.print("usermod: no changes");
  }
  return 0;
}

// ------------------------------------------------------------------ userdel

const USERDEL: OptSpec[] = [
  { name: "force", short: "f", long: "force" }, { name: "help", short: "h", long: "help" },
  { name: "remove", short: "r", long: "remove" }, { name: "root", short: "R", long: "root", arg: true },
  { name: "prefix", short: "P", long: "prefix", arg: true }, { name: "selinux", short: "Z", long: "selinux-user" },
];

function* userdel(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  const r = getopt("userdel", args, USERDEL);
  if (!r.ok) return usageError(ctx, r.message);
  const o = r.opts;
  if (has(o, "help")) {
    ctx.print(USAGE.userdel.replace(/\n$/, ""));
    return 0;
  }
  if (r.operands.length !== 1) {
    ctx.error(USAGE.userdel.replace(/\n$/, ""));
    return 2;
  }
  const name = r.operands[0];
  if (!ctx.isRoot()) return denyLock(ctx, "/etc/passwd");
  const user = sys.user(name);
  if (!user) {
    ctx.error(`userdel: user '${name}' does not exist`);
    return 6;
  }
  if (userInUse(sys, name) && !has(o, "force")) {
    ctx.error(`userdel: user ${name} is currently used by process ${fakePid(name)}`);
    return 8;
  }
  sys.state.users = sys.state.users.filter((u) => u !== user);
  for (const g of sys.state.groups) {
    g.members = g.members.filter((m) => m !== name);
    g.admins = g.admins.filter((m) => m !== name);
  }
  // eigene Gruppe entfernen (USERGROUPS_ENAB yes)
  const own = sys.groupById(user.gid);
  if (own && own.name === name) {
    const other = sys.state.users.find((u) => u.gid === own.gid);
    if (other) ctx.error(`userdel: group ${name} is the primary group of another user and is not removed.`);
    else sys.state.groups = sys.state.groups.filter((g) => g !== own);
  }
  if (has(o, "remove")) {
    ctx.error(`userdel: ${name} mail spool (/var/mail/${name}) not found`);
    const home = sys.get(user.home);
    if (!home) {
      ctx.error(`userdel: ${name} home directory (${user.home}) not found`);
    } else if (user.home === "/" || user.home === "/nonexistent") {
      // nie das Wurzelverzeichnis löschen
    } else {
      sys.removeTree(user.home);
    }
  }
  return 0;
}

// ------------------------------------------------------------------ groupadd / groupmod / groupdel

const GROUPADD: OptSpec[] = [
  { name: "force", short: "f", long: "force" }, { name: "gid", short: "g", long: "gid", arg: true },
  { name: "help", short: "h", long: "help" }, { name: "key", short: "K", long: "key", arg: true },
  { name: "nonUnique", short: "o", long: "non-unique" }, { name: "password", short: "p", long: "password", arg: true },
  { name: "system", short: "r", long: "system" }, { name: "root", short: "R", long: "root", arg: true },
  { name: "prefix", short: "P", long: "prefix", arg: true }, { name: "users", short: "U", long: "users", arg: true },
];

function* groupadd(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  const r = getopt("groupadd", args, GROUPADD);
  if (!r.ok) return usageError(ctx, r.message);
  const o = r.opts;
  if (has(o, "help")) {
    ctx.print(USAGE.groupadd.replace(/\n$/, ""));
    return 0;
  }
  if (r.operands.length !== 1) {
    ctx.error(USAGE.groupadd.replace(/\n$/, ""));
    return 2;
  }
  const name = r.operands[0];
  if (!NAME_RE.test(name) || name.length > 32) {
    ctx.error(`groupadd: '${name}' is not a valid group name`);
    return 3;
  }
  if (!ctx.isRoot()) return denyLock(ctx, "/etc/group");
  if (sys.group(name)) {
    if (has(o, "force")) return 0;
    ctx.error(`groupadd: group '${name}' already exists`);
    return 9;
  }
  const used = sys.state.groups.map((g) => g.gid);
  let gid: number;
  const gArg = val(o, "gid");
  if (gArg !== undefined) {
    if (!/^\d+$/.test(gArg)) {
      ctx.error(`groupadd: invalid group ID '${gArg}'`);
      return 3;
    }
    gid = Number(gArg);
    if (used.includes(gid) && !has(o, "nonUnique")) {
      if (has(o, "force")) gid = nextId(used, UID_MIN, UID_MAX);
      else {
        ctx.error(`groupadd: GID '${gid}' already exists`);
        return 4;
      }
    }
  } else {
    gid = has(o, "system") ? nextSystemId(used) : nextId(used, UID_MIN, UID_MAX);
  }
  const members: string[] = [];
  const uList = val(o, "users");
  if (uList !== undefined) {
    for (const u of uList.split(",").filter(Boolean)) {
      if (!sys.user(u)) {
        ctx.error(`groupadd: Invalid member username ${u}`);
        return 3;
      }
      members.push(u);
    }
  }
  sys.state.groups.push({ name, gid, members, admins: [], password: "!" });
  return 0;
}

const GROUPMOD: OptSpec[] = [
  { name: "append", short: "a", long: "append" }, { name: "gid", short: "g", long: "gid", arg: true },
  { name: "help", short: "h", long: "help" }, { name: "newName", short: "n", long: "new-name", arg: true },
  { name: "nonUnique", short: "o", long: "non-unique" }, { name: "password", short: "p", long: "password", arg: true },
  { name: "root", short: "R", long: "root", arg: true }, { name: "prefix", short: "P", long: "prefix", arg: true },
  { name: "users", short: "U", long: "users", arg: true },
];

function* groupmod(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  const r = getopt("groupmod", args, GROUPMOD);
  if (!r.ok) return usageError(ctx, r.message);
  const o = r.opts;
  if (has(o, "help")) {
    ctx.print(USAGE.groupmod.replace(/\n$/, ""));
    return 0;
  }
  if (r.operands.length !== 1) {
    ctx.error(USAGE.groupmod.replace(/\n$/, ""));
    return 2;
  }
  const name = r.operands[0];
  if (!ctx.isRoot()) return denyLock(ctx, "/etc/group");
  const g = sys.group(name);
  if (!g) {
    ctx.error(`groupmod: group '${name}' does not exist`);
    return 6;
  }
  const newName = val(o, "newName");
  if (newName !== undefined && newName !== name) {
    if (!NAME_RE.test(newName)) {
      ctx.error(`groupmod: invalid group name '${newName}'`);
      return 3;
    }
    if (sys.group(newName)) {
      ctx.error(`groupmod: group '${newName}' already exists`);
      return 9;
    }
  }
  const gArg = val(o, "gid");
  let newGid: number | undefined;
  if (gArg !== undefined) {
    if (!/^\d+$/.test(gArg)) {
      ctx.error(`groupmod: invalid group ID '${gArg}'`);
      return 3;
    }
    newGid = Number(gArg);
    if (newGid !== g.gid && sys.groupById(newGid) && !has(o, "nonUnique")) {
      ctx.error(`groupmod: GID '${newGid}' already exists`);
      return 4;
    }
  }
  const uList = val(o, "users");
  let members: string[] | undefined;
  if (uList !== undefined) {
    members = [];
    for (const u of uList.split(",").filter(Boolean)) {
      if (!sys.user(u)) {
        ctx.error(`groupmod: Invalid member username ${u}`);
        return 3;
      }
      members.push(u);
    }
  }
  if (newGid !== undefined && newGid !== g.gid) {
    for (const u of sys.state.users) if (u.gid === g.gid) u.gid = newGid;
    g.gid = newGid;
  }
  if (newName !== undefined) g.name = newName;
  if (members) g.members = has(o, "append") ? [...new Set([...g.members, ...members])] : members;
  const pw = val(o, "password");
  if (pw !== undefined) g.password = pw;
  return 0;
}

const GROUPDEL: OptSpec[] = [
  { name: "help", short: "h", long: "help" }, { name: "root", short: "R", long: "root", arg: true },
  { name: "prefix", short: "P", long: "prefix", arg: true }, { name: "force", short: "f", long: "force" },
];

function* groupdel(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  const r = getopt("groupdel", args, GROUPDEL);
  if (!r.ok) return usageError(ctx, r.message);
  const o = r.opts;
  if (has(o, "help")) {
    ctx.print(USAGE.groupdel.replace(/\n$/, ""));
    return 0;
  }
  if (r.operands.length !== 1) {
    ctx.error(USAGE.groupdel.replace(/\n$/, ""));
    return 2;
  }
  const name = r.operands[0];
  if (!ctx.isRoot()) return denyLock(ctx, "/etc/group");
  const g = sys.group(name);
  if (!g) {
    ctx.error(`groupdel: group '${name}' does not exist`);
    return 6;
  }
  const primaryOf = sys.state.users.find((u) => u.gid === g.gid);
  if (primaryOf && !has(o, "force")) {
    ctx.error(`groupdel: cannot remove the primary group of user '${primaryOf.name}'`);
    return 8;
  }
  sys.state.groups = sys.state.groups.filter((x) => x !== g);
  return 0;
}

// ------------------------------------------------------------------ gpasswd

const GPASSWD: OptSpec[] = [
  { name: "add", short: "a", long: "add", arg: true }, { name: "delete", short: "d", long: "delete", arg: true },
  { name: "help", short: "h", long: "help" }, { name: "root", short: "Q", long: "root", arg: true },
  { name: "removePw", short: "r", long: "remove-password" }, { name: "restrict", short: "R", long: "restrict" },
  { name: "members", short: "M", long: "members", arg: true }, { name: "admins", short: "A", long: "administrators", arg: true },
];

function* gpasswd(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  const r = getopt("gpasswd", args, GPASSWD);
  if (!r.ok) return usageError(ctx, r.message);
  const o = r.opts;
  if (has(o, "help")) {
    ctx.print(USAGE.gpasswd.replace(/\n$/, ""));
    return 0;
  }
  const single = ["add", "delete", "removePw", "restrict"].filter((k) => has(o, k));
  const multi = ["members", "admins"].filter((k) => has(o, k));
  if (r.operands.length !== 1 || single.length > 1 || (single.length === 1 && multi.length > 0)) {
    ctx.error(USAGE.gpasswd.replace(/\n$/, ""));
    return 2;
  }
  const gname = r.operands[0];
  const g = sys.group(gname);
  if (!g) {
    ctx.error(`gpasswd: group '${gname}' does not exist in /etc/group`);
    return 3;
  }
  const me = ctx.session().user;
  const isAdmin = ctx.isRoot() || g.admins.includes(me);
  if ((has(o, "members") || has(o, "admins")) && !ctx.isRoot()) {
    ctx.error("gpasswd: Permission denied.");
    return 3;
  }
  if (!isAdmin) {
    ctx.error("gpasswd: Permission denied.");
    return 3;
  }
  const checkUsers = (list: string): string[] | null => {
    const names = list.split(",").filter(Boolean);
    for (const n of names) {
      if (!sys.user(n)) {
        ctx.error(`gpasswd: user '${n}' does not exist`);
        return null;
      }
    }
    return names;
  };
  const add = val(o, "add");
  if (add !== undefined) {
    if (!sys.user(add)) {
      ctx.error(`gpasswd: user '${add}' does not exist`);
      return 3;
    }
    ctx.print(`Adding user ${add} to group ${gname}`);
    if (!g.members.includes(add)) g.members.push(add);
    return 0;
  }
  const del = val(o, "delete");
  if (del !== undefined) {
    if (!g.members.includes(del)) {
      ctx.error(`gpasswd: user '${del}' is not a member of '${gname}'`);
      return 3;
    }
    ctx.print(`Removing user ${del} from group ${gname}`);
    g.members = g.members.filter((m) => m !== del);
    return 0;
  }
  if (has(o, "removePw")) {
    g.password = "";
    return 0;
  }
  if (has(o, "restrict")) {
    g.password = "!";
    return 0;
  }
  if (multi.length) {
    const a = val(o, "admins");
    const m = val(o, "members");
    const admins = a !== undefined ? checkUsers(a) : undefined;
    if (admins === null) return 3;
    const members = m !== undefined ? checkUsers(m) : undefined;
    if (members === null) return 3;
    if (admins) g.admins = admins;
    if (members) g.members = members;
    return 0;
  }
  // Gruppenpasswort setzen
  ctx.print(`Changing the password for group ${gname}`);
  const pw = yield* askNewPassword(ctx, "New Password: ", "Re-enter new password: ");
  if (pw === null) {
    ctx.error("gpasswd: Try again later");
    return 1;
  }
  g.password = HASH_PLACEHOLDER;
  return 0;
}

// ------------------------------------------------------------------ passwd

const PASSWD: OptSpec[] = [
  { name: "all", short: "a", long: "all" }, { name: "delete", short: "d", long: "delete" },
  { name: "expire", short: "e", long: "expire" }, { name: "help", short: "h", long: "help" },
  { name: "keep", short: "k", long: "keep-tokens" }, { name: "inactive", short: "i", long: "inactive", arg: true },
  { name: "lock", short: "l", long: "lock" }, { name: "min", short: "n", long: "mindays", arg: true },
  { name: "quiet", short: "q", long: "quiet" }, { name: "repo", short: "r", long: "repository", arg: true },
  { name: "root", short: "R", long: "root", arg: true }, { name: "prefix", short: "P", long: "prefix", arg: true },
  { name: "status", short: "S", long: "status" }, { name: "unlock", short: "u", long: "unlock" },
  { name: "warn", short: "w", long: "warndays", arg: true }, { name: "max", short: "x", long: "maxdays", arg: true },
];

function* passwd(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  const r = getopt("passwd", args, PASSWD);
  if (!r.ok) return usageError(ctx, r.message);
  const o = r.opts;
  if (has(o, "help")) {
    ctx.print(USAGE.passwd.replace(/\n$/, ""));
    return 0;
  }
  if (r.operands.length > 1) {
    ctx.error(USAGE.passwd.replace(/\n$/, ""));
    return 2;
  }
  const me = ctx.session().user;
  if (has(o, "status") && has(o, "all")) {
    if (!ctx.isRoot()) {
      ctx.error("passwd: Permission denied.");
      return 1;
    }
    for (const u of sys.state.users) ctx.print(statusLine(u));
    return 0;
  }
  const target = r.operands[0] ?? me;
  const user = sys.user(target);
  if (!user) {
    ctx.error(`passwd: user '${target}' does not exist`);
    return 1;
  }
  if (target !== me && !ctx.isRoot()) {
    ctx.error(`passwd: You may not view or modify password information for ${target}.`);
    return 1;
  }
  if (has(o, "status")) {
    ctx.print(statusLine(user));
    return 0;
  }
  const modFlags = ["delete", "expire", "lock", "unlock", "min", "max", "warn", "inactive"].filter((k) => has(o, k));
  if (modFlags.length) {
    if (!ctx.isRoot()) {
      ctx.error("passwd: Permission denied.");
      return 1;
    }
    const nums: [string, keyof Shadow][] = [["min", "min"], ["max", "max"], ["warn", "warn"], ["inactive", "inactive"]];
    for (const [k, f] of nums) {
      const v = val(o, k);
      if (v === undefined) continue;
      if (!/^-?\d+$/.test(v)) {
        ctx.error(`passwd: invalid numeric argument '${v}'`);
        ctx.error(USAGE.passwd.replace(/\n$/, ""));
        return 2;
      }
      (user.shadow[f] as number) = Number(v);
    }
    if (has(o, "unlock")) {
      const rest = user.shadow.hash.replace(/^!+/, "");
      if (rest === "") {
        ctx.error("passwd: unlocking the password would result in a passwordless account.");
        ctx.error("You should set a password with usermod -p to unlock the password of this account.");
        return 3;
      }
      user.shadow.hash = rest;
    }
    if (has(o, "lock") && !user.shadow.hash.startsWith("!")) user.shadow.hash = "!" + user.shadow.hash;
    if (has(o, "delete")) {
      user.shadow.hash = "";
      user.shadow.plain = "";
    }
    if (has(o, "expire")) user.shadow.lastChange = 0;
    if (!has(o, "quiet")) ctx.print("passwd: password expiry information changed.");
    return 0;
  }

  // Passwort ändern
  if (!ctx.isRoot()) {
    ctx.print(`Changing password for ${target}.`);
    const cur = yield* ctx.ask("Current password: ", true);
    if (user.shadow.plain === null || cur !== user.shadow.plain) {
      ctx.error("passwd: Authentication token manipulation error");
      ctx.error("passwd: password unchanged");
      return 10;
    }
  }
  const pw = yield* askNewPassword(ctx);
  if (pw === null) {
    ctx.error("passwd: Authentication token manipulation error");
    ctx.error("passwd: password unchanged");
    return 10;
  }
  if (!ctx.isRoot() && pw === user.shadow.plain) {
    ctx.error("Password unchanged");
    ctx.error("passwd: Authentication token manipulation error");
    ctx.error("passwd: password unchanged");
    return 10;
  }
  user.shadow.hash = HASH_PLACEHOLDER;
  user.shadow.plain = pw;
  user.shadow.lastChange = sys.today();
  ctx.print("passwd: password updated successfully");
  return 0;
}

// ------------------------------------------------------------------ chage

const CHAGE: OptSpec[] = [
  { name: "last", short: "d", long: "lastday", arg: true }, { name: "expire", short: "E", long: "expiredate", arg: true },
  { name: "help", short: "h", long: "help" }, { name: "iso", short: "i", long: "iso8601" },
  { name: "inactive", short: "I", long: "inactive", arg: true }, { name: "list", short: "l", long: "list" },
  { name: "min", short: "m", long: "mindays", arg: true }, { name: "max", short: "M", long: "maxdays", arg: true },
  { name: "root", short: "R", long: "root", arg: true }, { name: "prefix", short: "P", long: "prefix", arg: true },
  { name: "warn", short: "W", long: "warndays", arg: true },
];

function* chage(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  const r = getopt("chage", args, CHAGE);
  if (!r.ok) return usageError(ctx, r.message);
  const o = r.opts;
  if (has(o, "help")) {
    ctx.print(USAGE.chage.replace(/\n$/, ""));
    return 0;
  }
  if (r.operands.length !== 1) {
    ctx.error(USAGE.chage.replace(/\n$/, ""));
    return 2;
  }
  const modKeys = ["last", "expire", "inactive", "min", "max", "warn"].filter((k) => has(o, k));
  if (has(o, "list") && modKeys.length) {
    ctx.error('chage: do not include "l" with other flags');
    ctx.error(USAGE.chage.replace(/\n$/, ""));
    return 2;
  }
  const name = r.operands[0];
  const me = ctx.session().user;
  if (!ctx.isRoot() && !(has(o, "list") && name === me)) {
    ctx.error("chage: Permission denied.");
    return 1;
  }
  const user = sys.user(name);
  if (!user) {
    ctx.error(`chage: user '${name}' does not exist in /etc/passwd`);
    return 1;
  }
  if (has(o, "list")) {
    for (const line of chageLines(user, has(o, "iso"))) ctx.print(line);
    return 0;
  }
  const s = user.shadow;
  if (modKeys.length) {
    const changes: Partial<Shadow> = {};
    for (const [k, f] of [["min", "min"], ["max", "max"], ["warn", "warn"], ["inactive", "inactive"]] as const) {
      const v = val(o, k);
      if (v === undefined) continue;
      if (!/^-?\d+$/.test(v)) {
        ctx.error(`chage: invalid numeric argument '${v}'`);
        return 2;
      }
      changes[f] = Number(v);
    }
    for (const [k, f] of [["last", "lastChange"], ["expire", "expire"]] as const) {
      const v = val(o, k);
      if (v === undefined) continue;
      const d = parseShadowDate(v);
      if (d === null) {
        ctx.error(`chage: invalid date '${v}'`);
        return 2;
      }
      changes[f] = d;
    }
    Object.assign(s, changes);
    return 0;
  }
  // interaktiver Modus
  ctx.print(`Changing the aging information for ${name}`);
  ctx.print("Enter the new value, or press ENTER for the default");
  ctx.print("");
  const askNum = function* (label: string, cur: number): Generator<import("../types").SimEvent, number | null, string | undefined> {
    const a = (yield* ctx.ask(`\t${label} [${cur}]: `)).trim();
    if (a === "") return cur;
    if (!/^-?\d+$/.test(a)) return null;
    return Number(a);
  };
  const askDate = function* (label: string, cur: number): Generator<import("../types").SimEvent, number | null, string | undefined> {
    const shown = cur < 0 ? "-1" : isoDate(cur);
    const a = (yield* ctx.ask(`\t${label} (YYYY-MM-DD) [${shown}]: `)).trim();
    if (a === "") return cur;
    return parseShadowDate(a);
  };
  const min = yield* askNum("Minimum Password Age", s.min);
  if (min === null) return failInteractive(ctx);
  const max = yield* askNum("Maximum Password Age", s.max);
  if (max === null) return failInteractive(ctx);
  const last = yield* askDate("Last Password Change", s.lastChange);
  if (last === null) return failInteractive(ctx);
  const warn = yield* askNum("Password Expiration Warning", s.warn);
  if (warn === null) return failInteractive(ctx);
  const inactive = yield* askNum("Password Inactive", s.inactive);
  if (inactive === null) return failInteractive(ctx);
  const expire = yield* askDate("Account Expiration Date", s.expire);
  if (expire === null) return failInteractive(ctx);
  Object.assign(s, { min, max, lastChange: last, warn, inactive, expire });
  return 0;
}

function failInteractive(ctx: Ctx) {
  ctx.error("chage: error changing fields");
  return 1;
}

// ------------------------------------------------------------------ id / groups / getent

const ID: OptSpec[] = [
  { name: "a", short: "a" }, { name: "context", short: "Z", long: "context" }, { name: "group", short: "g", long: "group" },
  { name: "groups", short: "G", long: "groups" }, { name: "name", short: "n", long: "name" }, { name: "real", short: "r", long: "real" },
  { name: "user", short: "u", long: "user" }, { name: "zero", short: "z", long: "zero" }, { name: "help", long: "help" },
  { name: "version", long: "version" },
];

function* id(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  const r = getopt("id", args, ID);
  if (!r.ok) {
    ctx.error(r.message);
    ctx.error("Try 'id --help' for more information.");
    return 1;
  }
  const o = r.opts;
  if (has(o, "help")) {
    ctx.print(USAGE.id.replace(/\n$/, ""));
    return 0;
  }
  if (has(o, "version")) {
    ctx.print("id (GNU coreutils) 9.4");
    return 0;
  }
  const modes = ["user", "group", "groups"].filter((k) => has(o, k));
  if (modes.length > 1) {
    ctx.error("id: cannot print \"only\" of more than one choice");
    return 1;
  }
  if (has(o, "name") && modes.length === 0) {
    ctx.error("id: cannot print only names or real IDs in default format");
    return 1;
  }
  const targets: { uid: number; gid: number; gids: number[] }[] = [];
  if (r.operands.length === 0) {
    const s = ctx.session();
    targets.push({ uid: s.uid, gid: s.gid, gids: s.groups });
  } else {
    for (const n of r.operands) {
      const u = /^\d+$/.test(n) ? sys.userById(Number(n)) ?? sys.user(n) : sys.user(n);
      if (!u) {
        ctx.error(`id: ‘${n}’: no such user`);
        return 1;
      }
      targets.push({ uid: u.uid, gid: u.gid, gids: sys.groupIdsOf(u) });
    }
  }
  const named = has(o, "name");
  for (const t of targets) {
    if (has(o, "user")) ctx.print(named ? sys.userById(t.uid)?.name ?? String(t.uid) : String(t.uid));
    else if (has(o, "group")) ctx.print(named ? sys.groupById(t.gid)?.name ?? String(t.gid) : String(t.gid));
    else if (has(o, "groups")) ctx.print(t.gids.map((g) => (named ? sys.groupById(g)?.name ?? String(g) : String(g))).join(" "));
    else ctx.print(idLine(sys, t.uid, t.gid, t.gids));
  }
  return 0;
}

function* groups(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  if (args.includes("--help")) {
    ctx.print(USAGE.groups.replace(/\n$/, ""));
    return 0;
  }
  const bad = args.find((a) => a.startsWith("-") && a !== "--version");
  if (bad) {
    ctx.error(bad.startsWith("--") ? `groups: unrecognized option '${bad}'` : `groups: invalid option -- '${bad[1]}'`);
    ctx.error("Try 'groups --help' for more information.");
    return 1;
  }
  const names = (ids: number[]) => ids.map((g) => sys.groupById(g)?.name ?? String(g)).join(" ");
  if (args.length === 0) {
    ctx.print(names(ctx.session().groups));
    return 0;
  }
  let code = 0;
  for (const n of args) {
    const u = sys.user(n);
    if (!u) {
      ctx.error(`groups: ‘${n}’: no such user`);
      code = 1;
      continue;
    }
    ctx.print(`${n} : ${names(sys.groupIdsOf(u))}`);
  }
  return code;
}

function* getent(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  if (args.length === 0) {
    ctx.error("getent: wrong number of arguments");
    ctx.error("Try `getent --help' or `getent --usage' for more information.");
    return 1;
  }
  const [db, ...keys] = args;
  const files: Record<string, string> = { passwd: "/etc/passwd", group: "/etc/group", shadow: "/etc/shadow", gshadow: "/etc/gshadow" };
  if (!files[db]) {
    ctx.error(`Unknown database: ${db}`);
    ctx.error("Try `getent --help' or `getent --usage' for more information.");
    return 1;
  }
  if ((db === "shadow" || db === "gshadow") && !ctx.isRoot()) return keys.length ? 2 : 0;
  const lines = sys.readFile(sys.get(files[db])!).trimEnd().split("\n");
  if (keys.length === 0) {
    for (const l of lines) ctx.print(l);
    return 0;
  }
  let code = 0;
  for (const k of keys) {
    const line = lines.find((l) => {
      const f = l.split(":");
      return f[0] === k || ((db === "passwd" || db === "group") && /^\d+$/.test(k) && f[2] === k);
    });
    if (line) ctx.print(line);
    else code = 2;
  }
  return code;
}

// ------------------------------------------------------------------ Installation

export function installBenutzer(sys: SimSystem) {
  sys.register("useradd", useradd, USAGE.useradd);
  sys.register("usermod", usermod, USAGE.usermod);
  sys.register("userdel", userdel, USAGE.userdel);
  sys.register("groupadd", groupadd, USAGE.groupadd);
  sys.register("groupmod", groupmod, USAGE.groupmod);
  sys.register("groupdel", groupdel, USAGE.groupdel);
  sys.register("gpasswd", gpasswd, USAGE.gpasswd);
  sys.register("passwd", passwd, USAGE.passwd);
  sys.register("chage", chage, USAGE.chage);
  sys.register("id", id, USAGE.id);
  sys.register("groups", groups, USAGE.groups);
  sys.register("getent", getent);
  sys.onReset(setupBase);
}
