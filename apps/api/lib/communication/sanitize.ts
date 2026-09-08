/**
 * Assainissement du contenu des annonces — sous-ensemble Markdown : gras, italique, listes,
 * liens http(s), sauts de ligne. Tout HTML est neutralisé (les chevrons sont échappés), les liens
 * non http(s) (javascript:, data:) sont réduits à leur libellé. Idempotent : assainir deux fois
 * donne le même résultat.
 */
const MAX_LIGNES_VIDES = 2;

export function assainirMarkdown(source: string): string {
  let s = source.replace(/\r\n?/g, "\n");
  // Neutralise l'HTML (déjà échappé → inchangé : &lt; reste &lt;).
  s = s.replace(/&(?!(amp|lt|gt|quot|#39);)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Liens : [libellé](url) — seuls http(s) sont conservés.
  s = s.replace(/\[([^\]\n]{1,200})\]\(([^)\s]{1,2000})\)/g, (_m, libelle: string, url: string) => {
    const propre = url.trim();
    return /^https?:\/\/[^\s]+$/i.test(propre) ? `[${libelle}](${propre})` : libelle;
  });
  // URLs nues non http(s) (javascript:…) : supprimées.
  s = s.replace(/\b(javascript|data|vbscript):[^\s]*/gi, "");
  // Bornes : pas plus de deux lignes vides consécutives, espaces de fin retirés.
  s = s
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(new RegExp(`\n{${MAX_LIGNES_VIDES + 2},}`, "g"), "\n".repeat(MAX_LIGNES_VIDES + 1));
  return s.trim();
}

/** Texte brut (aperçu, digest, SMS) : balises Markdown retirées, entités restituées. */
export function texteBrut(markdown: string, max = 200): string {
  const t = markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>]+/g, "")
    .replace(/^\s*[-+]\s+/gm, "• ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
