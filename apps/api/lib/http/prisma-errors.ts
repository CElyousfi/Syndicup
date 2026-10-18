/**
 * Lecture des erreurs Prisma sans dépendre de l'identité de classe : `instanceof
 * Prisma.PrismaClientKnownRequestError` échoue quand deux copies du runtime coexistent (client
 * étendu, tests) — on lit donc le `code` (P2002, P2025…) que porte toute erreur connue de Prisma.
 * Aucune fonction ici ne renvoie de texte Postgres brut : uniquement des messages français.
 */

/** Code Prisma (« P2002 », « P2025 »…) d'une erreur connue du client, sinon undefined. */
export function codePrisma(e: unknown): string | undefined {
  if (!e || typeof e !== "object") return undefined;
  const code = (e as { code?: unknown }).code;
  const nom = (e as { name?: unknown }).name;
  if (typeof code !== "string" || !/^P\d{4}$/.test(code)) return undefined;
  if (nom !== "PrismaClientKnownRequestError" && !("clientVersion" in e)) return undefined;
  return code;
}

/** Champs en cause d'une violation d'unicité (meta.target), quand Prisma les fournit. */
export function champsPrisma(e: unknown): string[] {
  const target = (e as { meta?: { target?: unknown } } | null)?.meta?.target;
  if (Array.isArray(target)) return target.filter((t): t is string => typeof t === "string");
  return [];
}

/**
 * Traduit le message d'un trigger de contrainte M3 (RAISE EXCEPTION) en phrase utilisateur —
 * sans l'UUID de la copropriété/du lot ni la référence de spec. null si non reconnu.
 */
export function messageTriggerContrainte(brut: string): string | null {
  const quote = brut.match(/Somme des quote_part actives du lot \S+ = (-?[\d.]+)/);
  if (quote) {
    return `La somme des quotes-parts des propriétaires actifs de ce lot serait de ${quote[1]} % — elle doit être exactement de 100 %. Ajustez les quotes-parts.`;
  }
  if (/Somme des quote_part/.test(brut)) {
    return "La somme des quotes-parts des propriétaires actifs de ce lot doit être exactement de 100 %. Ajustez les quotes-parts.";
  }
  const tantiemes = brut.match(
    /Somme des tantièmes de la copropriété \S+ \((-?[\d.]+)\) dépasse le total défini au règlement \((-?[\d.]+)\)/
  );
  if (tantiemes) {
    return `La somme des tantièmes (${tantiemes[1]}) dépasserait le total défini au règlement (${tantiemes[2]}). Corrigez les tantièmes du lot ou le total du règlement.`;
  }
  if (/Somme des tantièmes/.test(brut)) {
    return "La somme des tantièmes dépasserait le total défini au règlement. Corrigez les tantièmes du lot ou le total du règlement.";
  }
  return null;
}
