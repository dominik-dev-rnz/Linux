# Präsentationswebsite „Vortrag 4 – Benutzer- und Gruppenverwaltung“

Next.js (App Router, TypeScript, Tailwind v4) mit shadcn/ui. Läuft komplett
im Browser (statischer Export, kein Backend). Antworte auf Deutsch.

## Design-Regeln (verbindlich)
- Verwende ausschließlich die Tokens aus der Token-Datei
  `src/styles/tokens.css` und Komponenten aus shadcn/ui
  (`src/components/ui`).
- Keine neuen Farben, keine Verläufe, keine zusätzlichen Schriftarten,
  keine Abstände oder Radien außerhalb der Skala.
- Bei fehlendem Token zuerst nachfragen, nicht selbst erfinden.

### Was die Token-Datei festlegt
- Farben: `background`, `foreground`, `primary` (blauer Akzent für Prompt,
  Häkchen und Buttons) und `destructive` (Fehler, rot). Abstufungen nur über
  die Deckkraft derselben Tokens: `/10`, `/20`, `/60`.
- Zwei Farbsätze mit denselben Namen: Dark (Standard) und Light
  (`data-theme="light"`, helles System, Klasse `.theme-light`, Druck).
  Im Light-Mode sind Blau und Rot dunkler, damit sie auf Weiß lesbar sind.
  In Komponenten nie `dark:`/`light:` verwenden, nur die Token-Klassen.
- Schrift: Geist (`font-sans`) und Geist Mono (`font-mono`) fürs Terminal.
- Abstände: 0, 4, 8, 12, 16, 24, 32, 48 px, also die Klassen `*-0`, `*-1`,
  `*-2`, `*-3`, `*-4`, `*-6`, `*-8`, `*-12` (z. B. `p-4`, `gap-6`, `h-12`).
- Radius: nur `rounded-base` (8 px). Kein `rounded`, `rounded-full` usw.
- Keine Werte in eckigen Klammern für Farben, Abstände oder Radien
  (`p-[13px]`, `bg-[#fff]`), keine `style`-Attribute mit solchen Werten.

Prüfen: `npm run lint:tokens` (bricht bei Verstößen ab).

## Technik
- `src/lib/sim/`: Simulation (kein echtes Linux). Verhalten und Meldungen
  orientieren sich an Ubuntu 24.04 LTS. Keine echten Passwort-Hashes,
  nur Platzhalter wie `$y$…(gekürzt)` oder `*`.
- `src/lib/room/`: Tasks, Fragen, Prüffunktionen und Lösungsweg. Prüfungen
  lesen den Zustand der Simulation nur, sie ändern nie etwas.
- `src/lib/lab-store.ts`: zentraler Zustand (Maschine, Terminal,
  Fortschritt, Vorführmodus).
- Tests: `npm test` (Vitest). Build: `npm run build` erzeugt `out/`.
