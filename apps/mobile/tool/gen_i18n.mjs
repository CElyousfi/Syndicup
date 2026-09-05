/**
 * Génère lib/core/i18n/dict.dart (classes typées FR/AR) + fr.arb / ar.arb à partir des
 * dictionnaires du web (apps/web/lib/i18n/{fr,ar}.ts) — UNE source de vérité pour le wording
 * des deux clients (parité web/mobile, docs/PARITE_WEB_MOBILE.md).
 *
 * Usage (depuis la racine du monorepo) : node apps/mobile/tool/gen_i18n.mjs
 */
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const out = resolve(here, "../lib/core/i18n");
mkdirSync(out, { recursive: true });

// Les dictionnaires sont du TypeScript : tsx (devDependency du workspace database) les charge.
const dump = execSync(
  `npx tsx -e 'import {fr} from "${root}/apps/web/lib/i18n/fr"; import {ar} from "${root}/apps/web/lib/i18n/ar"; process.stdout.write(JSON.stringify({fr, ar}))'`,
  { cwd: root, maxBuffer: 64 * 1024 * 1024 }
).toString();
const { fr, ar } = JSON.parse(dump);

const RESERVED = new Set(["default", "new", "in", "is", "do", "for", "if", "else", "class", "enum", "var", "final", "const", "this", "super", "null", "true", "false", "with", "switch", "case", "return", "void", "while", "try", "catch", "throw", "extends", "static", "as", "on", "of", "get", "set"]);
const field = (k) => (RESERVED.has(k) ? `${k}_` : k);
const pascal = (s) => s.replace(/(^|[._-])(\w)/g, (_, __, c) => c.toUpperCase());
const esc = (s) => "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\$/g, "\\$").replace(/\n/g, "\\n") + "'";
const isEnumMap = (o) => Object.keys(o).every((k) => /^[A-Z0-9_]+$/.test(k));

const classes = [];
function genClass(name, frNode, arNode) {
  const fields = [];
  const ctorFr = [];
  const ctorAr = [];
  for (const k of Object.keys(frNode)) {
    const f = field(k);
    const v = frNode[k];
    const a = arNode?.[k] ?? v;
    if (typeof v === "string") {
      fields.push(`  final String ${f};`);
      ctorFr.push(`${f}: ${esc(v)}`);
      ctorAr.push(`${f}: ${esc(typeof a === "string" ? a : v)}`);
    } else if (isEnumMap(v)) {
      fields.push(`  final Map<String, String> ${f};`);
      const m = (o) => "{" + Object.keys(v).map((ek) => `${esc(ek)}: ${esc(o[ek] ?? v[ek])}`).join(", ") + "}";
      ctorFr.push(`${f}: ${m(v)}`);
      ctorAr.push(`${f}: ${m(typeof a === "object" ? a : v)}`);
    } else {
      const cn = `${name}${pascal(k)}`;
      const sub = genClass(cn, v, typeof a === "object" ? a : v);
      fields.push(`  final ${cn} ${f};`);
      ctorFr.push(`${f}: ${sub.fr}`);
      ctorAr.push(`${f}: ${sub.ar}`);
    }
  }
  const params = Object.keys(frNode).map((k) => `required this.${field(k)}`).join(", ");
  classes.push(`class ${name} {\n${fields.join("\n")}\n  const ${name}({${params}});\n}\n`);
  return { fr: `${name}(${ctorFr.join(", ")})`, ar: `${name}(${ctorAr.join(", ")})` };
}

const rootExpr = genClass("Dict", fr, ar);
const header = `// GÉNÉRÉ — ne pas modifier à la main. Source : apps/web/lib/i18n/{fr,ar}.ts
// Régénérer : node apps/mobile/tool/gen_i18n.mjs
// ignore_for_file: lines_longer_than_80_chars, prefer_single_quotes, text_direction_code_point_in_literal

`;
const body = `${classes.join("\n")}
const Dict dictFr = ${rootExpr.fr};

const Dict dictAr = ${rootExpr.ar};
`;
writeFileSync(resolve(out, "dict.dart"), header + body);

// .arb aplatis (Master Spec 13.1) — clés « section_sous_cle ».
const flat = (o, p = "", acc = {}) => {
  for (const k in o) typeof o[k] === "string" ? (acc[(p + k).replace(/[.\-]/g, "_")] = o[k]) : flat(o[k], p + k + "_", acc);
  return acc;
};
writeFileSync(resolve(out, "fr.arb"), JSON.stringify({ "@@locale": "fr", ...flat(fr) }, null, 2));
writeFileSync(resolve(out, "ar.arb"), JSON.stringify({ "@@locale": "ar", ...flat(ar) }, null, 2));
console.log(`dict.dart : ${classes.length} classes · ${Object.keys(flat(fr)).length} chaînes FR / ${Object.keys(flat(ar)).length} AR`);
