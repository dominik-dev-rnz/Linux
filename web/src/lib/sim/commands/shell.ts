/**
 * Shell-Befehle: sudo, su, exit/logout, echo, whoami, hostname, uname,
 * date, clear, history, help, man, true, false.
 */
import { getInvoke } from "../system";
import type { Ctx, CmdGen, Session, SimSystem } from "../types";
import { isSudoer } from "./benutzer";

const SUDO_TIMEOUT_MS = 15 * 60 * 1000;
const SHELL_BUILTINS = new Set(["cd", "exit", "logout", "history"]);

const SUDO_USAGE = `usage: sudo -h | -K | -k | -V
usage: sudo -v [-ABkNnS] [-g group] [-h host] [-p prompt] [-u user]
usage: sudo -l [-ABkNnS] [-g group] [-h host] [-p prompt] [-U user]
            [-u user] [command [arg ...]]
usage: sudo [-ABbEHkNnPS] [-C num] [-D directory]
            [-g group] [-h host] [-p prompt] [-R directory] [-T timeout]
            [-u user] [VAR=value] [-i | -s] [command [arg ...]]`;

/** Fragt das Passwort ab (wie sudo: 3 Versuche, 15 Minuten gemerkt). */
function* authenticate(ctx: Ctx): Generator<import("../types").SimEvent, boolean, string | undefined> {
  const { sys } = ctx;
  const me = ctx.session();
  if (me.uid === 0) return true;
  const last = sys.sudoTimestamp.get(me.user);
  if (last !== undefined && sys.now() - last < SUDO_TIMEOUT_MS) return true;
  const user = sys.user(me.user);
  for (let i = 0; i < 3; i++) {
    const pw = yield* ctx.ask(`[sudo] password for ${me.user}: `, true);
    if (user && user.shadow.plain !== null && pw === user.shadow.plain && !user.shadow.hash.startsWith("!")) {
      sys.sudoTimestamp.set(me.user, sys.now());
      return true;
    }
    if (i < 2) ctx.error("Sorry, try again.");
  }
  ctx.error("sudo: 3 incorrect password attempts");
  return false;
}

function rootSession(sys: SimSystem, target: string, from: Session, login: boolean): Session | null {
  const u = sys.user(target);
  if (!u) return null;
  return sys.loginSession(u, login ? u.home : from.cwd, login);
}

function* sudo(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  let target = "root";
  let listUser: string | undefined;
  let mode: "run" | "list" | "shell" | "login" | "kill" | "validate" = "run";
  let i = 0;
  for (; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("-") || a === "--") {
      if (a === "--") i++;
      break;
    }
    if (a === "-h" || a === "--help") {
      ctx.print(`sudo - execute a command as another user\n\n${SUDO_USAGE}`);
      return 0;
    }
    if (a === "-V" || a === "--version") {
      ctx.print("Sudo version 1.9.15p5");
      return 0;
    }
    if (a === "-u" || a === "--user") target = args[++i] ?? "";
    else if (a.startsWith("-u") && a.length > 2) target = a.slice(2);
    else if (a === "-U" || a === "--other-user") listUser = args[++i];
    else if (a === "-l" || a === "--list") mode = "list";
    else if (a === "-i" || a === "--login") mode = "login";
    else if (a === "-s" || a === "--shell") mode = "shell";
    else if (a === "-k" || a === "-K" || a === "--reset-timestamp") mode = "kill";
    else if (a === "-v" || a === "--validate") mode = "validate";
    else if (a === "-E" || a === "-H" || a === "-S" || a === "-n") continue;
    else {
      ctx.error(a.startsWith("--") ? `sudo: unrecognized option '${a}'` : `sudo: invalid option -- '${a[1]}'`);
      ctx.error(SUDO_USAGE);
      return 1;
    }
  }
  const command = args.slice(i);
  const me = ctx.session();

  if (mode === "kill") {
    sys.sudoTimestamp.delete(me.user);
    if (!command.length) return 0;
    mode = "run";
  }
  if (mode === "run" && command.length === 0) {
    ctx.error(SUDO_USAGE);
    return 1;
  }
  if (!sys.user(target)) {
    ctx.error(`sudo: unknown user ${target}`);
    ctx.error("sudo: error initializing audit plugin sudoers_audit");
    return 1;
  }
  if (!(yield* authenticate(ctx))) return 1;
  if (!isSudoer(sys, me.user)) {
    if (mode === "list") {
      ctx.print(`Sorry, user ${me.user} may not run sudo on ${sys.host}.`);
      return 1;
    }
    ctx.error(`${me.user} is not in the sudoers file.`);
    return 1;
  }

  if (mode === "validate") return 0;
  if (mode === "list") {
    const who = listUser ?? me.user;
    if (!sys.user(who)) {
      ctx.error(`sudo: unknown user ${who}`);
      return 1;
    }
    if (!isSudoer(sys, who)) {
      ctx.print(`User ${who} is not allowed to run sudo on ${sys.host}.`);
      return 0;
    }
    ctx.print(`Matching Defaults entries for ${who} on ${sys.host}:`);
    ctx.print("    env_reset, mail_badpass, secure_path=/usr/local/sbin\\:/usr/local/bin\\:/usr/sbin\\:/usr/bin\\:/sbin\\:/bin\\:/snap/bin, use_pty");
    ctx.print("");
    ctx.print(`User ${who} may run the following commands on ${sys.host}:`);
    ctx.print("    (ALL : ALL) ALL");
    return 0;
  }
  if (mode === "login" || mode === "shell") {
    const s = rootSession(sys, target, me, mode === "login")!;
    sys.state.sessions.push(s);
    return 0;
  }
  const [cmd] = command;
  if (SHELL_BUILTINS.has(cmd) || !sys.commands().includes(cmd)) {
    ctx.error(`sudo: ${cmd}: command not found`);
    return 1;
  }
  const s = rootSession(sys, target, me, false)!;
  const res = { code: 0 };
  yield* getInvoke(sys)(command, ctx.stdin, ctx.capture, res, s);
  return res.code;
}

function* su(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  let login = false;
  let target: string | undefined;
  for (const a of args) {
    if (a === "-" || a === "-l" || a === "--login") login = true;
    else if (a.startsWith("-")) {
      ctx.error(`su: invalid option -- '${a.replace(/^-+/, "")[0]}'`);
      ctx.error("Try 'su --help' for more information.");
      return 1;
    } else target = a;
  }
  target ??= "root";
  const me = ctx.session();
  const user = sys.user(target);
  if (!user) {
    ctx.error(`su: user ${target} does not exist or the user entry does not contain all the required fields`);
    return 1;
  }
  if (me.uid !== 0) {
    const pw = yield* ctx.ask("Password: ", true);
    const s = user.shadow;
    const ok = s.plain !== null && pw === s.plain && !s.hash.startsWith("!") && s.hash !== "*";
    if (!ok) {
      ctx.error("su: Authentication failure");
      return 1;
    }
    if (s.expire >= 0 && s.expire <= sys.today()) {
      ctx.error("Your account has expired; please contact your system administrator.");
      ctx.error("su: Authentication failure");
      return 1;
    }
  }
  if (user.shell.endsWith("nologin") || user.shell.endsWith("false")) {
    ctx.print("This account is currently not available.");
    return 1;
  }
  const session = sys.loginSession(user, login ? user.home : me.cwd, login);
  if (login && !sys.get(user.home)) {
    ctx.error(`su: warning: cannot change directory to ${user.home}: No such file or directory`);
    session.cwd = "/";
  }
  sys.state.sessions.push(session);
  return 0;
}

function* exit(_args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  const s = ctx.session();
  if (ctx.name === "logout" && !s.login) {
    ctx.error("-bash: logout: not login shell: use `exit'");
    return 1;
  }
  ctx.print(s.login ? "logout" : "exit");
  if (sys.state.sessions.length > 1) {
    sys.state.sessions.pop();
  } else {
    // Basis-Sitzung: neu anmelden statt die Verbindung zu verlieren
    const student = sys.user("student");
    if (student) sys.state.sessions = [sys.loginSession(student)];
    ctx.print("");
    ctx.print("(Simulation: Du wurdest automatisch wieder als student angemeldet.)");
  }
  return 0;
}

function* echo(args: string[], ctx: Ctx): CmdGen {
  const words = [...args];
  while (words[0] === "-n" || words[0] === "-e") words.shift();
  ctx.print(words.join(" "));
  return 0;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function* date(_args: string[], ctx: Ctx): CmdGen {
  const d = new Date(ctx.sys.now());
  const p = (n: number) => String(n).padStart(2, "0");
  ctx.print(
    `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, " ")} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC ${d.getUTCFullYear()}`,
  );
  return 0;
}

const HELP = `Simulation: verfügbare Befehle (Ubuntu 24.04 nachgebaut)

  Benutzer:     useradd  usermod  userdel  passwd  chage  id  groups  getent
  Gruppen:      groupadd  groupmod  groupdel  gpasswd
  Rechte:       chown  chgrp  chmod  ls -l  ls -ld
  Dateien:      cd  pwd  mkdir  touch  rm  rmdir  cat  grep  head  tail  cut  wc  sort
  Sitzung:      sudo  su  exit  whoami  hostname  uname  date  history  clear

Tipps: Tab ergänzt Befehle und Namen, ↑/↓ blättert im Verlauf,
       "befehl --help" oder "man befehl" zeigt die Optionen.
       Das Passwort für student lautet: student`;

export function installShell(sys: SimSystem) {
  sys.register("sudo", sudo);
  sys.register("su", su);
  sys.register("exit", exit);
  sys.register("logout", exit);
  sys.register("echo", echo);
  sys.register("whoami", function* (_a, ctx) {
    ctx.print(ctx.session().user);
    return 0;
  });
  sys.register("hostname", function* (_a, ctx) {
    ctx.print(ctx.sys.host);
    return 0;
  });
  sys.register("uname", function* (a, ctx) {
    if (a.includes("-a")) ctx.print(`Linux ${ctx.sys.host} 6.8.0-45-generic #45-Ubuntu SMP PREEMPT_DYNAMIC x86_64 x86_64 x86_64 GNU/Linux`);
    else if (a.includes("-r")) ctx.print("6.8.0-45-generic");
    else ctx.print("Linux");
    return 0;
  });
  sys.register("date", date);
  sys.register("clear", function* () {
    yield { type: "clear" };
    return 0;
  });
  sys.register("history", function* (_a, ctx) {
    ctx.sys.history.forEach((h, i) => ctx.print(`${String(i + 1).padStart(5)}  ${h}`));
    return 0;
  });
  sys.register("help", function* (_a, ctx) {
    ctx.print(HELP);
    return 0;
  });
  sys.register("man", function* (a, ctx) {
    const name = a[a.length - 1];
    if (!name) {
      ctx.error("What manual page do you want?");
      ctx.error("For example, try 'man man'.");
      return 1;
    }
    const text = ctx.sys.helpText(name);
    if (!text) {
      ctx.error(`No manual entry for ${name}`);
      return 16;
    }
    ctx.print(`(Simulation: Kurzfassung statt der vollständigen Handbuchseite von ${name})\n`);
    ctx.print(text.replace(/\n$/, ""));
    return 0;
  });
  sys.register("true", function* () {
    return 0;
  });
  sys.register("false", function* () {
    return 1;
  });
}
