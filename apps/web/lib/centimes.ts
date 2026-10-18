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
 * Montant SAISI → format API. Accepte la virgule ou le point décimal et les espaces de
 * groupement (« 1 250,50 », « 1250.50 », « 1250 », espaces insécables compris) ; refuse plus de
 * 2 décimales, plus de 12 chiffres entiers, un signe, une lettre ou deux séparateurs décimaux.
 * Retour : « 1250.50 » (toujours 2 décimales), ou `null` si la saisie n'est pas un montant.
 * Arithmétique sur chaînes uniquement — jamais de float.
 */
export function parseMontant(saisie: string | null | undefined): string | null {
  if (saisie === null || saisie === undefined) return null;
  const brut = saisie.trim();
  if (brut === "") return null;
  // Groupement : espaces ordinaires, insécables (U+00A0), fines insécables (U+202F, U+2009) —
  // seulement par paquets de 3 chiffres (« 1 250 » oui, « 12 50 » non).
  const m = brut.match(/^(\d{1,3}(?:[ \u00a0\u202f\u2009]\d{3})+|\d+)(?:[.,](\d*))?$/);
  if (!m) return null;
  const entier = m[1]!.replace(/[ \u00a0\u202f\u2009]/g, "").replace(/^0+(?=\d)/, "");
  const dec = m[2] ?? "";
  if (entier.length > 12 || dec.length > 2) return null;
  return `${entier}.${(dec + "00").slice(0, 2)}`;
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
