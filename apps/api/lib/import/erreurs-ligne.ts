/**
 * Rapport de ligne d'import (M24) pour une erreur de base — contrainte d'unicité, clé étrangère,
 * trigger : phrase française qui nomme le champ du fichier quand Prisma l'indique, jamais
 * « P2002 », « violates … » ni un UUID. Le numéro de ligne voyage à part (`n`).
 */
import { champsPrisma, codePrisma, messageTriggerContrainte } from "../http/prisma-errors";
import { CHAMPS } from "./parse";
import type { TypeImport } from "./schemas";

export function messageErreurLigne(e: unknown, type: TypeImport): string {
  const trigger = messageTriggerContrainte(e instanceof Error ? e.message : String(e));
  if (trigger) return trigger;
  const libelles = new Map(CHAMPS[type].map((c) => [c.cle, c.libelle.FR]));
  const champs = champsPrisma(e)
    .filter((c) => c !== "copropriete_id" && c !== "coproprieteId")
    .map((c) => libelles.get(c) ?? libelles.get(c.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)))
    .filter((c): c is string => Boolean(c));
  const sur = champs.length ? ` (${champs.join(", ")})` : "";
  switch (codePrisma(e)) {
    case "P2002":
      return `Valeur déjà présente dans la copropriété${sur} : corrigez le doublon ou supprimez la ligne.`;
    case "P2003":
      return "Cette ligne fait référence à un élément introuvable : importez-le d'abord, puis relancez.";
    case "P2000":
      return `Valeur trop longue${sur} : raccourcissez-la.`;
    case "P2011":
      return `Champ obligatoire manquant${sur}.`;
    default:
      return "Ligne refusée par une règle de cohérence des données : vérifiez ses valeurs.";
  }
}
