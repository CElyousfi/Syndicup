/**
 * Machine à états du compte utilisateur — Master Spec Partie 5.2. Source unique des transitions
 * autorisées : toute modification de `utilisateur.statut_compte` passe par `assertTransition`
 * (jamais un UPDATE direct sans vérification — CLAUDE.md §1.5, pas de défaut silencieux).
 *
 *   INVITE ──accept──▶ EN_VALIDATION ──vérif OTP/email──▶ ACTIF
 *   ACTIF ⇄ SUSPENDU (décision syndic) ; ACTIF/SUSPENDU → DESACTIVE (départ, vente, fin mandat)
 *   DESACTIVE → ACTIF (réactivation) ; DESACTIVE → ANONYMISE (job CNDP, M13 — durée légale + 2 ans)
 */

export type StatutCompte =
  | "INVITE"
  | "EN_VALIDATION"
  | "ACTIF"
  | "SUSPENDU"
  | "DESACTIVE"
  | "ANONYMISE";

const TRANSITIONS: Record<StatutCompte, readonly StatutCompte[]> = {
  INVITE: ["EN_VALIDATION", "ACTIF"], // accept ; ACTIF direct si l'identité est déjà vérifiée (OTP avant accept)
  EN_VALIDATION: ["ACTIF"],
  ACTIF: ["SUSPENDU", "DESACTIVE"],
  SUSPENDU: ["ACTIF", "DESACTIVE"], // réactivation syndic / départ
  DESACTIVE: ["ACTIF", "ANONYMISE"], // réactivation / job CNDP (Partie 5.6)
  ANONYMISE: [], // terminal — PII supprimées, jamais de retour
};

export function canTransition(from: StatutCompte, to: StatutCompte): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: StatutCompte, to: StatutCompte): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Transition de compte interdite : ${from} → ${to} (Master Spec Partie 5.2).`
    );
  }
}
