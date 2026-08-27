#!/usr/bin/env node
/**
 * Vérification de conformité contrat ↔ implémentation (CLAUDE.md contract-first) :
 * chaque (path, méthode) d'openapi.yaml doit avoir un handler dans apps/api/app/v1/**,
 * et réciproquement. `/api/inngest` (infrastructure) est hors contrat.
 * Sortie 1 avec tableau lisible en cas d'écart — branché en CI.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const specPath = path.join(racine, "packages/api-contract/openapi.yaml");
const routesRoot = path.join(racine, "apps/api/app/v1");

// ── 1. Paths + méthodes du contrat (parse YAML minimal : indentation fixe du fichier) ──
const lignes = readFileSync(specPath, "utf8").split("\n");
const METHODES = new Set(["get", "post", "patch", "put", "delete"]);
const contrat = new Set();
let pathsAtteint = false;
let pathCourant = null;
for (const ligne of lignes) {
  if (/^paths:\s*$/.test(ligne)) {
    pathsAtteint = true;
    continue;
  }
  if (!pathsAtteint) continue;
  if (/^[a-zA-Z]/.test(ligne)) break; // section racine suivante (components:, etc.)
  const mPath = ligne.match(/^  (\/[^\s:]*):\s*$/);
  if (mPath) {
    pathCourant = mPath[1];
    continue;
  }
  const mMethode = ligne.match(/^    ([a-z]+):\s*$/);
  if (mMethode && pathCourant && METHODES.has(mMethode[1])) {
    contrat.add(`${mMethode[1].toUpperCase()} ${pathCourant}`);
  }
}

// ── 2. Routes implémentées : glob route.ts + exports HTTP ──
function* routeFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) yield* routeFiles(p);
    else if (entry === "route.ts") yield p;
  }
}
const implemente = new Set();
for (const file of routeFiles(routesRoot)) {
  const rel = path.relative(routesRoot, path.dirname(file));
  const apiPath = "/" + rel.split(path.sep).map((s) => s.replace(/^\[(.+)\]$/, "{$1}")).join("/");
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/export (?:const|async function) (GET|POST|PATCH|PUT|DELETE)\b/g)) {
    implemente.add(`${m[1]} ${apiPath}`);
  }
}

// ── 3. Normalisation des noms de paramètres ({id} vs {resolutionId} etc.) ──
const normalise = (op) => op.replace(/\{[^}]+\}/g, "{*}");
const contratN = new Map([...contrat].map((op) => [normalise(op), op]));
const implN = new Map([...implemente].map((op) => [normalise(op), op]));

const manquantes = [...contratN.keys()].filter((k) => !implN.has(k)).map((k) => contratN.get(k));
const horsContrat = [...implN.keys()].filter((k) => !contratN.has(k)).map((k) => implN.get(k));

if (manquantes.length === 0 && horsContrat.length === 0) {
  console.log(`✔ Conformité contrat ↔ routes : ${contrat.size} opérations documentées, ${implemente.size} implémentées, zéro écart.`);
  process.exit(0);
}
if (manquantes.length > 0) {
  console.error("\n✘ Documentées au contrat mais NON implémentées :");
  for (const op of manquantes.sort()) console.error(`   ${op}`);
}
if (horsContrat.length > 0) {
  console.error("\n✘ Implémentées mais ABSENTES du contrat (contract-first violé) :");
  for (const op of horsContrat.sort()) console.error(`   ${op}`);
}
console.error();
process.exit(1);
