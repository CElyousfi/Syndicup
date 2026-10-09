#!/usr/bin/env node
/**
 * Garde-fou « Alive » + rapport de couverture (docs/ALIVE_GUIDE.md).
 *
 * Interdit, dans le code des ÉCRANS (mobile lib/features/**, web app/** + components/** hors
 * primitives ui/ et shell/), les primitives « mortes » qui ont un équivalent vivant :
 * boutons Material bruts, InkWell, RefreshIndicator, spinners, montants en texte figé, <button>,
 * <img>… Un écran neuf ne peut donc pas naître mort.
 *
 * Exception explicite, motivée, sur la ligne ou la ligne précédente :
 *   // alive:allow <raison>        (Dart / TS)      {/* alive:allow <raison> *\/}   (JSX)
 *
 *   node scripts/alive/check-alive.mjs            → résumé ; sort en 1 s'il reste une violation
 *   node scripts/alive/check-alive.mjs --report   → écrit docs/ALIVE_COVERAGE.md (écran × élément)
 *   node scripts/alive/check-alive.mjs --list     → liste chaque violation (fichier:ligne)
 *   node scripts/alive/check-alive.mjs --warn     → n'échoue jamais (amorçage, phase 1)
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = new Set(process.argv.slice(2));

/** Éléments (colonnes du rapport). `alive` = usages des primitives vivantes, `raw` = interdits. */
const ELEMENTS = {
  mobile: [
    {
      key: "pressable",
      label: "Surfaces pressables",
      alive: [/\bSuTap\(/, /\bSuPressable\(/, /\bSuCard\([^)]*onTap/, /\bListRow\(/, /\bCircleIconButton\(/, /\bSuIconButton\(/, /\bLinkButton\(/],
      raw: [
        { re: /\bInkWell\(/, fix: "SuTap" },
        { re: /\bGestureDetector\(/, fix: "SuTap (ou // alive:allow pour un geste non-tap)" },
        { re: /\bInkResponse\(/, fix: "SuTap" },
        { re: /\bListTile\(/, fix: "ListRow" },
      ],
    },
    {
      key: "button",
      label: "Boutons",
      alive: [/\bSuButton\(/, /\bSubmitButton\(/, /\bSuButton\.\w+\(/],
      raw: [
        { re: /\b(Filled|Outlined|Text|Elevated)Button(\.icon|\.tonal)?\(/, fix: "SuButton / LinkButton" },
        { re: /\bIconButton(\.filled)?\(/, fix: "SuIconButton / CircleIconButton" },
      ],
    },
    {
      key: "number",
      label: "Montants & nombres",
      alive: [/\bAnimatedAmount\(/, /\bAnimatedNumber\(/, /\bAnimatedDigits\(/, /\bStatTile\(/, /\bKeyValueRow\.amount\(/, /\bMoneyText\(/],
      raw: [
        // Montant affiché tel quel (hors phrase interpolée '${formatMAD(...)}').
        { re: /(?<!\$\{\s*)\bformatM(AD|ontant)\(/, fix: "AnimatedAmount / KeyValueRow.amount / StatTile(value:)", skip: /(value|hint):\s*formatM|\$\{\s*formatM/ },
      ],
    },
    {
      key: "input",
      label: "Champs",
      alive: [/\bSuField\(/, /\bSuSelect\b/],
      raw: [{ re: /\bTextF(ield|ormField)\(/, fix: "SuField" }],
    },
    {
      key: "toggle",
      label: "Interrupteurs, cases, segments",
      alive: [/\bSuSwitchRow\(/, /\bSuCheckbox\(/, /\bSegmented\b/, /\bFilterChips\b/, /\bSuRadio\w*\(/],
      raw: [
        { re: /\b(Switch|SwitchListTile|CheckboxListTile|RadioListTile)(\.adaptive)?\(/, fix: "SuSwitchRow" },
        { re: /\bCheckbox\(/, fix: "SuCheckbox" },
        { re: /\bRadio(<[^>]*>)?\(/, fix: "SuRadioGroup" },
        { re: /\bSegmentedButton\b/, fix: "Segmented" },
      ],
    },
    {
      key: "image",
      label: "Images",
      alive: [/\bSuImage\(/, /\bCoproPhoto\(/, /\bPhotoBanner\(/, /\bSuIllustration\(/, /\bPosterArt\(/],
      raw: [{ re: /\bImage\.(network|file|memory)\(/, fix: "SuImage" }],
    },
    {
      key: "loading",
      label: "Chargement & progression",
      alive: [/\bAsyncView\b/, /\bLoadingList\(/, /\bLoadingOrb\(/, /\bGauge\(/, /\bSuRing\(/, /\bSkeleton\w*\(/],
      raw: [{ re: /\b(Circular|Linear)ProgressIndicator\(/, fix: "Gauge / SuRing / squelette / LoadingOrb" }],
    },
    {
      key: "overlay",
      label: "Feuilles, dialogues, toasts",
      alive: [/\bshowFormSheet\b/, /\bshowSuSheet\b/, /\bconfirmDialog\(/, /\bshowToast\(/, /\bshowSuccess\(/],
      raw: [
        { re: /\bshowModalBottomSheet\b/, fix: "showSuSheet / showFormSheet" },
        { re: /\bshowDialog\b|\bAlertDialog\(/, fix: "confirmDialog / showSuSheet" },
        { re: /\bSnackBar\(|ScaffoldMessenger\.of/, fix: "showToast" },
      ],
    },
    {
      key: "refresh",
      label: "Tirer pour actualiser",
      alive: [/\bSuRefresh\(/, /\bonRefresh:/],
      raw: [{ re: /\bRefreshIndicator(\.adaptive)?\(/, fix: "SuRefresh (ou SuPage(onRefresh:))" }],
    },
    {
      key: "feel",
      label: "Haptique & sons",
      alive: [/\bHaptics\.\w+\(/, /\bSounds\.play\(/],
      raw: [{ re: /\bHapticFeedback\.\w+\(/, fix: "Haptics.* (sémantique, réglage, anti-rafale)" }],
    },
  ],
  web: [
    {
      key: "pressable",
      label: "Surfaces pressables",
      alive: [/<(Button|ButtonLink|IconButton|Pressable)\b/, /className="[^"]*\b(su-btn|card-interactive|su-press)\b/, /<a [^>]*className="[^"]*\bcard\b/],
      raw: [{ re: /<button\b/, fix: "Button / IconButton / Pressable" }],
    },
    {
      key: "button",
      label: "Boutons d'envoi",
      alive: [/<SubmitButton\b/],
      raw: [{ re: /type="submit"(?![^>]*su-btn)/, fix: "SubmitButton", skip: /<(Button|SubmitButton|IconButton)\b/ }],
    },
    {
      key: "number",
      label: "Montants & nombres",
      alive: [/<(Amount|Odometer|StatCard|LiveNumber)\b/],
      raw: [{ re: /(?<![=:$]\s*)\{\s*formatM(AD|ontant)\(/, fix: "<Amount value=… />" }],
    },
    {
      key: "input",
      label: "Champs",
      alive: [/<(Input|Select|Textarea|Field)\b/],
      raw: [
        { re: /<input\b(?![^>]*type="(hidden|file|checkbox|radio)")/, fix: "Input" },
        { re: /<select\b/, fix: "Select" },
        { re: /<textarea\b/, fix: "Textarea" },
      ],
    },
    {
      key: "toggle",
      label: "Interrupteurs, cases, segments",
      alive: [/<(Switch|Checkbox|Segmented|LinkTabs|Radio\w*)\b/],
      raw: [{ re: /<input\b[^>]*type="(checkbox|radio)"/, fix: "Checkbox / Switch / RadioGroup" }],
    },
    {
      key: "image",
      label: "Images",
      alive: [/<(FadeImg|SuImage|Illustration|PhotoBanner|EspaceImage|Avatar)\b/],
      raw: [{ re: /<img\b/, fix: "FadeImg" }],
    },
    {
      key: "loading",
      label: "Chargement & progression",
      alive: [/<(\w*Skeleton|ProgressBar|RingGauge|Donut|Bars|TresorerieChart|AgeingBars)\b/],
      raw: [{ re: /<Spinner\b|\banimate-spin\b/, fix: "squelette / état du bouton" }],
    },
    {
      key: "overlay",
      label: "Modales & toasts",
      alive: [/<Modal\b/, /\btoast\(/, /\bcelebrate\(/, /<ConfirmDelete\b/],
      raw: [{ re: /<dialog\b|\balert\(|\bconfirm\(/, fix: "Modal / ConfirmDelete / toast" }],
    },
    {
      key: "feel",
      label: "Haptique & sons",
      alive: [/\bhaptic\(/, /\bplaySound\(/],
      raw: [
        { re: /navigator\.vibrate/, fix: "haptic()" },
        { re: /new Audio\(/, fix: "playSound()" },
      ],
    },
  ],
};

const CIBLES = {
  mobile: { dirs: ["apps/mobile/lib/features"], ext: ".dart", exclude: [] },
  web: {
    dirs: ["apps/web/app", "apps/web/components"],
    ext: ".tsx",
    exclude: ["apps/web/components/ui/", "apps/web/components/shell/", "apps/web/app/[locale]/(app)/debug/"],
  },
};

function* fichiers(dir, ext) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) yield* fichiers(p, ext);
    else if (p.endsWith(ext)) yield p;
  }
}

const ALLOW = /alive:allow\b/;
const ALLOW_FILE = /alive:allow-file\b/;

function analyser(plateforme) {
  const { dirs, ext, exclude } = CIBLES[plateforme];
  const lignesRapport = [];
  const violations = [];
  const totaux = Object.fromEntries(ELEMENTS[plateforme].map((e) => [e.key, { alive: 0, raw: 0 }]));
  for (const d of dirs) {
    for (const f of fichiers(path.join(racine, d), ext)) {
      const rel = path.relative(racine, f);
      if (exclude.some((x) => rel.startsWith(x))) continue;
      const src = readFileSync(f, "utf8");
      if (ALLOW_FILE.test(src)) continue;
      const lignes = src.split("\n");
      const parElement = {};
      for (const el of ELEMENTS[plateforme]) {
        let alive = 0;
        let raw = 0;
        lignes.forEach((l, i) => {
          const code = l.replace(/^\s*(\/\/|\*|\/\*).*$/, "");
          for (const re of el.alive) if (re.test(code)) alive++;
          for (const r of el.raw) {
            if (!r.re.test(code)) continue;
            if (r.skip && r.skip.test(code)) continue;
            if (ALLOW.test(l) || (i > 0 && ALLOW.test(lignes[i - 1]))) continue;
            raw++;
            violations.push({ rel, ligne: i + 1, element: el.label, fix: r.fix, code: l.trim().slice(0, 110) });
          }
        });
        parElement[el.key] = { alive, raw };
        totaux[el.key].alive += alive;
        totaux[el.key].raw += raw;
      }
      if (Object.values(parElement).some((v) => v.alive + v.raw > 0)) lignesRapport.push({ rel, parElement });
    }
  }
  return { lignesRapport, violations, totaux };
}

const res = { mobile: analyser("mobile"), web: analyser("web") };
const pct = (a, r) => (a + r === 0 ? 100 : Math.floor((a / (a + r)) * 1000) / 10);

function cellule({ alive, raw }) {
  if (alive + raw === 0) return "·";
  return raw === 0 ? `✅ ${alive}` : `❌ ${raw} / ${alive + raw}`;
}

if (args.has("--report")) {
  const out = [
    "# ALIVE — rapport de couverture",
    "",
    "_Généré par `node scripts/alive/check-alive.mjs --report` — ne pas modifier à la main._",
    "",
    "Chaque cellule : ✅ n = n usages de primitives vivantes, aucun brut ; ❌ r / n = r usages bruts",
    "sur n. `·` = élément absent de l'écran. Les exceptions motivées (`alive:allow`) ne comptent pas",
    "comme brutes et sont listées en fin de rapport.",
    "",
  ];
  for (const plateforme of ["mobile", "web"]) {
    const { lignesRapport, totaux } = res[plateforme];
    const els = ELEMENTS[plateforme];
    const a = Object.values(totaux).reduce((s, v) => s + v.alive, 0);
    const r = Object.values(totaux).reduce((s, v) => s + v.raw, 0);
    out.push(`## ${plateforme === "mobile" ? "Mobile (Flutter)" : "Web (Next.js)"} — ${pct(a, r)} % (${a} vivants, ${r} bruts, ${lignesRapport.length} fichiers d'écran)`, "");
    out.push("| Élément | Vivants | Bruts | Couverture |", "|---|---:|---:|---:|");
    for (const el of els) out.push(`| ${el.label} | ${totaux[el.key].alive} | ${totaux[el.key].raw} | ${pct(totaux[el.key].alive, totaux[el.key].raw)} % |`);
    out.push("", `| Écran (fichier) | ${els.map((e) => e.label).join(" | ")} |`, `|---|${els.map(() => ":-:").join("|")}|`);
    for (const { rel, parElement } of lignesRapport.sort((x, y) => x.rel.localeCompare(y.rel))) {
      const court = rel.replace(/^apps\/(mobile\/lib\/features|web)\//, "");
      out.push(`| \`${court}\` | ${els.map((e) => cellule(parElement[e.key])).join(" | ")} |`);
    }
    out.push("");
  }
  const allows = [];
  for (const d of [...CIBLES.mobile.dirs, ...CIBLES.web.dirs]) {
    const ext = d.includes("mobile") ? ".dart" : ".tsx";
    for (const f of fichiers(path.join(racine, d), ext)) {
      readFileSync(f, "utf8").split("\n").forEach((l, i) => {
        const m = l.match(/alive:allow(-file)?\s+(.*?)(\*\/\}?)?\s*$/);
        if (m) allows.push(`- \`${path.relative(racine, f)}:${i + 1}\` — ${m[2].replace(/\*\/.*$/, "").trim()}`);
      });
    }
  }
  out.push("## Exceptions motivées (`alive:allow`)", "", ...(allows.length ? allows : ["_Aucune._"]), "");
  writeFileSync(path.join(racine, "docs/ALIVE_COVERAGE.md"), out.join("\n"));
  console.log("✔ docs/ALIVE_COVERAGE.md écrit.");
}

if (args.has("--list")) {
  for (const p of ["mobile", "web"]) for (const v of res[p].violations) console.log(`${v.rel}:${v.ligne}  [${v.element}] → ${v.fix}\n    ${v.code}`);
}

let total = 0;
for (const p of ["mobile", "web"]) {
  const { totaux, violations } = res[p];
  const a = Object.values(totaux).reduce((s, v) => s + v.alive, 0);
  const r = Object.values(totaux).reduce((s, v) => s + v.raw, 0);
  total += violations.length;
  console.log(`${r === 0 ? "✔" : "✘"} ${p.padEnd(6)} ${String(pct(a, r)).padStart(5)} % vivant — ${r} usage(s) brut(s) / ${a + r}`);
}
if (total > 0 && !args.has("--warn") && !args.has("--report")) {
  console.error(`\n${total} primitive(s) brute(s) dans des écrans — remplacer par la version vivante (--list) ou motiver « alive:allow <raison> ».`);
  process.exit(1);
}
