#!/usr/bin/env node
/**
 * Génère les jetons de mouvement des deux clients depuis tokens.json (source unique) :
 *   - apps/web/app/motion-tokens.css      (variables CSS :root)
 *   - apps/web/lib/motion-tokens.ts        (constantes JS, secondes pour `motion`)
 *   - apps/mobile/lib/core/theme/motion_tokens.g.dart
 * `--check` : n'écrit rien, sort en 1 si un fichier généré diffère (CI, scripts/check-alive).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.resolve(ici, "../../..");
const t = JSON.parse(readFileSync(path.join(ici, "tokens.json"), "utf8"));
const check = process.argv.includes("--check");
const ENTETE = "GÉNÉRÉ par packages/config/motion/gen.mjs depuis tokens.json — ne pas modifier à la main.";

const kebab = (s) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
const bezier = (a) => `cubic-bezier(${a.join(", ")})`;

// ── CSS ──
const css = [
  `/* ${ENTETE} */`,
  ":root {",
  ...Object.entries(t.durations).map(([k, v]) => `  --dur-${kebab(k)}: ${v}ms;`),
  `  --stagger: ${t.stagger}ms;`,
  `  --max-stagger: ${t.maxStagger};`,
  ...Object.entries(t.distances).map(([k, v]) => `  --dist-${k}: ${v}px;`),
  ...Object.entries(t.pressScale).map(([k, v]) => `  --press-${k}: ${v};`),
  `  --ease-out: ${bezier(t.easings.out)};`,
  `  --ease-in: ${bezier(t.easings.in)};`,
  `  --ease-spring: ${bezier(t.easings.spring)};`,
  "}",
  "",
].join("\n");

// ── TS ──
const sec = (ms) => Math.round(ms) / 1000;
const ts = [
  `/* ${ENTETE} */`,
  "",
  "/** Durées en millisecondes. */",
  `export const DURATIONS_MS = ${JSON.stringify(t.durations, null, 2)} as const;`,
  "",
  "/** Durées en secondes (convention `motion`). */",
  `export const DUR = ${JSON.stringify(Object.fromEntries(Object.entries(t.durations).map(([k, v]) => [k, sec(v)])), null, 2)} as const;`,
  "",
  `export const STAGGER = ${sec(t.stagger)};`,
  `export const MAX_STAGGER = ${t.maxStagger};`,
  `export const DISTANCES = ${JSON.stringify(t.distances)} as const;`,
  `export const PRESS_SCALE = ${JSON.stringify(t.pressScale)} as const;`,
  `export const EASE_OUT = ${JSON.stringify(t.easings.out)} as const;`,
  `export const EASE_IN = ${JSON.stringify(t.easings.in)} as const;`,
  `export const EASE_SPRING = ${JSON.stringify(t.easings.spring)} as const;`,
  ...Object.entries(t.springs).map(
    ([k, s]) => `export const SPRING_${k.toUpperCase()} = { type: "spring", stiffness: ${s.stiffness}, damping: ${s.damping}, mass: ${s.mass} } as const;`
  ),
  `export const HAPTIC_THROTTLE_MS = ${t.hapticThrottleMs};`,
  "",
].join("\n");

// ── Dart ──
const dartDur = Object.entries(t.durations)
  .map(([k, v]) => `  static const Duration ${k} = Duration(milliseconds: ${v});`)
  .join("\n");
const dart = [
  `// ${ENTETE}`,
  "// ignore_for_file: constant_identifier_names",
  "import 'package:flutter/animation.dart';",
  "import 'package:flutter/physics.dart';",
  "",
  "class SuTokens {",
  "  SuTokens._();",
  "",
  dartDur,
  `  static const Duration stagger = Duration(milliseconds: ${t.stagger});`,
  `  static const int maxStagger = ${t.maxStagger};`,
  ...Object.entries(t.distances).map(([k, v]) => `  static const double dist${k[0].toUpperCase()}${k.slice(1)} = ${v};`),
  ...Object.entries(t.pressScale).map(([k, v]) => `  static const double press${k[0].toUpperCase()}${k.slice(1)} = ${v};`),
  `  static const Curve easeOut = Cubic(${t.easings.out.join(", ")});`,
  `  static const Curve easeIn = Cubic(${t.easings.in.join(", ")});`,
  `  static const Curve spring = Cubic(${t.easings.spring.join(", ")});`,
  ...Object.entries(t.springs).map(
    ([k, s]) => `  static const SpringDescription ${k} = SpringDescription(mass: ${s.mass}, stiffness: ${s.stiffness}, damping: ${s.damping});`
  ),
  `  static const Duration hapticThrottle = Duration(milliseconds: ${t.hapticThrottleMs});`,
  "}",
  "",
].join("\n");

const sorties = [
  ["apps/web/app/motion-tokens.css", css],
  ["apps/web/lib/motion-tokens.ts", ts],
  ["apps/mobile/lib/core/theme/motion_tokens.g.dart", dart],
];

let ecarts = 0;
for (const [rel, contenu] of sorties) {
  const p = path.join(racine, rel);
  const actuel = existsSync(p) ? readFileSync(p, "utf8") : null;
  if (actuel === contenu) continue;
  if (check) {
    console.error(`✘ ${rel} n'est pas à jour — lancer : node packages/config/motion/gen.mjs`);
    ecarts++;
  } else {
    writeFileSync(p, contenu);
    console.log(`✔ ${rel}`);
  }
}
if (check && ecarts) process.exit(1);
if (check) console.log("✔ Jetons de mouvement à jour (web + mobile).");
