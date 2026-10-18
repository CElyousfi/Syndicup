/**
 * Vocabulaire des moments difficiles — FR (langue de référence). Module autonome, importé par
 * le dictionnaire complet (`fr.errors`) ET directement par les rares composants clients qui en
 * ont besoin (frontières d'erreur, visionneuse) : jamais le dictionnaire entier côté client.
 *
 * Ton : calme, concret, toujours une prochaine étape. Jamais de jargon ni de référence interne.
 */
export const errorActionsFr = {
  retry: "Réessayer",
  relogin: "Se reconnecter",
  refresh: "Actualiser",
  contact: "Contactez votre syndic si le problème persiste.",
  backHome: "Retour à l'accueil",
  login: "Se connecter",
};

export const boundaryFr = {
  title: "Cette page n'a pas pu s'afficher",
  body: "Le problème vient de chez nous, pas de chez vous. Vos données sont en sécurité : réessayez dans un instant.",
  notFoundTitle: "Page introuvable",
  notFoundBody: "Cette page n'existe pas ou a été déplacée.",
};

export const viewerFr = {
  unavailable: "Document indisponible",
  unavailableBody: "Nous n'avons pas pu ouvrir ce document pour l'instant.",
  unknownType: "Aperçu non disponible pour ce type de fichier : téléchargez-le pour l'ouvrir.",
};

export const staleFr = {
  lost: "Connexion perdue",
  lastUpdate: "dernière mise à jour il y a {temps}",
  never: "en attente de la première mise à jour",
};

/** Référence courte (8 caractères) à communiquer au support — copiable. */
export const referenceFr = {
  reference: "Réf. {ref}",
  referenceCopy: "Copier la référence",
  referenceCopied: "Référence copiée",
};

export const errorsFr = {
  /** Libellés des actions proposées après un échec. */
  actions: errorActionsFr,
  ...referenceFr,
  retryIn: "Réessayez dans {temps}.",
  seconds: "{n} s",
  minutes: "{n} min",

  /** Codes génériques de l'API (enveloppe { error: { code } }) + NETWORK (API injoignable). */
  codes: {
    VALIDATION_ERROR: { title: "Certaines informations sont à corriger", body: "Vérifiez les champs signalés puis réessayez." },
    UNAUTHENTICATED: { title: "Votre session a expiré", body: "Par sécurité, reconnectez-vous : vous reviendrez ensuite sur cette page." },
    FORBIDDEN: { title: "Action non autorisée", body: "Votre rôle ne permet pas cette action dans cette copropriété." },
    NOT_FOUND: { title: "Élément introuvable", body: "Il a peut-être été supprimé ou déplacé. Actualisez la page pour voir l'état actuel." },
    CONFLICT: { title: "Déjà fait ou modifié entre-temps", body: "Quelqu'un a peut-être fait la même action. Actualisez pour voir l'état actuel." },
    UNPROCESSABLE_ENTITY: { title: "Action impossible pour le moment", body: "Une règle de la copropriété empêche cette action. Vérifiez les informations ou contactez votre syndic." },
    RATE_LIMITED: { title: "Trop de tentatives", body: "Patientez un instant avant de réessayer." },
    INTERNAL_ERROR: { title: "Une erreur est survenue", body: "Le problème vient de chez nous, pas de chez vous. Réessayez dans un instant." },
    NOT_IMPLEMENTED: { title: "Pas encore disponible", body: "Cette fonctionnalité n'est pas encore activée pour votre copropriété." },
    SERVICE_UNAVAILABLE: { title: "Service momentanément indisponible", body: "Le service est très sollicité. Réessayez dans quelques instants." },
    NETWORK: { title: "Connexion impossible", body: "Nous n'arrivons pas à joindre SyndicUp. Vérifiez votre connexion internet puis réessayez." },
    UNEXPECTED: { title: "Réponse inattendue", body: "Le serveur a répondu de façon inattendue. Réessayez dans un instant." },

    // M15 — location courte durée
    LCD_REGIME_NON_DEFINI: { title: "Régime non défini", body: "Le régime de location courte durée n'est pas encore fixé par le syndic (décision d'assemblée générale)." },
    LCD_INTERDITE: { title: "Location courte durée interdite", body: "Le règlement de copropriété interdit la location courte durée." },
    LCD_PARAMETRE_NON_CONFIGURE: { title: "Règlement à compléter", body: "Le syndic doit d'abord renseigner les paramètres du règlement de location courte durée." },
    LCD_GESTIONNAIRE_REQUIS: { title: "Gestionnaire requis", body: "Le règlement exige un gestionnaire sur place lorsque le propriétaire n'occupe pas le lot." },
    LCD_DECLARATION_NON_VALIDEE: { title: "Déclaration non validée", body: "Ce lot n'a pas encore de déclaration de location courte durée validée." },
    LCD_QUOTA_NUITS_DEPASSE: { title: "Quota de nuits dépassé", body: "Le nombre maximal de nuits par an fixé par le règlement est atteint." },
    LCD_DELAI_DECLARATION: { title: "Déclaration trop tardive", body: "Le règlement impose de déclarer le séjour plus tôt avant l'arrivée." },
    LCD_VOYAGEURS_MAX: { title: "Trop de voyageurs", body: "Le règlement limite le nombre de voyageurs par lot." },
    LCD_SEJOUR_CHEVAUCHEMENT: { title: "Dates déjà prises", body: "Un autre séjour est déjà déclaré sur ce lot pour ces dates." },

    // M16 — dépenses & budgets
    DEPENSE_STATUT_INVALIDE: { title: "La dépense a changé d'état", body: "Cette action n'est plus possible dans l'état actuel de la dépense. Actualisez la page." },
    DEPENSE_APPROBATION_CONSEIL_REQUISE: { title: "Approbation du conseil requise", body: "Cette dépense dépasse le seuil d'approbation : la décision appartient au conseil syndical." },
    DEPENSE_RESERVE_RESOLUTION_REQUISE: { title: "Résolution d'AG requise", body: "Un décaissement du fonds de réserve doit être lié à une résolution d'AG adoptée." },
    FONDS_RESERVE_INSUFFISANT: { title: "Fonds de réserve insuffisant", body: "Le solde du fonds de réserve ne couvre pas ce montant." },
    BUDGET_TOTAL_DERIVE_DES_POSTES: { title: "Total calculé automatiquement", body: "Le total du budget est la somme de ses postes : modifiez les postes plutôt que le total." },
    BUDGET_POSTE_UTILISE: { title: "Poste utilisé", body: "Des dépenses référencent ce poste : rattachez-les à un autre poste avant de le supprimer." },
    INCIDENT_NON_RESOLU: { title: "Incident pas encore résolu", body: "Le prestataire ne peut être évalué qu'une fois l'incident résolu." },
    INCIDENT_DEJA_EVALUE: { title: "Déjà évalué", body: "Ce prestataire a déjà été évalué pour cet incident." },

    // M17 — justificatifs
    JUSTIFICATIF_STATUT_INVALIDE: { title: "Le justificatif a changé d'état", body: "Il a peut-être déjà été traité. Actualisez la page pour voir son état actuel." },
    JUSTIFICATIF_PREUVE_REQUISE: { title: "Preuve de paiement requise", body: "Joignez la preuve du paiement (reçu de virement, photo du chèque ou du bordereau)." },
    JUSTIFICATIF_PARAMETRE_NON_CONFIGURE: { title: "Paramètre à configurer", body: "Le syndic doit d'abord configurer ce paramètre de la copropriété." },

    // M18 — rapports
    RAPPORT_STATUT_INVALIDE: { title: "Le rapport a changé d'état", body: "Cette action n'est plus possible dans l'état actuel du rapport. Actualisez la page." },
    RAPPORT_PARAMETRE_NON_CONFIGURE: { title: "Majorité à configurer", body: "La majorité requise pour l'approbation des comptes n'est pas encore configurée." },

    // M19 — contrats
    CONTRAT_STATUT_INVALIDE: { title: "Le contrat a changé d'état", body: "Cette action n'est plus possible dans l'état actuel du contrat. Actualisez la page." },
    CONTRAT_RESOLUTION_AG_REQUISE: { title: "Résolution d'AG requise", body: "Le montant dépasse le seuil fixé : liez une résolution d'AG adoptée avant d'activer le contrat." },
    CONTRAT_ECHEANCE_STATUT_INVALIDE: { title: "L'échéance a changé d'état", body: "Cette échéance a peut-être déjà été traitée. Actualisez la page." },

    // M20 — personnel
    PAIE_PARAMETRES_NON_CONFIGURES: { title: "Paramètres de paie à renseigner", body: "Renseignez les paramètres de paie (CNSS, AMO, IR, SMIG…) dans Paramètres avant de valider." },
    PAIE_STATUT_INVALIDE: { title: "La paie a changé d'état", body: "Cette action n'est plus possible dans l'état actuel de la paie. Actualisez la page." },
    CONGE_STATUT_INVALIDE: { title: "Le congé a changé d'état", body: "Cette demande a peut-être déjà été traitée. Actualisez la page." },
    CONGE_SOLDE_INSUFFISANT: { title: "Solde de congés insuffisant", body: "Le solde disponible ne couvre pas le nombre de jours demandés." },
    PERSONNEL_STATUT_INVALIDE: { title: "La fiche a changé d'état", body: "Cette action n'est plus possible dans l'état actuel de la fiche. Actualisez la page." },

    // M21 — communication
    ANNONCE_STATUT_INVALIDE: { title: "L'annonce a changé d'état", body: "Cette action n'est plus possible dans l'état actuel de l'annonce. Actualisez la page." },
    COMMENTAIRES_DESACTIVES: { title: "Commentaires désactivés", body: "Les commentaires sont désactivés sur cette annonce." },
    SONDAGE_STATUT_INVALIDE: { title: "Le sondage a changé d'état", body: "Ce sondage n'accepte peut-être plus de réponses. Actualisez la page." },
    SONDAGE_DEJA_REPONDU: { title: "Déjà répondu", body: "Vous avez déjà répondu à ce sondage." },
    SONDAGE_CHOIX_INVALIDE: { title: "Choix invalide", body: "Ce choix ne correspond pas aux options du sondage. Actualisez la page." },

    // M22 — tâches
    TACHE_STATUT_INVALIDE: { title: "La tâche a changé d'état", body: "Cette action n'est plus possible dans l'état actuel de la tâche. Actualisez la page." },
    TACHE_ASSIGNEE_INVALIDE: { title: "Personne non assignable", body: "La tâche ne peut être confiée qu'au syndic, à un membre du conseil ou au personnel." },

    // M23 — parkings
    EMPLACEMENT_STATUT_INVALIDE: { title: "L'emplacement a changé d'état", body: "Cette action n'est plus possible pour cet emplacement. Actualisez la page." },
    EMPLACEMENT_CODE_EXISTANT: { title: "Code déjà utilisé", body: "Un emplacement porte déjà ce code." },
    EMPLACEMENT_NON_VISITEUR: { title: "Place non visiteur", body: "Choisissez une place visiteur en service." },
    ATTRIBUTION_CHEVAUCHEMENT: { title: "Période déjà attribuée", body: "L'emplacement est déjà attribué sur cette période." },
    IMMATRICULATION_EXISTANTE: { title: "Plaque déjà déclarée", body: "Cette immatriculation est déjà déclarée." },
    IMMATRICULATION_INCONNUE: { title: "Aucune plaque", body: "Aucune plaque n'est signalée sur cet incident." },
    BADGE_STATUT_INVALIDE: { title: "Le badge a changé d'état", body: "Cette action n'est plus possible pour ce badge. Actualisez la page." },
    BADGE_IDENTIFIANT_EXISTANT: { title: "Badge déjà enregistré", body: "Un badge porte déjà cet identifiant." },

    // M24 — import
    IMPORT_FICHIER_ILLISIBLE: { title: "Fichier illisible", body: "Le fichier n'a pas pu être lu. Vérifiez qu'il s'agit bien d'un fichier xlsx ou csv issu du modèle." },
    IMPORT_STATUT_INVALIDE: { title: "L'import a changé d'état", body: "Cet import a peut-être déjà été traité. Actualisez la page." },
    DEMO_INTERDIT: { title: "Indisponible en démonstration", body: "Cette action est désactivée sur la copropriété de démonstration." },

    // M25 — cabinet
    CABINET_STATUT_INVALIDE: { title: "Le cabinet a changé d'état", body: "Cette action n'est plus possible pour ce cabinet. Actualisez la page." },
    MANDAT_EXISTANT: { title: "Mandat déjà en place", body: "Un mandat actif ou en attente existe déjà sur cette copropriété." },
    MANDAT_STATUT_INVALIDE: { title: "Le mandat a changé d'état", body: "Cette action n'est plus possible pour ce mandat. Actualisez la page." },
    CONFLIT_SYNDIC: { title: "Syndic déjà en place", body: "Un syndic actif existe déjà pour cette copropriété." },
  },

  /** Erreurs détectées dans l'application, avant même d'appeler l'API. */
  local: {
    fichierTropLourd: "Fichier trop lourd ({max} Mo maximum).",
    fichierTropLourdCourt: "{max} Mo maximum.",
    imageTropLourde: "Image trop lourde ({max} Mo maximum).",
    fichierManquant: "Choisissez un fichier.",
    imageManquante: "Choisissez une image.",
    aucunFichier: "Aucun fichier sélectionné.",
    fichierImportRequis: "Choisissez un fichier xlsx ou csv.",
    factureObligatoire: "Le fichier de la facture est obligatoire.",
    emplacementInconnu: "Emplacement d'image inconnu. Actualisez la page.",
    emailInvalide: "Cette adresse e-mail ne semble pas valide.",
    televersementRefuse: "Le fichier n'a pas pu être envoyé. Réessayez dans un instant.",
    televersementRefuseTitre: "Envoi du fichier impossible",
  },

  /** Chargement d'une liste ou d'une section qui a échoué (jamais un faux « rien ici »). */
  load: {
    title: "Impossible de charger ces informations pour l'instant",
    body: "Ce n'est pas que la liste est vide : nous n'avons pas pu la récupérer. Réessayez dans un instant.",
    section: "Impossible de charger cette section pour l'instant.",
    solde: "Solde indisponible",
    soldeAide: "Nous n'avons pas pu calculer votre solde. Il n'est pas forcément à jour : réessayez.",
  },

  /** Données en direct qui ne se mettent plus à jour. */
  stale: staleFr,

  /** Écran « Pas d'accès » (403) et abonnement suspendu (402). */
  forbidden: {
    title: "Pas d'accès à cette page",
    body: "Votre rôle dans cette copropriété ne permet pas d'ouvrir cette page. Si vous pensez que c'est une erreur, contactez votre syndic.",
    toast: "Vous n'avez pas accès à cette page.",
    abonnementTitre: "Abonnement suspendu",
    abonnementCorps: "L'abonnement de votre copropriété est suspendu : certaines pages sont temporairement indisponibles. Contactez votre syndic pour le réactiver.",
  },

  /** Frontières d'erreur (page qui plante). */
  boundary: boundaryFr,

  /** Visionneuse de documents. */
  viewer: viewerFr,
};

export type ErrorsDict = typeof errorsFr;
