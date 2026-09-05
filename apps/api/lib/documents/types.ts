/**
 * Types SYSTÈME de `document.type` — M16. La colonne reste un TEXT libre (les documents téléversés
 * par le syndic portent un type saisi librement dans l'UI existante — Doc A §12.3) ; les
 * documents créés PAR les modules (facture, preuve de paiement, devis…) utilisent ces constantes
 * fermées, jamais une chaîne ad hoc. ⚠️ Écart signalé (ROADMAP M16) : pas de conversion en enum
 * Postgres pour ne pas casser les données existantes — à trancher produit.
 */
export const TYPES_DOCUMENT_SYSTEME = [
  "FACTURE",
  "JUSTIFICATIF_DEPENSE",
  "DEVIS",
  // Réservés aux modules suivants (M17→M25) — déclarés ici pour que la liste reste unique.
  "JUSTIFICATIF_PAIEMENT",
  "RAPPORT_GESTION",
  "CONTRAT",
  "ATTESTATION_ASSURANCE",
  "CONTRAT_TRAVAIL",
  "FICHE_PAIE",
  "ANNONCE_PJ",
  "TACHE_PJ",
  "IMPORT_SOURCE",
] as const;
export type TypeDocumentSysteme = (typeof TYPES_DOCUMENT_SYSTEME)[number];
