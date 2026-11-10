/**
 * Dateisystem-Befehle: ls, cd, pwd, mkdir, touch, rm, rmdir, cat, chmod,
 * chown, chgrp, grep, head, tail, cut, wc, sort.
 * Rechte werden bei jedem Zugriff geprüft, das setgid-Bit vererbt die Gruppe.
 */
import { lsTime } from "../dates";
import { getopt, has, val, type OptSpec } from "../getopt";
import { baseName, parentOf } from "../system";
import type { Ctx, CmdGen, FsNode, SimSystem } from "../types";
import { tryHelp } from "../usage";

// ------------------------------------------------------------------ Hilfen

/** "drwxrws---" aus Typ und Modus */
export function modeString(node: Pick<FsNode, "type" | "mode">): string {
  const m = node.mode;
  const t = node.type === "dir" ? "d" : "-";
  const tri = (bits: number, special: boolean, ch: string) => {
    const r = bits & 4 ? "r" : "-";
    const w = bits & 2 ? "w" : "-";
    const x = bits & 1;
    const last = special ? (x ? ch : ch.toUpperCase()) : x ? "x" : "-";
    return r + w + last;
  };
  return t + tri((m >> 6) & 7, !!(m & 0o4000), "s") + tri((m >> 3) & 7, !!(m & 0o2000), "s") + tri(m & 7, !!(m & 0o1000), "t");
}

const octal = (m: number) => (m & 0o7777).toString(8).padStart(4, "0");

function umask(ctx: Ctx): number {
  // Ubuntu: root 022, normale Benutzer mit eigener Gruppe 002 (USERGROUPS_ENAB)
  return ctx.session().uid === 0 ? 0o022 : 0o002;
}

type Lookup = { ok: true; abs: string; node: FsNode } | { ok: false; abs: string; reason: "missing" | "denied" | "notdir" };

/** Sucht einen Pfad und prüft dabei das x-Recht auf allen Ordnern davor. */
function lookup(sys: SimSystem, ctx: Ctx, path: string): Lookup {
  const abs = sys.resolve(path, ctx.session());
  // ein Teil des Pfads ist eine Datei?
  let p = parentOf(abs);
  while (p !== "/") {
    const n = sys.get(p);
    if (n && n.type !== "dir") return { ok: false, abs, reason: "notdir" };
    if (!n) break;
    p = parentOf(p);
  }
  if (!sys.canTraverse(abs, ctx.session())) {
    // existiert der Elternordner überhaupt?
    return { ok: false, abs, reason: sys.get(parentOf(abs)) ? "denied" : "missing" };
  }
  const node = sys.get(abs);
  if (!node) return { ok: false, abs, reason: "missing" };
  return { ok: true, abs, node };
}

const reasonText = (r: "missing" | "denied" | "notdir") =>
  r === "missing" ? "No such file or directory" : r === "denied" ? "Permission denied" : "Not a directory";

function ownerName(sys: SimSystem, uid: number) {
  return sys.userById(uid)?.name ?? String(uid);
}
function groupName(sys: SimSystem, gid: number) {
  return sys.groupById(gid)?.name ?? String(gid);
}

function nodeSize(sys: SimSystem, node: FsNode) {
  return node.type === "dir" ? 4096 : new TextEncoder().encode(sys.readFile(node)).length;
}

/** Legt einen neuen Eintrag an und beachtet das setgid-Bit des Elternordners. */
function create(sys: SimSystem, ctx: Ctx, abs: string, type: "dir" | "file", mode?: number) {
  const s = ctx.session();
  const parent = sys.get(parentOf(abs))!;
  const inherit = (parent.mode & 0o2000) !== 0;
  const gid = inherit ? parent.gid : s.gid;
  let m = mode ?? (type === "dir" ? 0o777 : 0o666) & ~umask(ctx);
  if (type === "dir" && inherit) m |= 0o2000;
  if (type === "dir") sys.mkdir(abs, s.uid, gid, m);
  else sys.writeFile(abs, "", s.uid, gid, m);
}

// ------------------------------------------------------------------ ls

const LS: OptSpec[] = [
  { name: "all", short: "a", long: "all" }, { name: "almost", short: "A", long: "almost-all" },
  { name: "dir", short: "d", long: "directory" }, { name: "human", short: "h", long: "human-readable" },
  { name: "long", short: "l" }, { name: "numeric", short: "n", long: "numeric-uid-gid" },
  { name: "one", short: "1" }, { name: "classify", short: "F", long: "classify" }, { name: "help", long: "help" },
];

function* ls(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  const r = getopt("ls", args, LS);
  if (!r.ok) {
    ctx.error(r.message);
    ctx.error(tryHelp("ls"));
    return 2;
  }
  const o = r.opts;
  if (has(o, "help")) {
    ctx.print("Usage: ls [OPTION]... [FILE]...\nList information about the FILEs (the current directory by default).\n\n  -a, --all                  do not ignore entries starting with .\n  -A, --almost-all           do not list implied . and ..\n  -d, --directory            list directories themselves, not their contents\n  -h, --human-readable       with -l and -s, print sizes like 1K 234M 2G etc.\n  -l                         use a long listing format\n  -n, --numeric-uid-gid      like -l, but list numeric user and group IDs\n  -1                         list one file per line");
    return 0;
  }
  const long = has(o, "long") || has(o, "numeric");
  const numeric = has(o, "numeric");
  const operands = r.operands.length ? r.operands : ["."];
  let code = 0;

  type Entry = { name: string; node: FsNode; abs: string };
  const formatLong = (entries: Entry[]): string[] => {
    const rows = entries.map((e) => {
      const links = e.node.type === "dir" ? 2 + sys.children(e.abs).filter((c) => sys.get(c)?.type === "dir").length : 1;
      return [
        modeString(e.node),
        String(links),
        numeric ? String(e.node.uid) : ownerName(sys, e.node.uid),
        numeric ? String(e.node.gid) : groupName(sys, e.node.gid),
        String(nodeSize(sys, e.node)),
        lsTime(e.node.mtime),
        e.name + (has(o, "classify") && e.node.type === "dir" ? "/" : ""),
      ];
    });
    const w = [1, 2, 3, 4].map((i) => Math.max(...rows.map((row) => row[i].length)));
    return rows.map((row) =>
      [row[0], row[1].padStart(w[0]), row[2].padEnd(w[1]), row[3].padEnd(w[2]), row[4].padStart(w[3]), row[5], row[6]].join(" "),
    );
  };
  const formatShort = (entries: Entry[]): string[] => {
    const names = entries.map((e) => e.name + (has(o, "classify") && e.node.type === "dir" ? "/" : ""));
    if (!names.length) return [];
    return has(o, "one") ? names : [names.join("  ")];
  };

  const files: Entry[] = [];
  const dirs: Entry[] = [];
  for (const op of operands) {
    const l = lookup(sys, ctx, op);
    if (!l.ok) {
      ctx.error(`ls: cannot access '${op}': ${reasonText(l.reason)}`);
      code = 2;
      continue;
    }
    if (l.node.type === "dir" && !has(o, "dir")) dirs.push({ name: op, node: l.node, abs: l.abs });
    else files.push({ name: op, node: l.node, abs: l.abs });
  }
  // GNU ls sortiert die Operanden: erst Dateien, dann Ordner, jeweils alphabetisch
  files.sort((a, b) => a.name.localeCompare(b.name));
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  const out: string[] = [];
  if (files.length) out.push(...(long ? formatLong(files) : formatShort(files)));
  const showHeader = operands.length > 1;
  dirs.forEach((d, i) => {
    if (!sys.canAccess(d.abs, "r", ctx.session())) {
      ctx.error(`ls: cannot open directory '${d.name}': Permission denied`);
      code = 2;
      return;
    }
    if (out.length || i > 0) out.push("");
    if (showHeader) out.push(`${d.name}:`);
    let entries: Entry[] = sys
      .children(d.abs)
      .map((abs) => ({ name: baseName(abs), node: sys.get(abs)!, abs }))
      .filter((e) => has(o, "all") || has(o, "almost") || !e.name.startsWith("."));
    entries.sort((a, b) => a.name.replace(/^\./, "").localeCompare(b.name.replace(/^\./, "")));
    if (has(o, "all")) {
      const parent = sys.get(parentOf(d.abs))!;
      entries = [{ name: ".", node: d.node, abs: d.abs }, { name: "..", node: parent, abs: parentOf(d.abs) }, ...entries];
    }
    if (long) {
      const blocks = entries.reduce((sum, e) => sum + (e.node.type === "dir" ? 4 : Math.ceil(nodeSize(sys, e.node) / 4096) * 4), 0);
      out.push(`total ${blocks}`);
      out.push(...formatLong(entries));
    } else {
      out.push(...formatShort(entries));
    }
  });
  // führende Leerzeile vermeiden
  while (out.length && out[0] === "" ) out.shift();
  for (const line of out) ctx.print(line);
  return code;
}

// ------------------------------------------------------------------ cd / pwd

function* cd(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  const s = ctx.session();
  if (args.length > 1) {
    ctx.error("-bash: cd: too many arguments");
    return 1;
  }
  const target = args[0] ?? s.home;
  const l = lookup(sys, ctx, target);
  if (!l.ok) {
    ctx.error(`-bash: cd: ${target}: ${reasonText(l.reason)}`);
    return 1;
  }
  if (l.node.type !== "dir") {
    ctx.error(`-bash: cd: ${target}: Not a directory`);
    return 1;
  }
  if (!sys.canAccess(l.abs, "x", s)) {
    ctx.error(`-bash: cd: ${target}: Permission denied`);
    return 1;
  }
  s.cwd = l.abs;
  return 0;
}

function* pwd(_args: string[], ctx: Ctx): CmdGen {
  ctx.print(ctx.session().cwd);
  return 0;
}

// ------------------------------------------------------------------ mkdir / touch / rm / rmdir

function parseOctal(s: string): number | null {
  return /^[0-7]{1,4}$/.test(s) ? parseInt(s, 8) : null;
}

function* mkdir(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  const r = getopt("mkdir", args, [
    { name: "parents", short: "p", long: "parents" },
    { name: "mode", short: "m", long: "mode", arg: true },
    { name: "verbose", short: "v", long: "verbose" },
  ]);
  if (!r.ok) {
    ctx.error(r.message);
    ctx.error(tryHelp("mkdir"));
    return 1;
  }
  if (!r.operands.length) {
    ctx.error("mkdir: missing operand");
    ctx.error(tryHelp("mkdir"));
    return 1;
  }
  const o = r.opts;
  let mode: number | undefined;
  const mArg = val(o, "mode");
  if (mArg !== undefined) {
    const m = parseOctal(mArg);
    if (m === null) {
      ctx.error(`mkdir: invalid mode ‘${mArg}’`);
      return 1;
    }
    mode = m;
  }
  let code = 0;
  for (const op of r.operands) {
    const abs = sys.resolve(op, ctx.session());
    const chain: string[] = [];
    if (has(o, "parents")) {
      let p = abs;
      while (p !== "/" && !sys.get(p)) {
        chain.unshift(p);
        p = parentOf(p);
      }
      if (!chain.length && sys.get(abs)?.type === "dir") continue;
    } else {
      chain.push(abs);
    }
    for (const dir of chain) {
      const parent = sys.get(parentOf(dir));
      if (sys.get(dir)) {
        ctx.error(`mkdir: cannot create directory ‘${op}’: File exists`);
        code = 1;
        break;
      }
      if (!parent) {
        ctx.error(`mkdir: cannot create directory ‘${op}’: No such file or directory`);
        code = 1;
        break;
      }
      if (parent.type !== "dir") {
        ctx.error(`mkdir: cannot create directory ‘${op}’: Not a directory`);
        code = 1;
        break;
      }
      if (!sys.canTraverse(dir, ctx.session()) || !sys.canAccess(parentOf(dir), "w", ctx.session())) {
        ctx.error(`mkdir: cannot create directory ‘${op}’: Permission denied`);
        code = 1;
        break;
      }
      create(sys, ctx, dir, "dir", dir === abs ? mode : undefined);
      if (has(o, "verbose")) ctx.print(`mkdir: created directory '${dir === abs ? op : dir}'`);
    }
  }
  return code;
}

function* touch(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  const files = args.filter((a) => !a.startsWith("-"));
  if (!files.length) {
    ctx.error("touch: missing file operand");
    ctx.error(tryHelp("touch"));
    return 1;
  }
  let code = 0;
  for (const f of files) {
    const abs = sys.resolve(f, ctx.session());
    const node = sys.get(abs);
    const parent = sys.get(parentOf(abs));
    if (!sys.canTraverse(abs, ctx.session())) {
      ctx.error(`touch: cannot touch '${f}': ${parent ? "Permission denied" : "No such file or directory"}`);
      code = 1;
      continue;
    }
    if (node) {
      if (!sys.canAccess(abs, "w", ctx.session()) && node.uid !== ctx.session().uid && !ctx.isRoot()) {
        ctx.error(`touch: cannot touch '${f}': Permission denied`);
        code = 1;
        continue;
      }
      node.mtime = sys.now();
      continue;
    }
    if (!parent || parent.type !== "dir") {
      ctx.error(`touch: cannot touch '${f}': No such file or directory`);
      code = 1;
      continue;
    }
    if (!sys.canAccess(parentOf(abs), "w", ctx.session())) {
      ctx.error(`touch: cannot touch '${f}': Permission denied`);
      code = 1;
      continue;
    }
    create(sys, ctx, abs, "file");
  }
  return code;
}

function* rm(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  const r = getopt("rm", args, [
    { name: "recursive", short: "r", long: "recursive" }, { name: "R", short: "R" },
    { name: "force", short: "f", long: "force" }, { name: "verbose", short: "v", long: "verbose" },
    { name: "dir", short: "d", long: "dir" }, { name: "i", short: "i" },
  ]);
  if (!r.ok) {
    ctx.error(r.message);
    ctx.error(tryHelp("rm"));
    return 1;
  }
  const o = r.opts;
  const recursive = has(o, "recursive") || has(o, "R");
  const force = has(o, "force");
  if (!r.operands.length) {
    if (force) return 0;
    ctx.error("rm: missing operand");
    ctx.error(tryHelp("rm"));
    return 1;
  }
  let code = 0;
  for (const op of r.operands) {
    const l = lookup(sys, ctx, op);
    if (l.ok && l.abs === "/" && recursive) {
      ctx.error("rm: it is dangerous to operate recursively on '/'");
      ctx.error("rm: use --no-preserve-root to override this failsafe");
      code = 1;
      continue;
    }
    if (!l.ok) {
      if (force && l.reason === "missing") continue;
      ctx.error(`rm: cannot remove '${op}': ${reasonText(l.reason)}`);
      code = 1;
      continue;
    }
    if (l.node.type === "dir" && !recursive) {
      if (has(o, "dir") && sys.children(l.abs).length === 0) {
        // rm -d auf leeren Ordner
      } else {
        ctx.error(`rm: cannot remove '${op}': Is a directory`);
        code = 1;
        continue;
      }
    }
    const s = ctx.session();
    let allowed = sys.canAccess(parentOf(l.abs), "w", s) && sys.canAccess(parentOf(l.abs), "x", s);
    if (allowed && l.node.type === "dir" && s.uid !== 0) {
      // Inhalte löschen braucht w+x im Ordner selbst (und in Unterordnern)
      for (const [p, n] of sys.state.fs) {
        if ((p === l.abs || p.startsWith(l.abs + "/")) && n.type === "dir" && sys.children(p).length) {
          if (!sys.canAccess(p, "w", s) || !sys.canAccess(p, "x", s)) allowed = false;
        }
      }
    }
    if (!allowed) {
      ctx.error(`rm: cannot remove '${op}': Permission denied`);
      code = 1;
      continue;
    }
    sys.removeTree(l.abs);
    if (has(o, "verbose")) ctx.print(l.node.type === "dir" ? `removed directory '${op}'` : `removed '${op}'`);
  }
  return code;
}

function* rmdir(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  if (!args.length) {
    ctx.error("rmdir: missing operand");
    ctx.error(tryHelp("rmdir"));
    return 1;
  }
  let code = 0;
  for (const op of args) {
    const l = lookup(sys, ctx, op);
    const fail = (why: string) => {
      ctx.error(`rmdir: failed to remove '${op}': ${why}`);
      code = 1;
    };
    if (!l.ok) fail(reasonText(l.reason));
    else if (l.node.type !== "dir") fail("Not a directory");
    else if (sys.children(l.abs).length) fail("Directory not empty");
    else if (!sys.canAccess(parentOf(l.abs), "w", ctx.session())) fail("Permission denied");
    else sys.removeTree(l.abs);
  }
  return code;
}

// ------------------------------------------------------------------ cat und Textwerkzeuge

/** Liest Dateien (oder stdin), meldet Fehler wie GNU. */
function readInputs(ctx: Ctx, prog: string, files: string[]): { text: string; label: string }[] | null {
  const { sys } = ctx;
  if (!files.length) return [{ text: ctx.stdin ?? "", label: "" }];
  const out: { text: string; label: string }[] = [];
  let failed = false;
  for (const f of files) {
    const l = lookup(sys, ctx, f);
    if (!l.ok) {
      ctx.error(`${prog}: ${f}: ${reasonText(l.reason)}`);
      failed = true;
      continue;
    }
    if (l.node.type === "dir") {
      ctx.error(`${prog}: ${f}: Is a directory`);
      failed = true;
      continue;
    }
    if (!sys.canAccess(l.abs, "r", ctx.session())) {
      ctx.error(`${prog}: ${f}: Permission denied`);
      failed = true;
      continue;
    }
    out.push({ text: sys.readFile(l.node), label: f });
  }
  return failed && !out.length ? null : out;
}

const linesOf = (text: string) => (text === "" ? [] : text.replace(/\n$/, "").split("\n"));

function* cat(args: string[], ctx: Ctx): CmdGen {
  const number = args.includes("-n");
  const files = args.filter((a) => a !== "-n");
  const inputs = readInputs(ctx, "cat", files);
  if (!inputs) return 1;
  let n = 1;
  for (const i of inputs) for (const line of linesOf(i.text)) ctx.print(number ? `${String(n++).padStart(6)}\t${line}` : line);
  return files.length && inputs.length < files.length ? 1 : 0;
}

function* grep(args: string[], ctx: Ctx): CmdGen {
  const r = getopt("grep", args, [
    { name: "i", short: "i", long: "ignore-case" }, { name: "v", short: "v", long: "invert-match" },
    { name: "n", short: "n", long: "line-number" }, { name: "c", short: "c", long: "count" },
    { name: "w", short: "w", long: "word-regexp" }, { name: "E", short: "E", long: "extended-regexp" },
  ]);
  if (!r.ok) {
    ctx.error(r.message);
    ctx.error("Usage: grep [OPTION]... PATTERNS [FILE]...");
    ctx.error(tryHelp("grep"));
    return 2;
  }
  const [pattern, ...files] = r.operands;
  if (pattern === undefined) {
    ctx.error("Usage: grep [OPTION]... PATTERNS [FILE]...");
    ctx.error(tryHelp("grep"));
    return 2;
  }
  let re: RegExp;
  try {
    const src = has(r.opts, "E") ? pattern : pattern.replace(/\\\|/g, "|");
    re = new RegExp(has(r.opts, "w") ? `\\b(?:${src})\\b` : src, has(r.opts, "i") ? "i" : "");
  } catch {
    ctx.error("grep: Unmatched ( or \\(");
    return 2;
  }
  const inputs = readInputs(ctx, "grep", files);
  if (!inputs) return 2;
  let found = 0;
  const multi = files.length > 1;
  for (const i of inputs) {
    let count = 0;
    linesOf(i.text).forEach((line, idx) => {
      if (re.test(line) !== has(r.opts, "v")) {
        count++;
        if (!has(r.opts, "c")) ctx.print(`${multi ? i.label + ":" : ""}${has(r.opts, "n") ? idx + 1 + ":" : ""}${line}`);
      }
    });
    if (has(r.opts, "c")) ctx.print(`${multi ? i.label + ":" : ""}${count}`);
    found += count;
  }
  return found ? 0 : 1;
}

function headTail(which: "head" | "tail") {
  return function* (args: string[], ctx: Ctx): CmdGen {
    let n = 10;
    const files: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-n") n = Number(args[++i]);
      else if (/^-n\d+$/.test(a)) n = Number(a.slice(2));
      else if (/^-\d+$/.test(a)) n = Number(a.slice(1));
      else files.push(a);
    }
    if (!Number.isFinite(n)) {
      ctx.error(`${which}: invalid number of lines`);
      return 1;
    }
    const inputs = readInputs(ctx, which, files);
    if (!inputs) return 1;
    for (const i of inputs) {
      const lines = linesOf(i.text);
      for (const line of which === "head" ? lines.slice(0, n) : lines.slice(-n || lines.length)) ctx.print(line);
    }
    return 0;
  };
}

function* cut(args: string[], ctx: Ctx): CmdGen {
  const r = getopt("cut", args, [
    { name: "d", short: "d", long: "delimiter", arg: true },
    { name: "f", short: "f", long: "fields", arg: true },
  ]);
  if (!r.ok) {
    ctx.error(r.message);
    ctx.error(tryHelp("cut"));
    return 1;
  }
  const f = val(r.opts, "f");
  if (!f) {
    ctx.error("cut: you must specify a list of bytes, characters, or fields");
    ctx.error(tryHelp("cut"));
    return 1;
  }
  const d = val(r.opts, "d") ?? "\t";
  const fields = new Set<number>();
  for (const part of f.split(",")) {
    const m = /^(\d*)-?(\d*)$/.exec(part);
    if (!m) {
      ctx.error(`cut: invalid field value ‘${part}’`);
      return 1;
    }
    const from = Number(m[1] || 1);
    const to = part.includes("-") ? Number(m[2] || 99) : from;
    for (let i = from; i <= to; i++) fields.add(i);
  }
  const inputs = readInputs(ctx, "cut", r.operands);
  if (!inputs) return 1;
  for (const i of inputs) {
    for (const line of linesOf(i.text)) {
      const parts = line.split(d);
      ctx.print(parts.length === 1 ? line : parts.filter((_, k) => fields.has(k + 1)).join(d));
    }
  }
  return 0;
}

function* wc(args: string[], ctx: Ctx): CmdGen {
  const files = args.filter((a) => !a.startsWith("-"));
  const inputs = readInputs(ctx, "wc", files);
  if (!inputs) return 1;
  for (const i of inputs) {
    const n = linesOf(i.text).length;
    ctx.print(args.includes("-l") ? `${n}${i.label ? " " + i.label : ""}` : `${n} ${i.text.split(/\s+/).filter(Boolean).length} ${i.text.length}${i.label ? " " + i.label : ""}`);
  }
  return 0;
}

function* sort(args: string[], ctx: Ctx): CmdGen {
  const files = args.filter((a) => !a.startsWith("-"));
  const inputs = readInputs(ctx, "sort", files);
  if (!inputs) return 1;
  const lines = inputs.flatMap((i) => linesOf(i.text)).sort();
  if (args.includes("-r")) lines.reverse();
  for (const l of lines) ctx.print(l);
  return 0;
}

// ------------------------------------------------------------------ chmod

function applySymbolic(spec: string, old: number, isDir: boolean): number | null {
  let mode = old;
  for (const clause of spec.split(",")) {
    const m = /^([ugoa]*)([-+=])([rwxXst]*)$/.exec(clause);
    if (!m) return null;
    const who = m[1] || "a";
    const op = m[2];
    const perms = m[3];
    let bits = 0;
    const targets = new Set(who.includes("a") ? ["u", "g", "o"] : who.split(""));
    for (const t of targets) {
      const shift = t === "u" ? 6 : t === "g" ? 3 : 0;
      for (const p of perms) {
        if (p === "r") bits |= 4 << shift;
        if (p === "w") bits |= 2 << shift;
        if (p === "x") bits |= 1 << shift;
        if (p === "X" && (isDir || old & 0o111)) bits |= 1 << shift;
        if (p === "s" && t === "u") bits |= 0o4000;
        if (p === "s" && t === "g") bits |= 0o2000;
        if (p === "t" && t === "o") bits |= 0o1000;
      }
    }
    if (op === "+") mode |= bits;
    else if (op === "-") mode &= ~bits;
    else {
      let clear = 0;
      for (const t of targets) clear |= t === "u" ? 0o4700 : t === "g" ? 0o2070 : 0o1007;
      // bei Ordnern bleibt setgid/setuid bei "=" ohne s erhalten (GNU-Verhalten)
      if (isDir) clear &= ~0o6000;
      mode = (mode & ~clear) | bits;
    }
  }
  return mode;
}

function* chmod(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  let recursive = false;
  let verbose = false;
  const rest: string[] = [];
  for (const a of args) {
    if (a === "-R" || a === "--recursive") recursive = true;
    else if (a === "-v" || a === "--verbose") verbose = true;
    else if (/^-[Rv]+$/.test(a)) {
      if (a.includes("R")) recursive = true;
      if (a.includes("v")) verbose = true;
    } else if (/^-[a-zA-Z]/.test(a) && !/^-[rwxXst]+$/.test(a)) {
      ctx.error(`chmod: invalid option -- '${a[1]}'`);
      ctx.error(tryHelp("chmod"));
      return 1;
    } else rest.push(a);
  }
  if (rest.length === 0) {
    ctx.error("chmod: missing operand");
    ctx.error(tryHelp("chmod"));
    return 1;
  }
  const [spec, ...files] = rest;
  if (!files.length) {
    ctx.error(`chmod: missing operand after ‘${spec}’`);
    ctx.error(tryHelp("chmod"));
    return 1;
  }
  const isOctal = /^[0-7]{1,5}$/.test(spec);
  if (!isOctal && applySymbolic(spec, 0, false) === null) {
    ctx.error(`chmod: invalid mode: ‘${spec}’`);
    ctx.error(tryHelp("chmod"));
    return 1;
  }
  let code = 0;
  for (const f of files) {
    const l = lookup(sys, ctx, f);
    if (!l.ok) {
      ctx.error(`chmod: cannot access '${f}': ${reasonText(l.reason)}`);
      code = 1;
      continue;
    }
    const targets = recursive ? [...sys.state.fs.keys()].filter((p) => p === l.abs || p.startsWith(l.abs + "/")) : [l.abs];
    for (const p of targets) {
      const node = sys.get(p)!;
      const shown = p === l.abs ? f : f.replace(/\/$/, "") + p.slice(l.abs.length);
      if (!ctx.isRoot() && node.uid !== ctx.session().uid) {
        ctx.error(`chmod: changing permissions of '${shown}': Operation not permitted`);
        code = 1;
        continue;
      }
      const old = node.mode;
      let next: number;
      if (isOctal) {
        next = parseInt(spec, 8) & 0o7777;
        // GNU: Bei Ordnern bleiben setuid/setgid erhalten, außer man gibt 5 Ziffern an (z. B. 00770)
        if (node.type === "dir" && spec.length < 5) next |= old & 0o6000;
      } else {
        next = applySymbolic(spec, old, node.type === "dir")!;
      }
      node.mode = next;
      if (verbose) {
        ctx.print(
          old === next
            ? `mode of '${shown}' retained as ${octal(old)} (${modeString({ type: node.type, mode: old }).slice(1)})`
            : `mode of '${shown}' changed from ${octal(old)} (${modeString({ type: node.type, mode: old }).slice(1)}) to ${octal(next)} (${modeString({ type: node.type, mode: next }).slice(1)})`,
        );
      }
    }
  }
  return code;
}

// ------------------------------------------------------------------ chown / chgrp

function* chown(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  const flags = args.filter((a) => /^-/.test(a));
  const rest = args.filter((a) => !/^-/.test(a));
  for (const f of flags) {
    if (!/^-[Rvh]+$/.test(f) && f !== "--recursive" && f !== "--verbose") {
      ctx.error(f.startsWith("--") ? `chown: unrecognized option '${f}'` : `chown: invalid option -- '${f.replace(/^-[Rvh]*/, "")[0]}'`);
      ctx.error(tryHelp("chown"));
      return 1;
    }
  }
  const recursive = flags.some((f) => f.includes("R") || f === "--recursive");
  const verbose = flags.some((f) => /^-[Rvh]*v/.test(f) || f === "--verbose");
  if (rest.length === 0) {
    ctx.error("chown: missing operand");
    ctx.error(tryHelp("chown"));
    return 1;
  }
  const [spec, ...files] = rest;
  if (!files.length) {
    ctx.error(`chown: missing operand after ‘${spec}’`);
    ctx.error(tryHelp("chown"));
    return 1;
  }
  const sep = spec.search(/[:.]/);
  const userPart = sep >= 0 ? spec.slice(0, sep) : spec;
  const groupPart = sep >= 0 ? spec.slice(sep + 1) : undefined;
  let uid: number | undefined;
  let gid: number | undefined;
  if (userPart) {
    const u = /^\d+$/.test(userPart) ? { uid: Number(userPart), gid: sys.userById(Number(userPart))?.gid } : sys.user(userPart);
    if (!u) {
      ctx.error(`chown: invalid user: ‘${spec}’`);
      return 1;
    }
    uid = u.uid;
    if (groupPart === "") gid = u.gid; // "user:" = Login-Gruppe
  }
  if (groupPart) {
    const g = /^\d+$/.test(groupPart) ? { gid: Number(groupPart) } : sys.group(groupPart);
    if (!g) {
      ctx.error(`chown: invalid group: ‘${spec}’`);
      return 1;
    }
    gid = g.gid;
  }
  return yield* changeOwner(ctx, "chown", files, uid, gid, recursive, verbose);
}

function* chgrp(args: string[], ctx: Ctx): CmdGen {
  const { sys } = ctx;
  const flags = args.filter((a) => /^-/.test(a));
  const rest = args.filter((a) => !/^-/.test(a));
  for (const f of flags) {
    if (!/^-[Rvh]+$/.test(f) && f !== "--recursive" && f !== "--verbose") {
      ctx.error(f.startsWith("--") ? `chgrp: unrecognized option '${f}'` : `chgrp: invalid option -- '${f.replace(/^-[Rvh]*/, "")[0]}'`);
      ctx.error(tryHelp("chgrp"));
      return 1;
    }
  }
  if (rest.length === 0) {
    ctx.error("chgrp: missing operand");
    ctx.error(tryHelp("chgrp"));
    return 1;
  }
  const [spec, ...files] = rest;
  if (!files.length) {
    ctx.error(`chgrp: missing operand after ‘${spec}’`);
    ctx.error(tryHelp("chgrp"));
    return 1;
  }
  const g = /^\d+$/.test(spec) ? { gid: Number(spec) } : sys.group(spec);
  if (!g) {
    ctx.error(`chgrp: invalid group: ‘${spec}’`);
    return 1;
  }
  const recursive = flags.some((f) => f.includes("R") || f === "--recursive");
  const verbose = flags.some((f) => /^-[Rvh]*v/.test(f) || f === "--verbose");
  return yield* changeOwner(ctx, "chgrp", files, undefined, g.gid, recursive, verbose);
}

function* changeOwner(
  ctx: Ctx,
  prog: "chown" | "chgrp",
  files: string[],
  uid: number | undefined,
  gid: number | undefined,
  recursive: boolean,
  verbose: boolean,
): CmdGen {
  const { sys } = ctx;
  const s = ctx.session();
  let code = 0;
  for (const f of files) {
    const l = lookup(sys, ctx, f);
    if (!l.ok) {
      ctx.error(`${prog}: cannot access '${f}': ${reasonText(l.reason)}`);
      code = 1;
      continue;
    }
    const targets = recursive ? [...sys.state.fs.keys()].filter((p) => p === l.abs || p.startsWith(l.abs + "/")) : [l.abs];
    for (const p of targets) {
      const node = sys.get(p)!;
      const shown = p === l.abs ? f : f.replace(/\/$/, "") + p.slice(l.abs.length);
      if (!ctx.isRoot()) {
        // Normale Benutzer: Besitzer nicht ändern, Gruppe nur auf eigene Gruppen
        const ownerChange = uid !== undefined && uid !== node.uid;
        const groupOk = gid === undefined || s.groups.includes(gid) || s.gid === gid;
        if (node.uid !== s.uid || ownerChange || !groupOk) {
          ctx.error(
            prog === "chown" && uid !== undefined
              ? `chown: changing ownership of '${shown}': Operation not permitted`
              : `${prog}: changing group of '${shown}': Operation not permitted`,
          );
          code = 1;
          continue;
        }
      }
      const before = `${ownerName(sys, node.uid)}:${groupName(sys, node.gid)}`;
      if (uid !== undefined) node.uid = uid;
      if (gid !== undefined) node.gid = gid;
      if (verbose) {
        const after = `${ownerName(sys, node.uid)}:${groupName(sys, node.gid)}`;
        if (prog === "chgrp") ctx.print(before === after ? `group of '${shown}' retained as ${groupName(sys, node.gid)}` : `changed group of '${shown}' from ${before.split(":")[1]} to ${groupName(sys, node.gid)}`);
        else ctx.print(before === after ? `ownership of '${shown}' retained as ${after}` : `changed ownership of '${shown}' from ${before} to ${after}`);
      }
    }
  }
  return code;
}

// ------------------------------------------------------------------ Installation

export function installDateisystem(sys: SimSystem) {
  sys.register("ls", ls);
  sys.register("cd", cd);
  sys.register("pwd", pwd);
  sys.register("mkdir", mkdir);
  sys.register("touch", touch);
  sys.register("rm", rm);
  sys.register("rmdir", rmdir);
  sys.register("cat", cat);
  sys.register("grep", grep);
  sys.register("head", headTail("head"));
  sys.register("tail", headTail("tail"));
  sys.register("cut", cut);
  sys.register("wc", wc);
  sys.register("sort", sort);
  sys.register("chmod", chmod);
  sys.register("chown", chown);
  sys.register("chgrp", chgrp);
}
