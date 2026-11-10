/** getopt_long-ähnlicher Parser mit Fehlermeldungen wie unter Linux. */

export interface OptSpec {
  /** interner Name */
  name: string;
  short?: string;
  long?: string;
  arg?: boolean;
}

export type OptResult =
  | { ok: true; opts: Map<string, string[]>; operands: string[] }
  | { ok: false; message: string };

export function getopt(prog: string, args: string[], spec: OptSpec[]): OptResult {
  const opts = new Map<string, string[]>();
  const operands: string[] = [];
  const add = (name: string, value: string) => {
    const list = opts.get(name) ?? [];
    list.push(value);
    opts.set(name, list);
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") {
      operands.push(...args.slice(i + 1));
      break;
    }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      const key = eq >= 0 ? a.slice(2, eq) : a.slice(2);
      const matches = spec.filter((s) => s.long && s.long.startsWith(key));
      const exact = spec.find((s) => s.long === key);
      const s = exact ?? (matches.length === 1 ? matches[0] : undefined);
      if (!s) {
        if (matches.length > 1) return { ok: false, message: `${prog}: option '${a}' is ambiguous` };
        return { ok: false, message: `${prog}: unrecognized option '${a}'` };
      }
      if (s.arg) {
        if (eq >= 0) add(s.name, a.slice(eq + 1));
        else if (i + 1 < args.length) add(s.name, args[++i]);
        else return { ok: false, message: `${prog}: option '--${s.long}' requires an argument` };
      } else {
        if (eq >= 0) return { ok: false, message: `${prog}: option '--${s.long}' doesn't allow an argument` };
        add(s.name, "");
      }
      continue;
    }
    if (a.startsWith("-") && a.length > 1) {
      for (let j = 1; j < a.length; j++) {
        const ch = a[j];
        const s = spec.find((x) => x.short === ch);
        if (!s) return { ok: false, message: `${prog}: invalid option -- '${ch}'` };
        if (s.arg) {
          const rest = a.slice(j + 1);
          if (rest) add(s.name, rest);
          else if (i + 1 < args.length) add(s.name, args[++i]);
          else return { ok: false, message: `${prog}: option requires an argument -- '${ch}'` };
          break;
        }
        add(s.name, "");
      }
      continue;
    }
    operands.push(a);
  }
  return { ok: true, opts, operands };
}

export const has = (o: Map<string, string[]>, k: string) => o.has(k);
export const val = (o: Map<string, string[]>, k: string) => {
  const v = o.get(k);
  return v ? v[v.length - 1] : undefined;
};
