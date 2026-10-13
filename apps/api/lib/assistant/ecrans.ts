/**
 * Dari — carte des écrans de l'application, PAR RÔLE.
 *
 * C'est la « connaissance de l'app » de l'assistant : chaque écran a une clé stable, son chemin
 * web et mobile (les deux routeurs diffèrent sur quelques finances), un libellé FR/AR et une
 * aide (comment s'en servir), et la liste des rôles qui y ont accès — la même matrice que la
 * navigation web (apps/web/components/shell/nav.ts) et le routeur mobile.
 *
 * L'assistant ne propose JAMAIS un écran hors de cette liste filtrée par le rôle du JWT : un lien
 * renvoyé par le modèle est revalidé ici avant de partir au client.
 */
import type { Role } from "../auth/permissions";

export type Langue = "fr" | "ar";

export interface Ecran {
  cle: string;
  /** Chemin web, sans préfixe de locale (« /finances/payer »). */
  web: string;
  /** Chemin mobile (go_router) ; null si l'écran n'existe que sur le web. */
  mobile: string | null;
  fr: string;
  ar: string;
  /** Ce qu'on y fait, et comment — lu par le modèle (FR, langue de référence du produit). */
  aide: string;
  roles: readonly Role[];
}

/** Lien d'écran tel qu'il part au client (OpenAPI : AssistantEcran). */
export interface EcranLien {
  cle: string;
  libelle: string;
  web: string;
  mobile: string | null;
}

const PROPRIO = ["PROPRIETAIRE", "INDIVISAIRE", "PERSONNE_MORALE_REPRESENTANT"] as const;
const GESTION = ["SYNDIC", "CONSEIL_SYNDICAL", "SYNDIC_COMPTABLE"] as const;
const COPRO = ["SYNDIC", "CONSEIL_SYNDICAL"] as const;
const TOUS_MEMBRES = [
  "SYNDIC",
  "CONSEIL_SYNDICAL",
  "SYNDIC_COMPTABLE",
  ...PROPRIO,
  "LOCATAIRE",
  "GARDIEN",
  "PRESTATAIRE",
  "GESTIONNAIRE_LCD",
] as const;

export const ECRANS: readonly Ecran[] = [
  {
    cle: "tableau_de_bord",
    web: "/tableau-de-bord",
    mobile: "/tableau-de-bord",
    fr: "Tableau de bord",
    ar: "لوحة القيادة",
    aide: "Vue d'ensemble selon le rôle : solde et prochaine échéance (résident), recouvrement, impayés et incidents (syndic), visiteurs du jour (gardien). Chaque carte s'ouvre sur le détail.",
    roles: TOUS_MEMBRES,
  },
  {
    cle: "payer",
    web: "/finances/payer",
    mobile: "/payer",
    fr: "Payer mes charges",
    ar: "أداء رسومي",
    aide: "Choisir l'appel de fonds à régler, puis payer ou déclarer un virement / un versement en espèces en joignant le justificatif (photo ou PDF du reçu). Le syndic valide le justificatif et la quittance arrive dans Documents.",
    roles: [...PROPRIO, "LOCATAIRE"],
  },
  {
    cle: "transparence",
    web: "/rapports/transparence",
    mobile: "/rapports/transparence",
    fr: "Où va mon argent",
    ar: "أين تذهب أموالي",
    aide: "Répartition des dépenses de la copropriété par poste, comparée au budget voté en AG.",
    roles: [...PROPRIO, "LOCATAIRE"],
  },
  {
    cle: "lots",
    web: "/lots",
    mobile: "/lots",
    fr: "Lots",
    ar: "الوحدات",
    aide: "Liste des lots (appartements, commerces, parkings) avec tantièmes, propriétaires et solde. Le résident y voit ses propres lots et leur historique de paiements.",
    roles: [...GESTION, ...PROPRIO, "LOCATAIRE", "GARDIEN"],
  },
  {
    cle: "releve",
    web: "/finances/comptabilite",
    mobile: "/finances/comptabilite",
    fr: "Comptabilité / relevé",
    ar: "المحاسبة / الكشف",
    aide: "Syndic et conseil : journal, trésorerie, exports. Propriétaire : son relevé de compte (appels, paiements, solde) téléchargeable en PDF.",
    roles: [...GESTION, ...PROPRIO],
  },
  {
    cle: "budgets",
    web: "/finances/budgets",
    mobile: "/finances/budgets",
    fr: "Budgets",
    ar: "الميزانيات",
    aide: "Budgets prévisionnels par exercice et par poste, proposés par le syndic et votés en assemblée générale.",
    roles: [...GESTION, ...PROPRIO],
  },
  {
    cle: "appels_de_fonds",
    web: "/finances/appels-de-fonds",
    mobile: "/finances/appels-de-fonds",
    fr: "Appels de fonds",
    ar: "نداءات الأموال",
    aide: "Chaque appel montre, lot par lot, ce qui est payé et ce qui reste dû. On y enregistre un paiement reçu et on relance les retardataires.",
    roles: GESTION,
  },
  {
    cle: "generer_appel",
    web: "/finances/appels-de-fonds?generer=1",
    mobile: "/finances/appels-de-fonds?generer=1",
    fr: "Générer un appel de fonds",
    ar: "إصدار نداء أموال",
    aide: "Calcule automatiquement la part de chaque lot au prorata des tantièmes à partir du budget voté, puis émet l'appel (notification aux propriétaires).",
    roles: ["SYNDIC", "SYNDIC_COMPTABLE"],
  },
  {
    cle: "justificatifs",
    web: "/finances/justificatifs",
    mobile: "/justificatifs",
    fr: "Justificatifs de paiement",
    ar: "وثائق إثبات الأداء",
    aide: "Les virements et versements déclarés par les résidents, avec leur preuve : valider (le paiement est imputé et la quittance générée) ou refuser avec un motif.",
    roles: GESTION,
  },
  {
    cle: "depenses",
    web: "/finances/depenses",
    mobile: "/depenses",
    fr: "Dépenses",
    ar: "المصاريف",
    aide: "L'argent qui sort : factures fournisseurs rattachées à un poste du budget, approbation du conseil syndical au-delà du seuil, paiement.",
    roles: GESTION,
  },
  {
    cle: "contestations",
    web: "/finances/contestations",
    mobile: "/finances/contestations",
    fr: "Contestations",
    ar: "الاعتراضات",
    aide: "Contestations de charges déposées par les copropriétaires, à instruire et à clore.",
    roles: GESTION,
  },
  {
    cle: "rapports",
    web: "/rapports",
    mobile: "/rapports",
    fr: "Rapports de gestion",
    ar: "تقارير التسيير",
    aide: "Rapports périodiques (recouvrement, dépenses vs budget, incidents) à générer en PDF et publier aux copropriétaires.",
    roles: GESTION,
  },
  {
    cle: "especes",
    web: "/finances/especes",
    mobile: "/especes",
    fr: "Encaisser des espèces",
    ar: "استلام نقدي",
    aide: "Le gardien saisit un versement en espèces remis par un résident ; le syndic le valide ensuite.",
    roles: ["GARDIEN"],
  },
  {
    cle: "affichage",
    web: "/affichage",
    mobile: "/affichage",
    fr: "Tableau d'affichage",
    ar: "لوحة الإعلانات",
    aide: "Annonces de la résidence (coupures d'eau, travaux, urgences), sondages et contacts utiles. Le syndic publie, les résidents lisent, réagissent et votent aux sondages.",
    roles: ["SYNDIC", "CONSEIL_SYNDICAL", ...PROPRIO, "LOCATAIRE", "GARDIEN", "GESTIONNAIRE_LCD"],
  },
  {
    cle: "taches",
    web: "/taches",
    mobile: "/taches",
    fr: "Tâches",
    ar: "المهام",
    aide: "Tâches récurrentes ou ponctuelles (ménage, contrôle ascenseur, relevés) assignées au personnel, avec échéance et statut.",
    roles: ["SYNDIC", "CONSEIL_SYNDICAL", "GARDIEN"],
  },
  {
    cle: "ag",
    web: "/ag",
    mobile: "/ag",
    fr: "Assemblées générales",
    ar: "الجموع العامة",
    aide: "Convocations, ordre du jour, procurations, vote en séance résolution par résolution (en direct), puis procès-verbal signé.",
    roles: ["SYNDIC", "CONSEIL_SYNDICAL", ...PROPRIO],
  },
  {
    cle: "creer_ag",
    web: "/ag/nouvelle",
    mobile: "/ag/nouvelle",
    fr: "Préparer une AG",
    ar: "تحضير جمع عام",
    aide: "Créer l'assemblée (date, lieu, type), rédiger les résolutions avec leur règle de majorité, puis envoyer les convocations.",
    roles: ["SYNDIC"],
  },
  {
    cle: "incidents",
    web: "/incidents",
    mobile: "/incidents",
    fr: "Incidents",
    ar: "الحوادث",
    aide: "Suivi des pannes et signalements : urgence, statut, échéance de traitement (SLA), prestataire assigné, photos et commentaires. Une fois résolu, le résident peut évaluer l'intervention.",
    roles: TOUS_MEMBRES,
  },
  {
    cle: "signaler_incident",
    web: "/incidents/nouveau",
    mobile: "/incidents/nouveau",
    fr: "Signaler un incident",
    ar: "الإبلاغ عن حادث",
    aide: "Choisir la catégorie (fuite, ascenseur, électricité…), décrire, ajouter une photo et la localisation ; le syndic est notifié immédiatement.",
    roles: ["SYNDIC", "CONSEIL_SYNDICAL", ...PROPRIO, "LOCATAIRE", "GARDIEN", "GESTIONNAIRE_LCD"],
  },
  {
    cle: "espaces",
    web: "/espaces-communs",
    mobile: "/espaces-communs",
    fr: "Espaces communs",
    ar: "الفضاءات المشتركة",
    aide: "Salle polyvalente, terrasse, piscine… : voir les créneaux libres et réserver ; certaines réservations doivent être validées par le syndic.",
    roles: ["SYNDIC", "CONSEIL_SYNDICAL", ...PROPRIO, "LOCATAIRE", "GARDIEN"],
  },
  {
    cle: "reservations",
    web: "/reservations",
    mobile: "/reservations",
    fr: "Réservations",
    ar: "الحجوزات",
    aide: "Mes réservations d'espaces communs (résident) ; demandes à valider ou refuser (syndic).",
    roles: ["SYNDIC", "CONSEIL_SYNDICAL", ...PROPRIO, "LOCATAIRE"],
  },
  {
    cle: "visites",
    web: "/visites",
    mobile: "/visites",
    fr: "Visiteurs",
    ar: "الزوار",
    aide: "Le gardien enregistre un visiteur à l'entrée ; le résident concerné est notifié et accepte ou refuse. Historique des visites.",
    roles: ["SYNDIC", "CONSEIL_SYNDICAL", ...PROPRIO, "LOCATAIRE", "GARDIEN"],
  },
  {
    cle: "enregistrer_visiteur",
    web: "/visites?enregistrer=1",
    mobile: "/visites?enregistrer=1",
    fr: "Enregistrer un visiteur",
    ar: "تسجيل زائر",
    aide: "Nom du visiteur, lot visité, motif : le résident reçoit une notification pour autoriser l'entrée. Fonctionne aussi hors connexion (envoi à la reconnexion).",
    roles: ["GARDIEN"],
  },
  {
    cle: "parkings",
    web: "/parkings",
    mobile: "/parkings",
    fr: "Parkings et badges",
    ar: "المواقف والشارات",
    aide: "Plan des emplacements, véhicules déclarés, badges d'accès et places visiteurs.",
    roles: ["SYNDIC", "CONSEIL_SYNDICAL", ...PROPRIO, "LOCATAIRE", "GARDIEN"],
  },
  {
    cle: "lcd",
    web: "/location-courte-duree",
    mobile: "/location-courte-duree",
    fr: "Location courte durée",
    ar: "الكراء القصير المدة",
    aide: "Règlement de la résidence sur la location type Airbnb, déclaration des lots concernés et des séjours (voyageurs, dates) ; le gardien voit les arrivées et départs du jour.",
    roles: ["SYNDIC", "CONSEIL_SYNDICAL", ...PROPRIO, "GARDIEN", "GESTIONNAIRE_LCD"],
  },
  {
    cle: "declarer_sejour",
    web: "/location-courte-duree/sejours/nouveau",
    mobile: "/location-courte-duree/sejours/nouveau",
    fr: "Déclarer un séjour",
    ar: "التصريح بإقامة",
    aide: "Lot, dates d'arrivée et de départ, nombre de voyageurs : le gardien est informé automatiquement.",
    roles: ["SYNDIC", ...PROPRIO, "GESTIONNAIRE_LCD"],
  },
  {
    cle: "litiges",
    web: "/litiges",
    mobile: "/litiges",
    fr: "Litiges",
    ar: "النزاعات",
    aide: "Différends entre voisins ou avec la copropriété (bruit, dégâts) : déclaration, échanges, médiation par le syndic.",
    roles: ["SYNDIC", "CONSEIL_SYNDICAL", ...PROPRIO, "LOCATAIRE"],
  },
  {
    cle: "personnel",
    web: "/personnel",
    mobile: "/personnel",
    fr: "Personnel",
    ar: "المستخدمون",
    aide: "Gardiens et employés de la résidence : contrats, planning, pointage, congés, fiches de paie.",
    roles: COPRO,
  },
  {
    cle: "mon_dossier",
    web: "/personnel/me",
    mobile: "/personnel/me",
    fr: "Mon dossier",
    ar: "ملفي",
    aide: "Le dossier de l'employé : fiches de paie, congés, pointage.",
    roles: ["GARDIEN"],
  },
  {
    cle: "prestataires",
    web: "/prestataires",
    mobile: "/prestataires",
    fr: "Prestataires",
    ar: "مقدمو الخدمات",
    aide: "Annuaire des prestataires (plombier, ascensoriste, sécurité…) à qui assigner les incidents.",
    roles: ["SYNDIC", "CONSEIL_SYNDICAL", "GARDIEN"],
  },
  {
    cle: "contrats",
    web: "/contrats",
    mobile: "/contrats",
    fr: "Contrats et assurances",
    ar: "العقود والتأمينات",
    aide: "Contrats de la copropriété (entretien, assurance, sécurité) avec leurs échéances et alertes de renouvellement.",
    roles: GESTION,
  },
  {
    cle: "documents",
    web: "/documents",
    mobile: "/documents",
    fr: "Documents",
    ar: "الوثائق",
    aide: "Règlement de copropriété, procès-verbaux, contrats, quittances et relevés, consultables directement dans l'application.",
    roles: ["SYNDIC", "CONSEIL_SYNDICAL", "SYNDIC_COMPTABLE", ...PROPRIO, "LOCATAIRE", "GARDIEN", "GESTIONNAIRE_LCD"],
  },
  {
    cle: "import",
    web: "/import",
    mobile: null,
    fr: "Importer (Excel)",
    ar: "استيراد (Excel)",
    aide: "Démarrage rapide : importer lots, propriétaires et soldes d'ouverture depuis un fichier Excel, avec contrôle avant validation. Sur ordinateur uniquement.",
    roles: ["SYNDIC", "SYNDIC_COMPTABLE"],
  },
  {
    cle: "membres",
    web: "/membres",
    mobile: "/membres",
    fr: "Membres",
    ar: "الأعضاء",
    aide: "Les comptes rattachés à la résidence et leurs rôles.",
    roles: ["SYNDIC"],
  },
  {
    cle: "inviter_resident",
    web: "/invitations?nouvelle=1",
    mobile: "/invitations?nouvelle=1",
    fr: "Inviter un résident",
    ar: "دعوة ساكن",
    aide: "Choisir le lot et le rôle, puis partager le code ou le QR d'invitation (SMS, WhatsApp, e-mail) ; le résident crée son compte avec.",
    roles: ["SYNDIC"],
  },
  {
    cle: "parametres",
    web: "/parametres",
    mobile: "/parametres",
    fr: "Paramètres de la résidence",
    ar: "إعدادات الإقامة",
    aide: "Identité de la copropriété (nom, logo, photo), coordonnées bancaires, seuils et délais, modules activés.",
    roles: ["SYNDIC"],
  },
  {
    cle: "notifications",
    web: "/notifications",
    mobile: "/notifications",
    fr: "Notifications",
    ar: "الإشعارات",
    aide: "Toutes les alertes reçues (appels, visiteurs, incidents, AG). Les canaux push se règlent dans le profil.",
    roles: TOUS_MEMBRES,
  },
  {
    cle: "profil",
    web: "/profil",
    mobile: "/profil",
    fr: "Mon profil",
    ar: "ملفي الشخصي",
    aide: "Nom, téléphone, langue (français / arabe), notifications, sécurité, et export ou suppression de mes données.",
    roles: TOUS_MEMBRES,
  },
  {
    cle: "admin",
    web: "/admin",
    mobile: "/admin",
    fr: "Copropriétés",
    ar: "الملكيات المشتركة",
    aide: "Console plateforme : liste des copropriétés et de leur syndic.",
    roles: ["SUPER_ADMIN"],
  },
  {
    cle: "admin_nouvelle",
    web: "/admin/coproprietes/nouvelle",
    mobile: "/admin/coproprietes/nouvelle",
    fr: "Créer une copropriété",
    ar: "إنشاء ملكية مشتركة",
    aide: "Créer la copropriété et inviter son premier syndic, qui configure ensuite tout le reste.",
    roles: ["SUPER_ADMIN"],
  },
];

const PAR_CLE = new Map(ECRANS.map((e) => [e.cle, e]));

/** Écrans accessibles à un rôle (ordre de la carte). */
export function ecransPour(role: Role): Ecran[] {
  return ECRANS.filter((e) => e.roles.includes(role));
}

/** Lien client d'un écran, seulement s'il est autorisé pour le rôle — sinon null. */
export function lienEcran(cle: string, role: Role, langue: Langue): EcranLien | null {
  const e = PAR_CLE.get(cle);
  if (!e || !e.roles.includes(role)) return null;
  return { cle: e.cle, libelle: langue === "ar" ? e.ar : e.fr, web: e.web, mobile: e.mobile };
}

/**
 * Écran correspondant au chemin courant du client (« /fr/finances/payer », « /payer »,
 * « /incidents/0198… ») : le plus long préfixe connu, toutes plateformes confondues.
 */
export function ecranDuChemin(chemin: string | undefined, role: Role): Ecran | null {
  if (!chemin) return null;
  const sansLocale = chemin.replace(/^\/(fr|ar)(?=\/|$)/, "") || "/";
  const nu = sansLocale.split("?")[0]!;
  let meilleur: Ecran | null = null;
  let longueur = 0;
  for (const e of ecransPour(role)) {
    for (const p of [e.web, e.mobile]) {
      if (!p || p.includes("?")) continue;
      if ((nu === p || nu.startsWith(`${p}/`)) && p.length > longueur) {
        meilleur = e;
        longueur = p.length;
      }
    }
  }
  return meilleur;
}
