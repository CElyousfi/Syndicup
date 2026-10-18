/**
 * Agrégats d'affichage côté serveur web (tableaux de bord) — l'API ne fournit pas encore
 * d'endpoints d'agrégation. Arithmétique EXACTE en centimes via BigInt : jamais de float sur
 * un montant (CLAUDE.md §1.1). Résultats destinés à l'affichage uniquement, aucune écriture.
 */

/** "1250.5" → 125050n (centimes). Chaîne invalide → 0n. */
export function versCentimes(montant: string | null | undefined): bigint {
  if (!montant) return 0n;
  const m = montant.trim().match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return 0n;
  const [, signe, entier, dec = ""] = m;
  const centimes = BigInt(entier!) * 100n + BigInt((dec + "00").slice(0, 2));
  return signe === "-" ? -centimes : centimes;
}

/** 125050n → "1250.50" (format API, reformatée ensuite par formatMontant). */
export function versChaine(centimes: bigint): string {
  const negatif = centimes < 0n;
  const abs = negatif ? -centimes : centimes;
  const entier = abs / 100n;
  const dec = (abs % 100n).toString().padStart(2, "0");
  return `${negatif ? "-" : ""}${entier}.${dec}`;
}

export function sommeCentimes(montants: Array<string | null | undefined>): bigint {
  return montants.reduce<bigint>((acc, m) => acc + versCentimes(m), 0n);
}

/**
 * Montant SAISI → format API (« 1250.50 », toujours 2 décimales). MÊME SPÉCIFICATION que le
 * mobile (apps/mobile/lib/core/format/format.dart `parseMontant`, table de tests identique) :
 *  - chiffres, décimales facultatives (1 ou 2) après « , » ou « . » : « 1250 », « 12,5 » ;
 *  - groupement des milliers par espace, U+00A0, U+202F, « . » ou « , » SEULEMENT si chaque
 *    groupe après le premier a exactement 3 chiffres, le même séparateur partout, et un
 *    séparateur décimal différent : « 1 250,50 », « 1.250,50 », « 1,250.50 », « 1 250 000 » ;
 *  - AMBIGU : un seul « . » ou « , » suivi d'exactement 3 chiffres (« 1.250 », « 1,250 ») —
 *    milliers ou décimales ? `null` ici, `montantAmbigu()` permet de le dire à l'utilisateur ;
 *  - refusé : « 12 50 », groupes mélangés, plus de 2 décimales, signe, vide, 13 chiffres et +.
 * Arithmétique sur chaînes uniquement — jamais de float.
 */
export function parseMontant(saisie: string | null | undefined): string | null {
  if (saisie === null || saisie === undefined) return null;
  const s = saisie.trim();
  if (s === "" || montantAmbigu(s)) return null;
  let entier: string;
  let dec: string;
  const simple = s.match(/^(\d+)(?:[.,](\d{1,2}))?$/);
  if (simple) {
    entier = simple[1]!;
    dec = simple[2] ?? "";
  } else {
    const groupe = s.match(/^(\d{1,3})([ \u00a0\u202f.,])(\d{3}(?:\2\d{3})*)(?:([.,])(\d{1,2}))?$/);
    if (!groupe || (groupe[4] !== undefined && groupe[4] === groupe[2])) return null;
    entier = groupe[1]! + groupe[3]!.split(groupe[2]!).join("");
    dec = groupe[5] ?? "";
  }
  entier = entier.replace(/^0+(?=\d)/, "");
  if (entier.length > 12) return null;
  return `${entier}.${(dec + "00").slice(0, 2)}`;
}

/** « 1.250 » / « 1,250 » seuls : 1 250 ou 1,25 ? Illisible sans contexte — on demande. */
export function montantAmbigu(saisie: string | null | undefined): boolean {
  return /^\d{1,3}[.,]\d{3}$/.test((saisie ?? "").trim());
}

/** Lectures possibles d'une saisie ambiguë : « 1 250 » et, si elle a un sens, « 1,25 ». */
export function lecturesAmbigues(saisie: string): string[] {
  const t = saisie.trim();
  const i = t.search(/[.,]/);
  const entier = t.slice(0, i);
  const reste = t.slice(i + 1);
  return [`${entier} ${reste}`, ...(reste.endsWith("0") ? [`${entier},${reste.slice(0, 2)}`] : [])];
}

/**
 * Montant lu dans un FormData par une Server Action — le serveur ne fait jamais confiance au
 * navigateur : la saisie est renormalisée ici. Vide → "" ; invalide → la saisie brute, que la
 * validation de l'API refusera avec un message sous le champ (jamais un montant deviné).
 */
export function montantSaisi(fd: FormData, name: string): string {
  const brut = String(fd.get(name) ?? "").trim();
  if (brut === "") return "";
  return parseMontant(brut) ?? brut;
}

/** Variante facultative : `null` quand le champ est vide. */
export function montantOptionnel(fd: FormData, name: string): string | null {
  const v = montantSaisi(fd, name);
  return v === "" ? null : v;
}

/** Ratio a/b en nombre 0..1 pour les jauges (3 décimales suffisent à l'affichage). */
export function ratio(a: bigint, b: bigint): number {
  if (b === 0n) return 0;
  return Number((a * 1000n) / b) / 1000;
}
