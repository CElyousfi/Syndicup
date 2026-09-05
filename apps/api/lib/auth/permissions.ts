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
  | "PERSONNE_MORALE_REPRESENTANT"
  // M15 — ⚠️ hors Master Spec Partie 4.2 (signalé) : gestionnaire de location courte durée,
  // scopé aux lots via lot_location_courte_duree.gestionnaire_id.
  | "GESTIONNAIRE_LCD";

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
  // ── Copropriétés (M12 — Master Spec Partie 3.2 : super_admin create, syndic manage own) ──
  "coproprietes.creer": {
    SUPER_ADMIN: true,
    SYNDIC: false,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },
  // Détail de SA copropriété : tout membre du tenant (les données sensibles — params légaux,
  // politique de recouvrement — ne sont pas nominatives ; la fiche copro est le contexte commun).
  "coproprietes.lire": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    PROPRIETAIRE: true,
    LOCATAIRE: true,
    INDIVISAIRE: true,
    PERSONNE_MORALE_REPRESENTANT: true,
    GARDIEN: true,
    PRESTATAIRE: false,
  },
  "coproprietes.modifier": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },
  "coproprietes.lire_config": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    PROPRIETAIRE: true,
    LOCATAIRE: true,
    INDIVISAIRE: true,
    PERSONNE_MORALE_REPRESENTANT: true,
    GARDIEN: true,
    PRESTATAIRE: false,
  },

  // ── Utilisateurs (M13 — Master Spec Partie 3.2 : /users/:id "syndic only") ──
  "users.lire_fiche": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
    LOCATAIRE: false,
    GARDIEN: false,
    PRESTATAIRE: false,
  },
  // Anonymisation CNDP manuelle (Partie 5.6) — à la demande explicite de la personne concernée.
  "users.anonymiser": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },

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
  // M12 — CRUD budgets AG (Master Spec Partie 2.2, Doc A §3.2 "Budget annuel voté en AG").
  // Écriture : syndic seul (le vote AG qui légitime le budget est tracé via ag_id).
  "finances.gerer_budget": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },
  // Lecture large : transparence budgétaire (Doc A §10.2 "Détail budget par poste visible
  // dans app") — le budget est un agrégat, pas une donnée nominative.
  "finances.lire_budget": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    PROPRIETAIRE: true,
    LOCATAIRE: true,
    INDIVISAIRE: true,
    PERSONNE_MORALE_REPRESENTANT: true,
    GARDIEN: false,
    PRESTATAIRE: false,
  },
  // M5 (Master Spec Partie 4.2/6, Doc A §3). Lecture large : la confidentialité fine par lot est
  // appliquée par la policy RLS "tenant_isolation" sur `appel_de_fonds_lot` (défense en
  // profondeur, Partie 1.6) — cette entrée ne fait que gater l'accès à l'endpoint lui-même.
  "finances.lister_appels_de_fonds": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    PROPRIETAIRE: true,
    LOCATAIRE: true,
    INDIVISAIRE: true,
    GARDIEN: false,
    PRESTATAIRE: false,
  },
  "finances.voir_solde_lot": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    PROPRIETAIRE: "scoped", // le sien uniquement — filtré par RLS
    LOCATAIRE: "scoped",
    INDIVISAIRE: "scoped",
    GARDIEN: false,
    PRESTATAIRE: false,
  },
  "finances.enregistrer_paiement_manuel": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },
  // Un résident initie le paiement CMI de SON lot ; le syndic peut aussi l'initier pour compte
  // (paiement guichet assisté) — filtrage fin par RLS sur appel_de_fonds_lot.
  "finances.paiement_cmi_initier": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: "scoped",
    LOCATAIRE: "scoped",
    INDIVISAIRE: "scoped",
  },
  "finances.voir_quittance": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    PROPRIETAIRE: "scoped",
    LOCATAIRE: "scoped",
    INDIVISAIRE: "scoped",
  },
  // Doc A §3.3 "Cas Particuliers" : "Droit de contester via lettre au syndic" — ouvert à tout
  // résident concerné par le lot (filtré par RLS), pas au syndic (qui répond, ne conteste pas).
  "finances.contester_charge": {
    SUPER_ADMIN: false,
    SYNDIC: false,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: "scoped",
    LOCATAIRE: "scoped",
    INDIVISAIRE: "scoped",
  },
  "finances.repondre_contestation": {
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
  // Lecture de l'AG/des résolutions/du PV — information copropriété-large, pas de confidentialité
  // fine (Doc A §12.3 : "Les PV sont accessibles à tous les copropriétaires").
  "ag.lire": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    PROPRIETAIRE: true,
    LOCATAIRE: true,
    INDIVISAIRE: true,
    GARDIEN: false,
    PRESTATAIRE: false,
  },
  "ag.convoquer": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },
  // Ajout nécessaire au-delà de la liste littérale d'endpoints Master Spec Partie 3.2 : aucune
  // transition explicite CONVOQUEE→EN_COURS n'y figure (le diagramme Partie 8.1 dit juste "jour
  // J"), mais Doc A §6.4 décrit "Ouverture" comme une action syndic explicite ("Bouton 'Ouvrir
  // l'AG'") — reprise ici comme telle plutôt que déclenchée implicitement au premier vote.
  "ag.ouvrir": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },
  "ag.gerer_resolutions": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },
  // Ajout nécessaire : Master Spec ne détaille pas d'endpoint de clôture PAR résolution, mais la
  // détermination ADOPTEE/REJETEE ne peut pas être automatique en continu (les votes arrivent un
  // par un, Partie 8.7) — le syndic déclare explicitement la fin du vote sur CETTE résolution
  // (cohérent avec Doc A §6.4 "Une fois le vote ouvert... Syndic peut reporter une résolution").
  "ag.finaliser_resolution": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },
  "ag.cloturer": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },
  // Ajout nécessaire : Doc A §12.2 "Annulation AG après envoi des convocations" décrit
  // explicitement ce workflow avec motif obligatoire — absent de la liste littérale d'endpoints.
  "ag.annuler": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },
  // Doc A §6.5 : le mandant peut lui-même donner/retirer sa procuration ; le syndic vérifie et
  // peut aussi enregistrer une procuration papier reçue physiquement pour le compte d'un mandant.
  "ag.gerer_procurations": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: "scoped", // uniquement en tant que mandant de sa propre procuration
    INDIVISAIRE: "scoped",
    LOCATAIRE: false,
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
  // Master Spec Partie 4.2 : "syndic/prestataire (update scopé)". Le gardien est ajouté ici en
  // plus du tableau littéral parce que Doc A §5.3 (workflows spéciaux) le montre systématiquement
  // en train de faire progresser le statut d'un ticket (ex. "Mise à jour statut toutes les 15
  // min") — écart signalé, pas un oubli silencieux du tableau Master Spec.
  "incidents.changer_statut": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    GARDIEN: true,
    PRESTATAIRE: "scoped", // uniquement son propre ticket assigné — vérifié en plus de la RLS
    PROPRIETAIRE: false,
    LOCATAIRE: false,
  },
  // Assignation à un prestataire = décision de gestion, réservée au syndic (Master Spec Partie
  // 4.2, ligne "Incidents" : seul "tous" créent, l'assignation n'est listée à personne d'autre).
  "incidents.assigner": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    GARDIEN: false,
    PROPRIETAIRE: false,
  },
  // Annuaire prestataires — pas d'endpoint dédié dans le tableau Master Spec littéral, ajouté par
  // nécessité (POST /incidents/:id/assign a besoin d'un référentiel prestataire_id à choisir) ;
  // écriture réservée au syndic, lecture ouverte à ceux qui peuvent avoir besoin de contacter un
  // prestataire (syndic, conseil syndical, gardien — Doc A §5.3).
  "prestataires.gerer": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },
  "prestataires.lire": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    GARDIEN: true,
    PROPRIETAIRE: false,
    LOCATAIRE: false,
    PRESTATAIRE: false,
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
  // Ajout M10 : lecture du registre personnel — la fiche gardien (présence, logement) est une
  // information de fonctionnement de la résidence visible des résidents (Doc A §9 "fiche
  // d'urgence"), pas une donnée confidentielle.
  "personnel.lire": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    PROPRIETAIRE: true,
    LOCATAIRE: true,
    INDIVISAIRE: true,
    GARDIEN: true,
    PRESTATAIRE: false,
  },
  // Doc A §9.2 "Module visites : Gardien enregistre" — le syndic peut aussi enregistrer en
  // backup (il supervise le personnel), jamais les résidents (ils autorisent/refusent, cf.
  // "personnel.autoriser_visiteur" ci-dessus).
  "visites.creer": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    GARDIEN: true,
    PROPRIETAIRE: false,
    LOCATAIRE: false,
    PRESTATAIRE: false,
  },
  // Confidentialité Doc A §12.3 : un résident ne voit que les visites de ses lots, le gardien
  // celles qu'il a enregistrées — filtrage fin par la policy RLS sur `visite` + WHERE applicatif.
  "visites.lire": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    PROPRIETAIRE: "scoped",
    LOCATAIRE: "scoped",
    INDIVISAIRE: "scoped",
    GARDIEN: "scoped",
    PRESTATAIRE: false,
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

  // ── Lots / Propriété / Occupation (Doc A §1, §2 — M3) ───────────────────
  // Écriture réservée au syndic : la lecture est ouverte à tous les rôles du tenant, la
  // restriction fine (un résident ne voit que son propre lot) est appliquée par la policy RLS
  // "tenant_isolation" sur `lot` (défense en profondeur, Partie 1.6) — cette entrée ne fait que
  // gater l'accès à l'endpoint lui-même.
  "lots.creer": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },
  "lots.modifier": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },
  "lots.lire": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    PROPRIETAIRE: "scoped", // le sien uniquement — filtré par RLS
    LOCATAIRE: "scoped",
    INDIVISAIRE: "scoped",
    GARDIEN: true,
    PRESTATAIRE: "scoped",
  },
  // Ajout/retrait d'un copropriétaire = mise à jour du registre légal du lot — réservé au
  // syndic (Doc A §2.4/§2.5, pas de self-service résident en M3).
  "lots.gerer_proprietaires": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },
  "lots.gerer_occupants": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },
  // Master Spec Partie 5.4 : "Syndic (ou notification notaire externe, hors scope MVP) initie
  // POST /lots/:id/transfert-propriete" — syndic uniquement pour le MVP.
  "lots.transferer_propriete": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },

  // ── Espaces communs (Master Spec Partie 4.2, Doc A §7) ──────────────────
  "espaces_communs.lire": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    PROPRIETAIRE: true,
    LOCATAIRE: true,
    INDIVISAIRE: true,
    GARDIEN: true,
    PRESTATAIRE: false,
  },
  "espaces_communs.gerer_config": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },
  // Master Spec Partie 4.2 : "résident (create)". "scoped" = uniquement pour un lot dont
  // l'appelant est propriétaire/occupant actif — vérifié en service en plus de la RLS.
  "reservations.creer": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: "scoped",
    LOCATAIRE: "scoped",
    INDIVISAIRE: "scoped",
    GARDIEN: false,
    PRESTATAIRE: false,
  },
  // Doc A §7.2 : validation manuelle par le syndic (si l'espace n'est pas en validation auto),
  // rejet, et bascule HORS_SERVICE d'un espace (annule les réservations futures).
  "reservations.gerer": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },
  // Master Spec Partie 4.2 : "PATCH /reservations/:id" sans préciser l'acteur — Doc A ne
  // mentionne l'annulation que par son auteur ou le syndic (arbitrage).
  "reservations.annuler": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: "scoped", // sa propre réservation
    LOCATAIRE: "scoped",
    INDIVISAIRE: "scoped",
  },

  // ── Notifications & Documents (Master Spec Partie 7, 9) ─────────────────
  // Lecture ouverte à tout rôle : la confidentialité par visibilite (public_copropriete /
  // syndic_only / conseil_syndical) est appliquée par la policy RLS "tenant_isolation" sur
  // `document` (défense en profondeur, Partie 1.6) — cette entrée ne fait que gater l'accès à
  // l'endpoint lui-même.
  "documents.lire": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    PROPRIETAIRE: true,
    LOCATAIRE: true,
    INDIVISAIRE: true,
    GARDIEN: true,
    PRESTATAIRE: false,
  },
  // Upload d'un document "libre" (règlement intérieur, contrat prestataire...) — réservé au
  // syndic ; les documents générés automatiquement (PV, quittance) sont créés par le job système
  // correspondant, pas via cet endpoint.
  "documents.creer": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },
  // Boîte de réception personnelle (Partie 7.2) — chacun ne lit/marque que les siennes, la
  // policy RLS "tenant_isolation" sur `notification` filtre déjà sur utilisateur_id, aucune
  // exception syndic/conseil ici contrairement aux autres tables.
  "notifications.lire": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    PROPRIETAIRE: true,
    LOCATAIRE: true,
    INDIVISAIRE: true,
    GARDIEN: true,
    PRESTATAIRE: true,
  },

  // ── Litiges (Master Spec Partie 2.2, Doc A §12.1 — M11) ─────────────────
  // Doc A §12.1 : "résident soumet contestation avec motif" — tout résident peut déclarer, le
  // syndic aussi (il constate lui-même certains conflits, ex. occupation partie commune).
  "litiges.creer": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    PROPRIETAIRE: true,
    LOCATAIRE: true,
    INDIVISAIRE: true,
    GARDIEN: false,
    PRESTATAIRE: false,
  },
  // Confidentialité (Doc A §12.3) : un résident ne voit que SES litiges — filtré par la policy
  // RLS sur `conflit_litige` (cree_par) + WHERE applicatif (défense en profondeur).
  "litiges.lire": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    PROPRIETAIRE: "scoped",
    LOCATAIRE: "scoped",
    INDIVISAIRE: "scoped",
    GARDIEN: false,
    PRESTATAIRE: false,
  },
  // Escalade (traitement syndic → médiation AG → tribunal) = décision de gestion — Master Spec
  // Partie 3.2 : "Rôle autorisé — syndic, conseil_syndical".
  "litiges.escalader": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: true,
    PROPRIETAIRE: false,
    LOCATAIRE: false,
  },
  // Clôture (RESOLU/CLOS) — ajout nécessaire au-delà de la liste littérale d'endpoints : Doc A
  // §12.1 colonne "Issue possible" ("Explication syndic suffit souvent") implique une sortie de
  // workflow explicite, réservée au syndic.
  "litiges.resoudre": {
    SUPER_ADMIN: true,
    SYNDIC: true,
    CONSEIL_SYNDICAL: false,
    PROPRIETAIRE: false,
  },
};

/**
 * Vérifie une permission. Ne remplace PAS la policy RLS correspondante (Partie 1.6, défense en
 * profondeur) — cette fonction est la couche applicative, la policy RLS est la deuxième couche
 * indépendante et doit exister même si cette fonction a un bug.
 */
export function can(action: string, role: Role): PermissionValue {
  return PERMISSIONS[action]?.[role] ?? false;
}
