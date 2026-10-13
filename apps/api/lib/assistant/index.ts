/**
 * Dari — l'assistant de SyndicUp dans l'application (web + mobile).
 *
 *  - `etatAssistant`  : ce qui mérite l'attention maintenant (insights déterministes) + questions
 *                       proposées. Aucun appel au modèle.
 *  - `repondre`       : réponse conversationnelle, ancrée sur les données de l'utilisateur
 *                       (instantané du widget, filtré par rôle + RLS) et sur la carte des écrans
 *                       de son rôle. Le modèle ne peut proposer que des écrans autorisés.
 *
 * Confidentialité : le contexte envoyé au modèle ne contient AUCUN identifiant, nom de personne,
 * téléphone ni e-mail — seulement des montants, dates, compteurs et titres d'annonces. Le
 * contenu des messages n'est jamais journalisé.
 */
import type { Role } from "../auth/permissions";
import type { TenantContext } from "../tenant/context";
import { logger } from "../logging/logger";
import { instantaneWidget } from "../users/widget";
import type { WidgetSnapshot } from "../users/widget-compose";
import { ecranDuChemin, ecransPour, lienEcran, type EcranLien, type Langue } from "./ecrans";
import { construireInsights, suggestionsPour, type Insight } from "./insights";
import { completerChat, type MessageLlm } from "./groq";
import { sortieModeleSchema, type AssistantMessagesInput } from "./schemas";

export { AssistantIndisponibleError, AssistantNonConfigureError } from "./groq";

export interface EtatAssistant {
  disponible: boolean;
  insights: Insight[];
  suggestions: string[];
}

export interface ReponseAssistant {
  reponse: string;
  ecrans: EcranLien[];
}

export const assistantConfigure = (env: Record<string, string | undefined> = process.env) => Boolean(env.GROQ_API_KEY);

export async function etatAssistant(ctx: TenantContext, langue: Langue): Promise<EtatAssistant> {
  const snapshot = await instantaneWidget(ctx);
  return {
    disponible: assistantConfigure(),
    insights: construireInsights(snapshot, langue),
    suggestions: suggestionsPour(ctx.role, langue),
  };
}

const ROLES_FR: Record<string, string> = {
  SUPER_ADMIN: "opérateur de la plateforme",
  SYNDIC: "syndic (gestionnaire de la résidence)",
  CONSEIL_SYNDICAL: "membre du conseil syndical (contrôle, lecture)",
  SYNDIC_COMPTABLE: "comptable du cabinet de syndic (finances en lecture)",
  PROPRIETAIRE: "copropriétaire",
  INDIVISAIRE: "copropriétaire en indivision",
  PERSONNE_MORALE_REPRESENTANT: "représentant d'une société copropriétaire",
  LOCATAIRE: "locataire",
  GARDIEN: "gardien / concierge de la résidence",
  PRESTATAIRE: "prestataire (intervient sur les incidents qui lui sont assignés)",
  GESTIONNAIRE_LCD: "gestionnaire de location courte durée d'un lot",
};

/** Données transmises au modèle : l'instantané SANS identifiants ni nom de résidence. */
export function donneesPourModele(s: WidgetSnapshot) {
  return {
    date_du_jour: s.genere_le.slice(0, 10),
    mes_charges: s.charges && {
      solde_du_mad: s.charges.solde_du,
      nb_lots: s.charges.nb_lots,
      prochaine_echeance: s.charges.prochaine_echeance,
      montant_prochaine_echeance_mad: s.charges.prochain_montant,
      part_payee_exercice: s.charges.taux_paye,
      nb_quittances: s.charges.nb_quittances,
    },
    assemblee_generale: s.ag && {
      date: s.ag.date_ag.slice(0, 10),
      statut: s.ag.statut,
      type: s.ag.type,
      nb_resolutions: s.ag.nb_resolutions,
      nb_resolutions_deja_votees_par_moi: s.ag.nb_votees,
    },
    residence: s.residence && {
      taux_recouvrement: s.residence.taux_recouvrement,
      impayes_total_mad: s.residence.impaye_total,
      incidents_ouverts: s.residence.incidents_ouverts,
      incidents_delai_depasse: s.residence.incidents_sla_depasse,
      reservations_a_valider: s.residence.reservations_a_valider,
      recouvrement_6_derniers_appels: s.residence.recouvrement_6,
    },
    annonces: s.affichage && {
      non_lues: s.affichage.non_lues,
      dernieres: s.affichage.annonces.map((a) => ({ titre: a.titre, categorie: a.categorie, urgent: a.urgent, lu: a.lu, date: a.publie_le?.slice(0, 10) ?? null })),
    },
    gardien_aujourdhui: s.gardien && {
      visiteurs_en_attente: s.gardien.visites_en_attente,
      arrivees_location_courte: s.gardien.arrivees_lcd_aujourdhui,
      departs_location_courte: s.gardien.departs_lcd_aujourdhui,
      incidents_ouverts: s.gardien.incidents_ouverts,
    },
  };
}

export function construirePrompt(role: Role, langue: Langue, snapshot: WidgetSnapshot, page?: string): string {
  const ecrans = ecransPour(role)
    .map((e) => `- ${e.cle} — « ${langue === "ar" ? e.ar : e.fr} » : ${e.aide}${e.mobile === null ? " (web uniquement)" : ""}`)
    .join("\n");
  const ici = ecranDuChemin(page, role);
  return [
    "Tu es Dari, l'assistant intégré à l'application SyndicUp (gestion de copropriété au Maroc). Ta mascotte est une petite maison avec un casque : chaleureux, précis, efficace.",
    `Tu parles à un utilisateur dont le rôle est : ${ROLES_FR[role] ?? role}.`,
    langue === "ar"
      ? "Réponds en arabe standard simple et clair (l'utilisateur a choisi l'arabe), même si la question est en français ou en darija. Garde les montants et dates en chiffres latins."
      : "Réponds en français, avec vouvoiement, sauf si l'utilisateur écrit en arabe ou en darija : réponds alors dans sa langue.",
    "",
    "RÈGLES",
    "1. Réponses courtes et utiles : 1 à 4 phrases, ou une liste d'étapes numérotées (5 étapes au plus) pour un « comment faire ». Pas de titre, pas de tableau, pas de formules creuses.",
    "2. Les chiffres viennent UNIQUEMENT des DONNÉES ci-dessous : recopie montants et dates exactement (montants en MAD). Si une information n'y figure pas (ex. le détail par lot ou par personne), dis-le simplement et indique l'écran où la trouver. N'invente jamais un chiffre, un nom, une date ou une fonctionnalité.",
    "3. Tu ne peux exécuter aucune action toi-même (payer, voter, valider…) : explique comment faire et propose l'écran correspondant.",
    "4. Tu ne connais que les écrans de la liste ÉCRANS : ne parle jamais d'un écran ou d'une fonction absente de cette liste pour ce rôle.",
    "5. Questions juridiques (majorités, délais légaux, loi 18-00) : réponds de façon générale et prudente, et recommande de confirmer avec le syndic ou un professionnel.",
    "6. Hors sujet (sans lien avec la résidence ou l'application) : réponds en une phrase aimable et ramène vers ce que tu sais faire.",
    "7. Ne demande jamais de mot de passe, code OTP ou coordonnées bancaires complètes.",
    "",
    'FORMAT : réponds UNIQUEMENT par un objet JSON {"reponse": "<texte>", "ecrans": ["<cle>", ...]} — "ecrans" contient 0 à 3 clés de la liste ÉCRANS, les plus utiles pour agir, dans l\'ordre de pertinence. Le texte peut contenir des retours à la ligne et du **gras** léger, rien d\'autre.',
    "",
    `ÉCRAN OUVERT : ${ici ? `${ici.cle} — « ${ici.fr} »` : "inconnu"}`,
    "",
    "ÉCRANS (clé — nom : usage)",
    ecrans,
    "",
    "DONNÉES DE L'UTILISATEUR (temps réel, déjà filtrées selon son rôle ; null = non applicable à ce rôle)",
    JSON.stringify(donneesPourModele(snapshot)),
  ].join("\n");
}

/** Lit la sortie du modèle : JSON attendu ; repli sur le texte brut si le modèle a dévié. */
export function lireSortie(contenu: string, role: Role, langue: Langue): ReponseAssistant {
  let brut: unknown = null;
  const debut = contenu.indexOf("{");
  const fin = contenu.lastIndexOf("}");
  if (debut !== -1 && fin > debut) {
    try {
      brut = JSON.parse(contenu.slice(debut, fin + 1));
    } catch (e) {
      logger.warn("assistant.sortie_non_json", { erreur: e instanceof Error ? e.name : "inconnue" });
    }
  }
  const parsed = sortieModeleSchema.safeParse(brut);
  if (!parsed.success) return { reponse: contenu.trim().slice(0, 4000), ecrans: [] };
  const vus = new Set<string>();
  const ecrans: EcranLien[] = [];
  for (const cle of parsed.data.ecrans) {
    if (vus.has(cle)) continue;
    vus.add(cle);
    const l = lienEcran(cle, role, langue); // revalidation par rôle : jamais un écran interdit
    if (l) ecrans.push(l);
    if (ecrans.length === 3) break;
  }
  return { reponse: parsed.data.reponse, ecrans };
}

export async function repondre(ctx: TenantContext, input: AssistantMessagesInput): Promise<ReponseAssistant> {
  const debut = Date.now();
  const snapshot = await instantaneWidget(ctx);
  const systeme = construirePrompt(ctx.role, input.langue, snapshot, input.page);
  const messages: MessageLlm[] = [
    { role: "system", content: systeme },
    // Historique court : les 8 derniers échanges suffisent et bornent le coût en jetons.
    ...input.messages.slice(-8).map((m) => ({ role: m.role, content: m.contenu })),
  ];
  const { contenu, modele } = await completerChat(messages);
  const sortie = lireSortie(contenu, ctx.role, input.langue);
  logger.info("assistant.reponse", { modele, duree_ms: Date.now() - debut, nb_messages: input.messages.length, nb_ecrans: sortie.ecrans.length });
  return sortie;
}
