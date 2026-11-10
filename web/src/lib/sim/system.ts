import { daysSinceEpoch } from "./dates";
import { parse, ParseError } from "./parse";
import type { Ctx, FsNode, Handler, Prompt, Session, SimEvent, SimState, SimSystem, User } from "./types";

export const HOST = "linux-lab";

export interface SystemOptions {
  /** feste Uhrzeit für Tests */
  now?: () => number;
}

function normalize(path: string): string {
  const parts: string[] = [];
  for (const p of path.split("/")) {
    if (!p || p === ".") continue;
    if (p === "..") parts.pop();
    else parts.push(p);
  }
  return "/" + parts.join("/");
}

export function parentOf(path: string): string {
  if (path === "/") return "/";
  const i = path.lastIndexOf("/");
  return i <= 0 ? "/" : path.slice(0, i);
}

export function baseName(path: string): string {
  return path === "/" ? "/" : path.slice(path.lastIndexOf("/") + 1);
}

/**
 * Erstellt das simulierte System. Befehle werden mit register() angemeldet,
 * Grunddaten über onReset() aufgebaut.
 */
export function createSystem(options: SystemOptions = {}): SimSystem {
  const now = options.now ?? (() => Date.now());
  const handlers = new Map<string, Handler>();
  const helps = new Map<string, string>();
  const resetFns: ((sys: SimSystem) => void)[] = [];
  let lastExit = 0;

  const state: SimState = { users: [], groups: [], fs: new Map(), sessions: [] };

  const sys: SimSystem = {
    state,
    host: HOST,
    now,
    today: () => daysSinceEpoch(now()),
    history: [],
    sudoTimestamp: new Map(),

    register(name, handler, help) {
      handlers.set(name, handler);
      if (help) helps.set(name, help);
    },
    commands: () => [...handlers.keys()].sort(),
    helpText: (name) => helps.get(name),

    onReset(fn) {
      resetFns.push(fn);
    },

    reset() {
      state.users = [];
      state.groups = [];
      state.fs = new Map();
      state.sessions = [];
      sys.history = [];
      sys.sudoTimestamp = new Map();
      lastExit = 0;
      const t = now();
      const dir = (p: string, mode = 0o755) => state.fs.set(p, { type: "dir", uid: 0, gid: 0, mode, content: "", mtime: t });
      dir("/");
      for (const d of ["/bin", "/boot", "/dev", "/etc", "/home", "/opt", "/proc", "/srv", "/usr", "/usr/bin", "/usr/sbin", "/var"]) dir(d);
      dir("/root", 0o700);
      dir("/tmp", 0o1777);
      dir("/etc/skel");
      const skel = (name: string, content: string) =>
        state.fs.set(`/etc/skel/${name}`, { type: "file", uid: 0, gid: 0, mode: 0o644, content, mtime: t });
      skel(".bashrc", "# ~/.bashrc: executed by bash(1) for non-login shells.\n# (gekürzt für die Simulation)\nHISTSIZE=1000\nalias ll='ls -alF'\n");
      skel(".profile", '# ~/.profile: executed by the command interpreter for login shells.\nif [ -n "$BASH_VERSION" ]; then\n    if [ -f "$HOME/.bashrc" ]; then\n\t. "$HOME/.bashrc"\n    fi\nfi\n');
      skel(".bash_logout", "# ~/.bash_logout: executed by bash(1) when login shell exits.\n");
      for (const fn of resetFns) fn(sys);
    },

    // ---------------------------------------------------------- Dateisystem
    resolve(path, session) {
      const s = session ?? sys.session();
      if (path === "~" || path.startsWith("~/")) path = s.home + path.slice(1);
      return normalize(path.startsWith("/") ? path : `${s.cwd}/${path}`);
    },
    get: (path) => state.fs.get(path),
    children(path) {
      const prefix = path === "/" ? "/" : path + "/";
      const out: string[] = [];
      for (const key of state.fs.keys()) {
        if (key !== path && key.startsWith(prefix) && !key.slice(prefix.length).includes("/")) out.push(key);
      }
      return out.sort();
    },
    mkdir(path, uid, gid, mode) {
      state.fs.set(path, { type: "dir", uid, gid, mode, content: "", mtime: now() });
    },
    writeFile(path, content, uid, gid, mode) {
      const existing = state.fs.get(path);
      if (existing && existing.type === "file") {
        existing.content = content;
        existing.mtime = now();
      } else {
        state.fs.set(path, { type: "file", uid, gid, mode, content, mtime: now() });
      }
    },
    removeTree(path) {
      for (const key of [...state.fs.keys()]) {
        if (key === path || key.startsWith(path + "/")) state.fs.delete(key);
      }
    },
    copyTree(src, dst, uid, gid) {
      for (const [key, node] of [...state.fs.entries()]) {
        if (key === src || key.startsWith(src + "/")) {
          state.fs.set(dst + key.slice(src.length), { ...node, uid, gid, mtime: now() });
        }
      }
    },
    moveTree(src, dst) {
      for (const [key, node] of [...state.fs.entries()]) {
        if (key === src || key.startsWith(src + "/")) {
          state.fs.delete(key);
          state.fs.set(dst + key.slice(src.length), node);
        }
      }
    },
    canAccess(path, perm, session) {
      const s = session ?? sys.session();
      const node = state.fs.get(path);
      if (!node) return false;
      const bit = perm === "r" ? 4 : perm === "w" ? 2 : 1;
      if (s.uid === 0) {
        // root darf alles, für x muss irgendein x-Bit gesetzt sein (oder Ordner)
        return perm !== "x" || node.type === "dir" || (node.mode & 0o111) !== 0;
      }
      if (node.uid === s.uid) return ((node.mode >> 6) & bit) !== 0;
      if (s.groups.includes(node.gid) || s.gid === node.gid) return ((node.mode >> 3) & bit) !== 0;
      return (node.mode & bit) !== 0;
    },
    canTraverse(path, session) {
      let p = parentOf(path);
      const chain: string[] = [];
      while (true) {
        chain.unshift(p);
        if (p === "/") break;
        p = parentOf(p);
      }
      if (path === "/") return true;
      return chain.every((d) => sys.canAccess(d, "x", session));
    },
    readFile: (node) => (typeof node.content === "function" ? node.content() : node.content),

    // ---------------------------------------------------------- Konten
    user: (name) => state.users.find((u) => u.name === name),
    userById: (uid) => state.users.find((u) => u.uid === uid),
    group: (name) => state.groups.find((g) => g.name === name),
    groupById: (gid) => state.groups.find((g) => g.gid === gid),
    groupIdsOf(user: User) {
      const ids = [user.gid];
      for (const g of state.groups) if (g.members.includes(user.name) && !ids.includes(g.gid)) ids.push(g.gid);
      return ids;
    },
    session() {
      return state.sessions[state.sessions.length - 1];
    },
    loginSession(user, cwd, login = true) {
      return {
        user: user.name,
        uid: user.uid,
        gid: user.gid,
        groups: sys.groupIdsOf(user),
        cwd: cwd ?? user.home,
        home: user.home,
        shell: user.shell,
        login,
      };
    },

    prompt(): Prompt {
      const s = sys.session();
      let cwd = s.cwd;
      if (cwd === s.home) cwd = "~";
      else if (cwd.startsWith(s.home + "/")) cwd = "~" + cwd.slice(s.home.length);
      return { user: s.user, host: HOST, cwd, symbol: s.uid === 0 ? "#" : "$" };
    },

    *run(line) {
      const trimmed = line.trim();
      if (!trimmed) return lastExit;
      sys.history.push(trimmed);
      const s0 = sys.session();
      const vars: Record<string, string> = {
        USER: s0.user,
        LOGNAME: s0.user,
        HOME: s0.home,
        PWD: s0.cwd,
        SHELL: s0.shell,
        HOSTNAME: HOST,
        PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        "?": String(lastExit),
      };
      let pipelines;
      try {
        pipelines = parse(trimmed, vars);
      } catch (e) {
        if (e instanceof ParseError) {
          yield { type: "output", text: `-bash: ${e.message}`, tone: "err" };
          lastExit = 2;
          return 2;
        }
        throw e;
      }
      let code = 0;
      let skip = false;
      for (const pl of pipelines) {
        if (!skip) {
          code = yield* runPipeline(pl.commands);
          lastExit = code;
        }
        skip = (pl.op === "&&" && code !== 0) || (pl.op === "||" && code === 0);
      }
      return code;
    },

    complete(line) {
      return complete(sys, line, [...handlers.keys()]);
    },
  };

  /** Pfaderweiterung wie die Bash: * und ? im Pfad, ohne Treffer bleibt das Wort stehen. */
  function expandGlob(word: string): string[] {
    const s = sys.session();
    const absolute = word.startsWith("/");
    const parts = word.split("/").filter((p, i) => p !== "" || i === 0);
    let bases: string[] = [absolute ? "/" : s.cwd];
    let shown: string[] = [absolute ? "/" : ""];
    for (const part of parts) {
      if (part === "") continue;
      const nextBases: string[] = [];
      const nextShown: string[] = [];
      bases.forEach((base, k) => {
        if (!/[*?]/.test(part)) {
          const p = base === "/" ? "/" + part : base + "/" + part;
          nextBases.push(p);
          nextShown.push(shown[k] + (shown[k] && !shown[k].endsWith("/") ? "/" : "") + part);
          return;
        }
        if (!state.fs.get(base) || !sys.canAccess(base, "r", s)) return;
        const re = new RegExp("^" + part.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
        for (const child of sys.children(base)) {
          const name = baseName(child);
          if (name.startsWith(".") && !part.startsWith(".")) continue;
          if (re.test(name)) {
            nextBases.push(child);
            nextShown.push(shown[k] + (shown[k] && !shown[k].endsWith("/") ? "/" : "") + name);
          }
        }
      });
      bases = nextBases;
      shown = nextShown;
    }
    const hits = shown.filter((_, k) => state.fs.has(bases[k]));
    return hits.length ? hits.sort() : [word];
  }

  function* runPipeline(commands: { argv: string[]; globs: number[]; redirect?: { path: string; append: boolean } }[]) {
    let stdin: string | null = null;
    let code = 0;
    for (let k = 0; k < commands.length; k++) {
      const { redirect } = commands[k];
      const argv = commands[k].argv.flatMap((w, idx) => (commands[k].globs.includes(idx) ? expandGlob(w) : [w]));
      const last = k === commands.length - 1;
      const capture = !last || !!redirect;
      const out: string[] = [];
      const res: { code: number } = { code: 0 };
      yield* invoke(argv, stdin, capture ? out : null, res, sys.session());
      code = res.code;
      stdin = capture ? (out.length ? out.join("\n") + "\n" : "") : null;
      if (redirect && stdin !== null) {
        const err = writeRedirect(redirect.path, stdin, redirect.append);
        if (err) {
          yield { type: "output", text: err, tone: "err" } as SimEvent;
          code = 1;
        }
      }
    }
    return code;
  }

  function writeRedirect(path: string, text: string, append: boolean): string | null {
    const s = sys.session();
    const abs = sys.resolve(path);
    const node = state.fs.get(abs);
    const parent = state.fs.get(parentOf(abs));
    if (node?.type === "dir") return `-bash: ${path}: Is a directory`;
    if (!parent || parent.type !== "dir") return `-bash: ${path}: No such file or directory`;
    if (!sys.canTraverse(abs) || (node ? !sys.canAccess(abs, "w") : !sys.canAccess(parentOf(abs), "w")))
      return `-bash: ${path}: Permission denied`;
    if (node) {
      const old = sys.readFile(node);
      node.content = append ? old + text : text;
      node.mtime = now();
    } else {
      const gid = parent.mode & 0o2000 ? parent.gid : s.gid;
      state.fs.set(abs, { type: "file", uid: s.uid, gid, mode: s.uid === 0 ? 0o644 : 0o664, content: text, mtime: now() });
    }
    return null;
  }

  /** Führt einen einzelnen Befehl aus. Wird auch von sudo verwendet. */
  function* invoke(
    argv: string[],
    stdin: string | null,
    capture: string[] | null,
    res: { code: number },
    session: Session,
  ): Generator<SimEvent, void, string | undefined> {
    const [name, ...args] = argv;
    const handler = handlers.get(name);
    if (!handler) {
      if (name.includes("/")) {
        yield { type: "output", text: `-bash: ${name}: No such file or directory`, tone: "err" };
      } else {
        yield { type: "output", text: `${name}: command not found`, tone: "err" };
      }
      res.code = 127;
      return;
    }
    const pending: SimEvent[] = [];
    let failed = false;
    const ctx: Ctx = {
      name,
      sys,
      stdin,
      capture,
      print(text) {
        if (capture) capture.push(text);
        else pending.push({ type: "output", text, tone: "out" });
      },
      error(text) {
        failed = true;
        pending.push({ type: "output", text, tone: "err" });
      },
      isRoot: () => session.uid === 0,
      session: () => session,
      *ask(prompt, hidden = false) {
        while (pending.length) yield pending.shift()!;
        const answer = yield { type: "ask", prompt, hidden };
        return answer ?? "";
      },
    };
    const gen = handler(args, ctx);
    let input: string | undefined;
    while (true) {
      const step = gen.next(input);
      while (pending.length) yield pending.shift()!;
      if (step.done) {
        res.code = typeof step.value === "number" ? step.value : failed ? 1 : 0;
        return;
      }
      input = yield step.value;
    }
  }

  // sudo braucht Zugriff auf invoke mit einer anderen Sitzung
  (sys as SimSystem & { invoke: typeof invoke }).invoke = invoke;

  return sys;
}

export type InvokeFn = (
  argv: string[],
  stdin: string | null,
  capture: string[] | null,
  res: { code: number },
  session: Session,
) => Generator<SimEvent, void, string | undefined>;

export function getInvoke(sys: SimSystem): InvokeFn {
  return (sys as SimSystem & { invoke: InvokeFn }).invoke;
}

// ------------------------------------------------------------ Tab-Ergänzung

const USER_CMDS = new Set(["usermod", "userdel", "passwd", "chage", "id", "groups", "su", "chown"]);
const GROUP_CMDS = new Set(["groupmod", "groupdel", "gpasswd", "chgrp"]);

function commonPrefix(list: string[]): string {
  if (!list.length) return "";
  let p = list[0];
  for (const s of list) while (!s.startsWith(p)) p = p.slice(0, -1);
  return p;
}

function complete(sys: SimSystem, line: string, cmds: string[]): { line: string; candidates: string[] } {
  const m = /(\S*)$/.exec(line)!;
  const word = m[1];
  const before = line.slice(0, line.length - word.length);
  const words = before.trim().split(/\s+/).filter(Boolean);
  // "sudo" überspringen
  const effective = words[0] === "sudo" ? words.slice(1) : words;
  const isCommandPos = effective.length === 0 || /(\||&&|;)$/.test(before.trim());
  let pool: string[];
  let pathMode = false;
  if (isCommandPos) {
    pool = cmds.filter((c) => c.startsWith(word));
  } else if (word.includes("/") || word.startsWith(".") || word.startsWith("~")) {
    pathMode = true;
    pool = completePath(sys, word);
  } else {
    const cmd = effective[0];
    const prev = effective[effective.length - 1] ?? "";
    if (cmd === "getent" && effective.length === 1) {
      const dbs = ["group", "gshadow", "passwd", "shadow"].filter((d) => d.startsWith(word));
      if (dbs.length === 1) return { line: before + dbs[0] + " ", candidates: [] };
      return { line, candidates: dbs };
    }
    if (cmd === "getent" && effective.length === 2) {
      const pool = (effective[1] === "group" || effective[1] === "gshadow" ? sys.state.groups : sys.state.users).map((x) => x.name);
      const hits = pool.filter((n) => n.startsWith(word)).sort();
      if (hits.length === 1) return { line: before + hits[0] + " ", candidates: [] };
      const pre = commonPrefix(hits);
      return pre.length > word.length ? { line: before + pre, candidates: [] } : { line, candidates: hits };
    }
    const wantGroup = GROUP_CMDS.has(cmd) && effective.length === 1 ? true : /^-[a-zA-Z]*[gG]$/.test(prev) || prev === "--groups" || prev === "--gid";
    const names = wantGroup
      ? sys.state.groups.map((g) => g.name)
      : USER_CMDS.has(cmd) || GROUP_CMDS.has(cmd) || cmd === "gpasswd"
        ? sys.state.users.map((u) => u.name)
        : [];
    pool = names.filter((n) => n.startsWith(word));
    if (!pool.length || word === "") {
      const paths = completePath(sys, word);
      if (!names.length) {
        pathMode = true;
        pool = paths;
      }
    }
  }
  pool = [...new Set(pool)].sort();
  if (pool.length === 1) {
    const done = pool[0];
    const suffix = pathMode && done.endsWith("/") ? "" : " ";
    return { line: before + done + suffix, candidates: [] };
  }
  const prefix = commonPrefix(pool);
  if (prefix.length > word.length) return { line: before + prefix, candidates: [] };
  return { line, candidates: pathMode ? pool.map((p) => p.replace(/\/$/, "").split("/").pop()! + (p.endsWith("/") ? "/" : "")) : pool };
}

function completePath(sys: SimSystem, word: string): string[] {
  const slash = word.lastIndexOf("/");
  const dirPart = slash >= 0 ? word.slice(0, slash + 1) : "";
  const namePart = slash >= 0 ? word.slice(slash + 1) : word;
  const dirAbs = sys.resolve(dirPart || ".");
  const node = sys.get(dirAbs);
  if (!node || node.type !== "dir" || !sys.canAccess(dirAbs, "r") || !sys.canTraverse(dirAbs)) return [];
  return sys
    .children(dirAbs)
    .map((p) => baseName(p))
    .filter((n) => n.startsWith(namePart) && (namePart.startsWith(".") || !n.startsWith(".")))
    .map((n) => dirPart + n + (sys.get(dirAbs === "/" ? "/" + n : dirAbs + "/" + n)?.type === "dir" ? "/" : ""));
}
