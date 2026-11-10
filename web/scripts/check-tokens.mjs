#!/usr/bin/env node
/**
 * Prüft, dass im Code nur Tokens aus src/styles/tokens.css vorkommen:
 * keine eigenen Farben, keine Verläufe, keine fremden Schriften,
 * keine Abstände oder Radien außerhalb der Skala.
 * Aufruf: npm run lint:tokens
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");
const TOKENS = join(SRC, "styles", "tokens.css");

// Skala aus der Token-Datei lesen
const tokenCss = readFileSync(TOKENS, "utf8");
const spacing = new Set([...tokenCss.matchAll(/--spacing-(\d+):/g)].map((m) => m[1]));
const radii = new Set([...tokenCss.matchAll(/--radius-([a-z]+):/g)].map((m) => m[1]));
const colors = new Set([...tokenCss.matchAll(/--color-([a-z-]+):/g)].map((m) => m[1]));
const OPACITIES = new Set(["10", "20", "60"]);

const SPACING_UTILS =
  "p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|right|bottom|left|w|h|size|min-w|min-h|max-w|max-h|scroll-mt|scroll-pt|translate-x|translate-y|basis|indent";
const COLOR_UTILS = "bg|text|border|border-t|border-b|border-l|border-r|outline|ring|fill|stroke|caret|accent|decoration|divide|from|via|to|placeholder|shadow";

const rules = [
  { name: "Hex-Farbe", re: /#[0-9a-fA-F]{3,8}\b/g },
  { name: "Farbfunktion", re: /\b(rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/g },
  { name: "Verlauf", re: /gradient|\bbg-(linear|radial|conic)\b/g },
  { name: "Schriftart", re: /font-family|next\/font\/google|@font-face/g },
  { name: "Wert in eckigen Klammern", re: new RegExp(`(?<![\\w-])-?(?:${SPACING_UTILS}|${COLOR_UTILS}|rounded(?:-[a-z]+)?|font|leading|tracking)-\\[[^\\]]+\\]`, "g") },
  {
    name: "Abstand außerhalb der Skala",
    re: new RegExp(`(?<![\\w-])-?(?:${SPACING_UTILS})-(\\d+(?:\\.\\d+)?|px)(?![\\w/.-])`, "g"),
    test: (m) => !spacing.has(m[1]),
  },
  { name: "Radius außerhalb der Skala", re: /(?<![\w-])rounded(?:-(?:t|b|l|r|tl|tr|bl|br|s|e))?(?:-([a-z0-9]+))?(?![\w-])/g, test: (m) => !radii.has(m[1] ?? "") },
  {
    name: "Farbe ohne Token",
    re: new RegExp(`(?<![\\w-])(?:${COLOR_UTILS})-([a-z]+(?:-[a-z]+)*?)(?:-(\\d{2,3}))?(?:\\/(\\d+))?(?![\\w-])`, "g"),
    test: (m) => {
      const [, name, shade, opacity] = m;
      // Nicht-Farb-Utilities ausnehmen (text-lg, border-2, bg-transparent …)
      const nonColor = /^(xs|sm|base|lg|xl|\d?xl|left|right|center|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|transparent|current|inherit|none|solid|dashed|dotted|double|hidden|collapse|separate|offset|inside|outside|fixed|local|scroll|repeat|cover|contain|auto|top|bottom|x|y|t|b|l|r|opacity|clip|origin|blend|white|black)$/;
      if (nonColor.test(name)) return false;
      if (shade) return true; // z. B. bg-blue-500
      if (!colors.has(name)) return /^[a-z]+$/.test(name) && !nonColor.test(name) && isColorWord(name);
      return opacity !== undefined && !OPACITIES.has(opacity);
    },
  },
  {
    name: "style-Attribut mit Farbe/Abstand",
    re: /style=\{\{([^}]*)\}\}/g,
    test: (m) => /(color|background|margin|padding|gap|radius|width|height|top|left|right|bottom|font)\s*:/i.test(m[1]),
  },
];

const COLOR_WORDS = new Set(["red", "blue", "green", "yellow", "gray", "grey", "slate", "zinc", "neutral", "stone", "orange", "amber", "lime", "emerald", "teal", "cyan", "sky", "indigo", "violet", "purple", "fuchsia", "pink", "rose", "muted", "accent", "secondary", "card", "popover", "ring", "input"]);
function isColorWord(w) {
  return COLOR_WORDS.has(w);
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(SRC).filter((f) => /\.(tsx?|css|mjs|js)$/.test(f) && f !== TOKENS);
let problems = 0;
for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return; // Kommentare
    for (const rule of rules) {
      for (const m of line.matchAll(rule.re)) {
        if (rule.test && !rule.test(m)) continue;
        problems++;
        console.log(`${relative(ROOT, file)}:${i + 1}  ${rule.name}: ${m[0]}`);
      }
    }
  });
}

if (problems) {
  console.log(`\n${problems} Verstoß/Verstöße gegen die Design-Tokens.`);
  process.exit(1);
}
console.log(`Token-Prüfung bestanden: ${files.length} Dateien, nur Tokens aus src/styles/tokens.css.`);
console.log(`  Farben: ${[...colors].join(", ")} | Abstände: ${[...spacing].map((s) => s).join("/")} | Radius: ${[...radii].join(", ")}`);
