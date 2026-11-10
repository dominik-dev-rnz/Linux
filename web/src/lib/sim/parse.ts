/**
 * Zerlegt eine Eingabezeile wie die Bash (vereinfacht):
 * Anführungszeichen, Variablen ($USER, $HOME, ...), ~, Pipes |,
 * Verkettung mit && || ; und Umleitung > >>.
 */

export interface Command {
  argv: string[];
  /** Index der Wörter mit ungequotetem * oder ? (für die Pfaderweiterung) */
  globs: number[];
  redirect?: { path: string; append: boolean };
}
export interface Pipeline {
  commands: Command[];
  /** Verknüpfung zur NÄCHSTEN Pipeline */
  op: "&&" | "||" | ";" | null;
}

type Tok = { kind: "word"; value: string; glob: boolean } | { kind: "op"; value: string };

export class ParseError extends Error {}

export function tokenize(line: string, vars: Record<string, string>): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let cur = "";
  let inWord = false;
  let glob = false;
  const push = () => {
    if (inWord) toks.push({ kind: "word", value: cur, glob });
    cur = "";
    inWord = false;
    glob = false;
  };
  const expandVar = (): string => {
    // i zeigt auf das Zeichen nach '$'
    if (line[i] === "?") {
      i++;
      return vars["?"] ?? "0";
    }
    if (line[i] === "{") {
      const end = line.indexOf("}", i);
      if (end < 0) throw new ParseError("bad substitution");
      const name = line.slice(i + 1, end);
      i = end + 1;
      return vars[name] ?? "";
    }
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(line.slice(i));
    if (!m) return "$";
    i += m[0].length;
    return vars[m[0]] ?? "";
  };
  while (i < line.length) {
    const c = line[i];
    if (c === " " || c === "\t") {
      push();
      i++;
    } else if (c === "'") {
      const end = line.indexOf("'", i + 1);
      if (end < 0) throw new ParseError("unexpected EOF while looking for matching `''");
      cur += line.slice(i + 1, end);
      inWord = true;
      i = end + 1;
    } else if (c === '"') {
      i++;
      inWord = true;
      while (i < line.length && line[i] !== '"') {
        if (line[i] === "\\" && i + 1 < line.length && '"\\$'.includes(line[i + 1])) {
          cur += line[i + 1];
          i += 2;
        } else if (line[i] === "$") {
          i++;
          cur += expandVar();
        } else {
          cur += line[i++];
        }
      }
      if (i >= line.length) throw new ParseError('unexpected EOF while looking for matching `"\'');
      i++;
    } else if (c === "\\") {
      if (i + 1 < line.length) cur += line[i + 1];
      inWord = true;
      i += 2;
    } else if (c === "$") {
      i++;
      cur += expandVar();
      inWord = true;
    } else if (c === "~" && !inWord && (i + 1 === line.length || /[\s/]/.test(line[i + 1]))) {
      cur += vars.HOME ?? "~";
      inWord = true;
      i++;
    } else if (c === "#" && !inWord) {
      break; // Kommentar
    } else if ("|&;><".includes(c)) {
      push();
      const two = line.slice(i, i + 2);
      if (two === "&&" || two === "||" || two === ">>") {
        toks.push({ kind: "op", value: two });
        i += 2;
      } else if (c === "&") {
        throw new ParseError("Hintergrundprozesse (&) gibt es in der Simulation nicht");
      } else if (c === "<") {
        throw new ParseError("Eingabeumleitung (<) gibt es in der Simulation nicht");
      } else {
        toks.push({ kind: "op", value: c });
        i++;
      }
    } else {
      if (c === "*" || c === "?") glob = true;
      cur += c;
      inWord = true;
      i++;
    }
  }
  push();
  return toks;
}

export function parse(line: string, vars: Record<string, string>): Pipeline[] {
  const toks = tokenize(line, vars);
  const result: Pipeline[] = [];
  let pipeline: Pipeline = { commands: [], op: null };
  let cmd: Command = { argv: [], globs: [] };
  const syntax = (t: string) => new ParseError(`syntax error near unexpected token \`${t}'`);
  const endCmd = (tok: string) => {
    if (cmd.argv.length === 0) throw syntax(tok);
    pipeline.commands.push(cmd);
    cmd = { argv: [], globs: [] };
  };
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.kind === "word") {
      if (t.glob) cmd.globs.push(cmd.argv.length);
      cmd.argv.push(t.value);
      continue;
    }
    if (t.value === ">" || t.value === ">>") {
      const target = toks[k + 1];
      if (!target || target.kind !== "word") throw syntax("newline");
      cmd.redirect = { path: target.value, append: t.value === ">>" };
      k++;
    } else if (t.value === "|") {
      endCmd("|");
    } else {
      endCmd(t.value);
      pipeline.op = t.value as Pipeline["op"];
      result.push(pipeline);
      pipeline = { commands: [], op: null };
    }
  }
  if (cmd.argv.length > 0) pipeline.commands.push(cmd);
  else if (pipeline.commands.length > 0) throw syntax("newline");
  if (pipeline.commands.length > 0) result.push(pipeline);
  return result;
}
