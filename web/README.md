# Vortrag 4 – Präsentationswebsite

Next.js (App Router, TypeScript, Tailwind v4, shadcn/ui). Links Inhalte und
Tasks, rechts ein simuliertes Terminal (kein echtes Linux, nur im Browser).

**Windows:** `start.cmd` doppelklicken. Das Skript installiert beim ersten
Start die Pakete, startet die Website und öffnet http://localhost:3000.
Das Fenster offen lassen, solange die Website laufen soll.

**Andere Systeme / Terminal:**

```bash
npm install
npm run dev          # http://localhost:3000
```

| Befehl                | Zweck                                               |
| --------------------- | --------------------------------------------------- |
| `npm test`            | Tests der Simulation und des kompletten Lösungswegs |
| `npm run lint:tokens` | prüft, dass nur Design-Tokens verwendet werden      |
| `npm run build`       | statischer Export nach `out/` (z. B. GitHub Pages)  |

- Vorführmodus: Button „Lösungsweg zeigen“ (startet neu und spielt alle Tasks
  ab, ca. 2 Minuten) oder „Lösung vorführen“ in einem einzelnen Task.
- Handout: Button „Handout (Druckansicht)“ → Drucken / als PDF speichern.
- Passwort von `student` in der Simulation: `student`.
