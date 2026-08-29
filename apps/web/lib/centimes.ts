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

/** Ratio a/b en nombre 0..1 pour les jauges (3 décimales suffisent à l'affichage). */
export function ratio(a: bigint, b: bigint): number {
  if (b === 0n) return 0;
  return Number((a * 1000n) / b) / 1000;
}
