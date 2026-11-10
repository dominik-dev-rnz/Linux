/** Datumsfunktionen wie bei shadow-utils: Tage seit 1970-01-01 (UTC). */

const MS_PER_DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function daysSinceEpoch(ms: number): number {
  return Math.floor(ms / MS_PER_DAY);
}

function utc(days: number): Date {
  return new Date(days * MS_PER_DAY);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Format von chage -l: "Feb 08, 2027" */
export function chageDate(days: number): string {
  const d = utc(days);
  return `${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())}, ${d.getUTCFullYear()}`;
}

export function isoDate(days: number): string {
  const d = utc(days);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Format von passwd -S: "11/10/2026" */
export function usDate(days: number): string {
  const d = utc(days);
  return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${d.getUTCFullYear()}`;
}

/** Datum wie shadow-utils es akzeptiert: YYYY-MM-DD oder Tage seit 1970. -1 = leer. */
export function parseShadowDate(input: string): number | null {
  if (/^-?\d+$/.test(input)) return Number(input);
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const check = new Date(ms);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return daysSinceEpoch(ms);
}

/** Alle sinnvollen Schreibweisen eines Datums (für die Antwortprüfung). */
export function dateVariants(days: number): string[] {
  const d = utc(days);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const mon = MONTHS[m - 1].toLowerCase();
  return [
    `${mon} ${pad(day)}, ${y}`,
    `${mon} ${day}, ${y}`,
    `${mon} ${pad(day)} ${y}`,
    `${mon} ${day} ${y}`,
    `${y}-${pad(m)}-${pad(day)}`,
    `${pad(day)}.${pad(m)}.${y}`,
    `${day}.${m}.${y}`,
    `${pad(m)}/${pad(day)}/${y}`,
  ];
}

/** Zeitstempel für ls -l: "Nov 10 10:16" (lokale Zeit) */
export function lsTime(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, " ")} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
