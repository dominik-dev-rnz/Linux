/** Datentypen der Simulation (kein echtes Linux). */

export interface Shadow {
  /** Immer ein Platzhalter, z. B. "$y$…(gekürzt)", "!" oder "*". Nie ein echter Hash. */
  hash: string;
  /** Nur für die Simulation (Prüfung bei su/sudo). Wird nie angezeigt. */
  plain: string | null;
  /** Tage seit 1970-01-01, -1 = leer */
  lastChange: number;
  min: number;
  max: number;
  warn: number;
  inactive: number;
  expire: number;
}

export interface User {
  name: string;
  uid: number;
  gid: number;
  gecos: string;
  home: string;
  shell: string;
  shadow: Shadow;
}

export interface Group {
  name: string;
  gid: number;
  members: string[];
  admins: string[];
  password: string;
}

export interface FsNode {
  type: "dir" | "file";
  uid: number;
  gid: number;
  mode: number;
  content: string | (() => string);
  mtime: number;
}

export interface Session {
  user: string;
  uid: number;
  gid: number;
  groups: number[];
  cwd: string;
  home: string;
  shell: string;
  /** Login-Shell (su -, sudo -i)? Dann sagt exit "logout". */
  login: boolean;
}

export interface SimState {
  users: User[];
  groups: Group[];
  fs: Map<string, FsNode>;
  sessions: Session[];
}

export type Tone = "out" | "err";

export type SimEvent =
  | { type: "output"; text: string; tone: Tone }
  | { type: "ask"; prompt: string; hidden: boolean }
  | { type: "clear" };

export type CmdGen = Generator<SimEvent, number | void, string | undefined>;

export interface Ctx {
  print(text: string): void;
  error(text: string): void;
  stdin: string | null;
  isRoot(): boolean;
  session(): Session;
  ask(prompt: string, hidden?: boolean): Generator<SimEvent, string, string | undefined>;
  sys: SimSystem;
  /** Name, unter dem der Befehl aufgerufen wurde */
  name: string;
  /** intern: Ziel für die Ausgabe in einer Pipe (null = Terminal) */
  capture: string[] | null;
}

export type Handler = (args: string[], ctx: Ctx) => CmdGen;

export interface Prompt {
  user: string;
  host: string;
  cwd: string;
  symbol: "#" | "$";
}

export interface SimSystem {
  state: SimState;
  host: string;
  now(): number;
  today(): number;
  history: string[];
  register(name: string, handler: Handler, help?: string): void;
  commands(): string[];
  helpText(name: string): string | undefined;
  run(line: string): Generator<SimEvent, number, string | undefined>;
  prompt(): Prompt;
  reset(): void;
  onReset(fn: (sys: SimSystem) => void): void;
  // Dateisystem
  resolve(path: string, session?: Session): string;
  get(path: string): FsNode | undefined;
  children(path: string): string[];
  mkdir(path: string, uid: number, gid: number, mode: number): void;
  writeFile(path: string, content: FsNode["content"], uid: number, gid: number, mode: number): void;
  removeTree(path: string): void;
  copyTree(src: string, dst: string, uid: number, gid: number): void;
  moveTree(src: string, dst: string): void;
  canAccess(path: string, perm: "r" | "w" | "x", session?: Session): boolean;
  /** Prüft das x-Recht auf allen übergeordneten Ordnern */
  canTraverse(path: string, session?: Session): boolean;
  readFile(node: FsNode): string;
  // Konten
  user(name: string): User | undefined;
  userById(uid: number): User | undefined;
  group(name: string): Group | undefined;
  groupById(gid: number): Group | undefined;
  /** primäre GID zuerst, dann Zusatzgruppen in der Reihenfolge von /etc/group */
  groupIdsOf(user: User): number[];
  session(): Session;
  loginSession(user: User, cwd?: string, login?: boolean): Session;
  sudoTimestamp: Map<string, number>;
  complete(line: string): { line: string; candidates: string[] };
}
