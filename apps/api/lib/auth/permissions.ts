/**
 * Matrice de permissions unique — consommée par le middleware (Master Spec Partie 4.2).
 *
 * IMPORTANT : cette matrice ne reprend aujourd'hui que l'extrait donné en Partie 4.2 du Master
 * Spec, PAS l'intégralité des actions de Doc A. Le Master Spec lui-même dit explicitement
 * (Partie 4.2) qu'elle "doit être répliquée intégralement (toutes les actions du Doc A)" ici.
 * Complète-la module par module au fil du ROADMAP_BACKLOG, en relisant le fichier de domaine
 * correspondant dans docs/domain-reference/ à chaque fois — ne jamais dupliquer une règle de
 * permission en dur dans une route individuelle (CLAUDE.md §1.7 point 4 / Partie 4.2).
 *
 * Toute nouvelle entrée doit citer sa source (numéro de partie Master Spec ou section Doc A)
 * en commentaire, exactement comme les entrées de départ ci-dessous.
 */

export type Role =
  | "SUPER_ADMIN"
  | "SYNDIC"
  | "CONSEIL_SYNDICAL"
  | "PROPRIETAIRE"
  | "LOCATAIRE"
  | "INDIVISAIRE"
  | "GARDIEN"
  | "PRESTATAIRE"
  | "PERSONNE_MORALE_REPRESENTANT";

/**
 * Une action peut être :
 *  - `true`  : autorisée sans restriction
 *  - `false` : interdite
 *  - `"scoped"` : autorisée mais uniquement sur les ressources de l'appelant (son lot, son
 *                 ticket, sa copropriété) — le filtrage réel se fait par le middleware tenant/RLS,
 *                 cette valeur documente juste l'intention pour que le endpoint applique bien
 *                 le bon filtre WHERE en plus de la policy RLS (défense en profondeur, Partie 1.6).
 */
export type PermissionValue = true | false | "scoped";

export type PermissionMatrix = Record<string, Partial<Record<Role, PermissionValue>>>;

/**
 * Clé = "module.action", alignée sur les tags/paths de packages/api-contract/openapi.yaml pour
 * qu'on puisse relier une entrée de matrice à un endpoint sans ambiguïté.
 */
export const PERMISSIONS: PermissionMatrix = {
  // ── Finances (Master Spec Partie 4.2) ────────────────────────────────────
  "finances.voir_agrege_copropriete": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    PROPRIETAIRE: "scoped", // "taux global uniquement" — pas le détail nominatif
  },
  "finances.voir_impaye_autre_lot": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    PROPRIETAIRE: false,
    LOCATAIRE: false,
    GARDIEN: false,
    PRESTATAIRE: false,
  },
  "finances.creer_appel_de_fonds": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },

  // ── Assemblées Générales (Master Spec Partie 4.2) ────────────────────────
  // ⚠️ "ag.creer" ci-dessous suit le Master Spec tel quel (syndic uniquement). À réviser si
  // docs/LEGAL_QUESTIONS_BRIEF.md §0 confirme que la Loi 30-24 permet aux copropriétaires de
  // convoquer eux-mêmes une AG — ne pas modifier cette ligne sans cette confirmation tracée.
  "ag.creer": {
    SUPER_ADMIN: false,
    SYNDIC: true,
  },
  "ag.voter": {
    PROPRIETAIRE: true,
    INDIVISAIRE: "scoped", // selon tantièmes, et blocage si indivisaire n'a pas payé (Doc A §2.4)
    SYNDIC: false, // le syndic facilite, ne vote pas
    LOCATAIRE: false, // sauf procuration explicite du propriétaire
  },
  "ag.voir_detail_nominatif_votes": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false, // résultat agrégé uniquement
    PROPRIETAIRE: false, // résultat agrégé uniquement
  },

  // ── Incidents (Master Spec Partie 4.2) ───────────────────────────────────
  "incidents.creer": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    PROPRIETAIRE: true,
    LOCATAIRE: true,
    GARDIEN: true,
    PRESTATAIRE: false, // reçoit l'assignation, ne crée pas
  },
  "incidents.voir_tous_copropriete": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    PROPRIETAIRE: "scoped", // les siens
    LOCATAIRE: "scoped", // les siens
    GARDIEN: true,
    PRESTATAIRE: "scoped", // les siens assignés
  },

  // ── Personnel (Master Spec Partie 4.2) ───────────────────────────────────
  "personnel.gerer": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },
  "personnel.autoriser_visiteur": {
    PROPRIETAIRE: "scoped", // son lot
    LOCATAIRE: "scoped", // son lot
    GARDIEN: "scoped", // relai
    SYNDIC: false,
  },

  // ── Utilisateurs (Master Spec Partie 4.2) ────────────────────────────────
  "utilisateurs.voir_noms_complets": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: "scoped", // "selon config" — dépend de copropriete.config_json
    PROPRIETAIRE: false, // sauf config activée
    LOCATAIRE: false,
  },

  // ── Onboarding / Invitations (Master Spec Partie 5.3 — M2) ──────────────
  // L'invitation porte lot_id + role cible fixés par l'émetteur ; jamais de sélection de rôle
  // libre par l'invité (anti auto-élévation de privilège). Émission réservée au syndic
  // (Partie 5.3 : "Syndic crée l'invitation liée à un lot/rôle", tableau 5.2 état INVITE).
  "onboarding.inviter": {
    SUPER_ADMIN: true, // création de la 1re invitation syndic d'une copropriété
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
    LOCATAIRE: false,
    GARDIEN: false,
    PRESTATAIRE: false,
  },
  "onboarding.lister_invitations": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
    LOCATAIRE: false,
    GARDIEN: false,
    PRESTATAIRE: false,
  },

  // ────────────────────────────────────────────────────────────────────────
  // TODO (voir ROADMAP_BACKLOG.md) — modules pas encore repris de Doc A dans cette matrice :
  //   - Lots : création, modification, transfert de propriété (Doc A §1, §2.5, §5.4)
  //   - Espaces communs : réservation, gestion config (Doc A §7)
  //   - Documents : lecture par visibilite (public_copropriete / syndic_only / conseil_syndical)
  //   - Litiges : création, escalade, et l'éventuelle étape de conciliation (Doc A §12.1, voir
  //     LEGAL_QUESTIONS_BRIEF.md §0)
  // Chacune de ces lignes doit être ajoutée en relisant le fichier docs/domain-reference/
  // correspondant, pas en devinant — Doc A a souvent des exceptions par type de résidence
  // (Partie 10) qui ne sont pas visibles depuis le seul Master Spec Partie 4.2.
};

/**
 * Vérifie une permission. Ne remplace PAS la policy RLS correspondante (Partie 1.6, défense en
 * profondeur) — cette fonction est la couche applicative, la policy RLS est la deuxième couche
 * indépendante et doit exister même si cette fonction a un bug.
 */
export function can(action: string, role: Role): PermissionValue {
  return PERMISSIONS[action]?.[role] ?? false;
}
