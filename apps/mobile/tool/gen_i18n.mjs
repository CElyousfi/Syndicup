/**
 * Génère lib/core/i18n/dict.dart (classes typées, une constante par langue) + fr.arb / ar.arb à
 * partir des dictionnaires du web — UNE source de vérité pour le wording des deux clients
 * (parité web/mobile, docs/PARITE_WEB_MOBILE.md) :
 *   apps/web/lib/i18n/{fr,ar}.ts                 (écrits à la main)
 *   apps/web/lib/i18n/locales/<code>.json        (autres langues, scripts/i18n/build.py)
 * Un texte absent d'une langue retombe sur le français.
 *
 * Usage (depuis la racine du monorepo) : node apps/mobile/tool/gen_i18n.mjs
 */
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const out = resolve(here, "../lib/core/i18n");
const localesDir = resolve(root, "apps/web/lib/i18n/locales");
mkdirSync(out, { recursive: true });

// Les dictionnaires sont du TypeScript : tsx (devDependency du workspace) les charge.
const dump = execSync(
  `npx tsx -e 'import {fr} from "${root}/apps/web/lib/i18n/fr"; import {ar} from "${root}/apps/web/lib/i18n/ar"; process.stdout.write(JSON.stringify({fr, ar}))'`,
  { cwd: root, maxBuffer: 64 * 1024 * 1024 }
).toString();
const { fr, ar } = JSON.parse(dump);

/** Langues : fr (référence), ar, puis chaque JSON généré (ordre alphabétique). */
const langs = { fr, ar };
if (existsSync(localesDir)) {
  for (const f of readdirSync(localesDir).sort()) {
    if (!f.endsWith(".json")) continue;
    langs[f.slice(0, -5)] = JSON.parse(readFileSync(resolve(localesDir, f), "utf8"));
  }
}
const codes = Object.keys(langs);

const RESERVED = new Set(["default", "new", "in", "is", "do", "for", "if", "else", "class", "enum", "var", "final", "const", "this", "super", "null", "true", "false", "with", "switch", "case", "return", "void", "while", "try", "catch", "throw", "extends", "static", "as", "on", "of", "get", "set"]);
const field = (k) => (RESERVED.has(k) ? `${k}_` : k);
const pascal = (s) => s.replace(/(^|[._-])(\w)/g, (_, __, c) => c.toUpperCase());
const esc = (s) => "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\$/g, "\\$").replace(/\n/g, "\\n") + "'";
const isCodeMap = (o) => Object.keys(o).every((k) => /^[A-Z0-9_]+$/.test(k));
const isStringMap = (o) => isCodeMap(o) && Object.values(o).every((v) => typeof v === "string");
/** Codes → { title, body… } (ex. errors.codes) : Map<String, Map<String, String>>. */
const isNestedMap = (o) => isCodeMap(o) && Object.values(o).every((v) => v && typeof v === "object" && Object.values(v).every((x) => typeof x === "string"));
const str = (frV, v) => esc(typeof v === "string" && v.trim() ? v : frV);
const sub = (node, k) => (node && typeof node === "object" ? node[k] : undefined);

const classes = [];
/** Renvoie, par langue, l'expression Dart du nœud. */
function genClass(name, frNode, nodes) {
  const fields = [];
  const ctor = Object.fromEntries(codes.map((c) => [c, []]));
  for (const k of Object.keys(frNode)) {
    const f = field(k);
    const v = frNode[k];
    if (typeof v === "string") {
      fields.push(`  final String ${f};`);
      for (const c of codes) ctor[c].push(`${f}: ${str(v, sub(nodes[c], k))}`);
    } else if (isStringMap(v)) {
      fields.push(`  final Map<String, String> ${f};`);
      for (const c of codes) {
        const o = sub(nodes[c], k);
        ctor[c].push(`${f}: {` + Object.keys(v).map((ek) => `${esc(ek)}: ${str(v[ek], sub(o, ek))}`).join(", ") + "}");
      }
    } else if (isNestedMap(v)) {
      fields.push(`  final Map<String, Map<String, String>> ${f};`);
      for (const c of codes) {
        const o = sub(nodes[c], k);
        ctor[c].push(
          `${f}: {` +
            Object.keys(v)
              .map((ek) => `${esc(ek)}: {` + Object.keys(v[ek]).map((ik) => `${esc(ik)}: ${str(v[ek][ik], sub(sub(o, ek), ik))}`).join(", ") + "}")
              .join(", ") +
            "}"
        );
      }
    } else {
      const cn = `${name}${pascal(k)}`;
      const exprs = genClass(cn, v, Object.fromEntries(codes.map((c) => [c, sub(nodes[c], k)])));
      fields.push(`  final ${cn} ${f};`);
      for (const c of codes) ctor[c].push(`${f}: ${exprs[c]}`);
    }
  }
  const params = Object.keys(frNode).map((k) => `required this.${field(k)}`).join(", ");
  classes.push(`class ${name} {\n${fields.join("\n")}\n  const ${name}({${params}});\n}\n`);
  return Object.fromEntries(codes.map((c) => [c, `${name}(${ctor[c].join(", ")})`]));
}

const rootExpr = genClass("Dict", fr, langs);
const constName = (c) => `dict${pascal(c)}`;
const header = `// GÉNÉRÉ — ne pas modifier à la main. Source : apps/web/lib/i18n/{fr,ar}.ts + locales/*.json
// Régénérer : node apps/mobile/tool/gen_i18n.mjs (ou python3 scripts/i18n/build.py)
// ignore_for_file: lines_longer_than_80_chars, prefer_single_quotes, text_direction_code_point_in_literal, non_constant_identifier_names

`;
const body = `${classes.join("\n")}
${codes.map((c) => `const Dict ${constName(c)} = ${rootExpr[c]};\n`).join("\n")}
/// Toutes les langues du dictionnaire, par code (fr, ar, en…).
const Map<String, Dict> dictByLang = {${codes.map((c) => `'${c}': ${constName(c)}`).join(", ")}};
`;
writeFileSync(resolve(out, "dict.dart"), header + body);

// .arb aplatis (Master Spec 13.1) — clés « section_sous_cle » (FR et AR, langues écrites à la main).
const flat = (o, p = "", acc = {}) => {
  for (const k in o) typeof o[k] === "string" ? (acc[(p + k).replace(/[.\-]/g, "_")] = o[k]) : flat(o[k], p + k + "_", acc);
  return acc;
};
writeFileSync(resolve(out, "fr.arb"), JSON.stringify({ "@@locale": "fr", ...flat(fr) }, null, 2));
writeFileSync(resolve(out, "ar.arb"), JSON.stringify({ "@@locale": "ar", ...flat(ar) }, null, 2));
console.log(`dict.dart : ${classes.length} classes · ${Object.keys(flat(fr)).length} chaînes FR · langues : ${codes.join(" ")}`);
