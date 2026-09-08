/**
 * Niveaux de notification push (Master Spec 13.4 + brief §8.2) — la même classification pilote
 * Android (canal / importance / visibilité écran verrouillé) et iOS (interruption-level, son,
 * badge, thread). Trois niveaux visibles + un niveau silencieux (données seules) :
 *
 *  - URGENT : sécurité / argent / présence physique — bannière « alerte » qui reste, son, vibration,
 *    visible sur l'écran verrouillé, passe les modes Concentration / Ne pas déranger de type
 *    « time-sensitive » (iOS) et l'importance MAX (Android). Jamais désactivable, ignore les heures calmes.
 *  - NORMAL : bannière temporaire avec son (défaut).
 *  - INFO   : bannière discrète, sans son (récapitulatifs, documents, PV, sondages, annonces simples).
 *  - SILENCIEUX : aucune bannière — synchronisation du badge / des données (content-available).
 *
 * Les niveaux critiques Apple (« critical alerts ») exigent un droit spécial d'Apple : non utilisés.
 * Une notification hors heures calmes garde son niveau ; pendant les heures calmes, NORMAL et INFO sont
 * livrés sans son avec le niveau passif (visibles au réveil, sans réveiller) — URGENT inchangé.
 */
export type NiveauPush = "URGENT" | "NORMAL" | "INFO" | "SILENCIEUX";

/** Canaux Android (créés côté app — mêmes identifiants dans PushService). */
export const CANAUX_ANDROID: Record<NiveauPush, string> = {
  URGENT: "syndicup_urgent",
  NORMAL: "syndicup",
  INFO: "syndicup_info",
  SILENCIEUX: "syndicup_silencieux",
};

const URGENTS = new Set([
  "INCIDENT_URGENCE_MAXIMALE",
  "ANNONCE_URGENTE",
  "VISITE_NOUVELLE", // le résident doit répondre au gardien pendant que le visiteur attend
  "VISITE_REPONSE", // le gardien attend la décision à la porte
  "LCD_ARRIVEE_AUJOURDHUI",
  "LCD_SEJOUR_GARDIEN",
  "VISITEUR_DEPASSEMENT",
  "VEHICULE_MAL_STATIONNE",
  "BADGE_PERDU",
  "IMPAYE_N4",
  "IMPAYE_N5",
  "IMPAYE_N6",
  "AG_OUVERTE",
  "ASSURANCE_IMMEUBLE_ABSENTE",
  "CONTRAT_ECHEANCE_MANQUEE",
  "MANDAT_PROPOSE",
]);

const INFOS = new Set([
  "PV_DISPONIBLE",
  "DOCUMENT_PUBLIE",
  "RAPPORT_GESTION_DISPONIBLE",
  "COMMUNICATION_DIGEST",
  "TACHES_EN_RETARD_HEBDO",
  "ANNONCE_PUBLIEE",
  "ANNONCE_COMMENTAIRE",
  "SONDAGE_OUVERT",
  "SONDAGE_CLOS",
  "TACHE_COMMENTAIRE",
  "CONTRAT_RECONDUIT",
  "PAIEMENT_RECU",
  "PAIEMENT_VALIDE",
  "LOT_RATTACHE",
  "INVITATION_ACCEPTEE",
  "IMPORT_TERMINE",
  "CONGE_APPROUVE",
  "PAIE_VALIDEE",
  "RESERVATION_VALIDEE",
  "ATTRIBUTION_EMPLACEMENT",
  "BADGE_REMIS",
  "MANDAT_CONFIRME",
  "MANDAT_TERMINE",
]);

export function niveauPush(templateCode: string): NiveauPush {
  if (URGENTS.has(templateCode)) return "URGENT";
  if (INFOS.has(templateCode)) return "INFO";
  return "NORMAL";
}

/** Fil de regroupement (iOS thread-id / Android group) : un fil par domaine métier. */
export function filPush(templateCode: string): string {
  const t = templateCode;
  if (t.startsWith("AG_") || t === "PV_DISPONIBLE") return "ag";
  if (t.startsWith("APPEL_") || t.startsWith("IMPAYE_") || t.startsWith("PAIEMENT_") || t.startsWith("JUSTIFICATIF_") || t.startsWith("CONTESTATION_")) return "finances";
  if (t.startsWith("DEPENSE_") || t.startsWith("FACTURE_") || t.startsWith("RAPPORT_")) return "finances";
  if (t.startsWith("INCIDENT_") || t.startsWith("LITIGE_")) return "incidents";
  if (t.startsWith("VISITE") || t.startsWith("LCD_") || t.startsWith("VEHICULE_") || t.startsWith("BADGE_") || t.startsWith("ATTRIBUTION_")) return "acces";
  if (t.startsWith("RESERVATION_")) return "reservations";
  if (t.startsWith("ANNONCE_") || t.startsWith("SONDAGE_") || t === "COMMUNICATION_DIGEST") return "communication";
  if (t.startsWith("TACHE")) return "taches";
  if (t.startsWith("CONTRAT_") || t === "ASSURANCE_IMMEUBLE_ABSENTE") return "contrats";
  if (t.startsWith("PAIE_") || t.startsWith("CONGE_") || t === "CONTRAT_TRAVAIL_FIN_PROCHE") return "personnel";
  if (t.startsWith("MANDAT_")) return "cabinet";
  return "general";
}

export interface HeuresCalmes {
  /** "HH:MM" locale Casablanca. */
  debut: string;
  fin: string;
}

/** Vrai si `quand` (heure locale Africa/Casablanca) tombe dans la plage — gère le passage minuit. */
export function dansHeuresCalmes(hc: HeuresCalmes | null | undefined, quand: Date = new Date()): boolean {
  if (!hc) return false;
  const [hd, md] = hc.debut.split(":").map(Number);
  const [hf, mf] = hc.fin.split(":").map(Number);
  if ([hd, md, hf, mf].some((n) => Number.isNaN(n))) return false;
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Casablanca", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(quand);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const now = h * 60 + m;
  const debut = hd! * 60 + md!;
  const fin = hf! * 60 + mf!;
  if (debut === fin) return false;
  return debut < fin ? now >= debut && now < fin : now >= debut || now < fin;
}

export interface PreferencesPush {
  push_normal: boolean;
  push_info: boolean;
  push_son: boolean;
  heures_calmes: HeuresCalmes | null;
}

export const PREFERENCES_PUSH_DEFAUT: PreferencesPush = { push_normal: true, push_info: true, push_son: true, heures_calmes: null };

/** Paramètres de livraison d'un push, calculés depuis le niveau et les préférences du destinataire. */
export interface LivraisonPush {
  niveau: NiveauPush;
  /** Faux si le destinataire a désactivé ce niveau (la notification reste visible in-app). */
  livrer: boolean;
  son: boolean;
  /** Niveau d'interruption iOS. */
  interruption: "time-sensitive" | "active" | "passive";
  canalAndroid: string;
  fil: string;
}

export function livraisonPush(templateCode: string, prefs: PreferencesPush = PREFERENCES_PUSH_DEFAUT, quand: Date = new Date()): LivraisonPush {
  const niveau = niveauPush(templateCode);
  const calme = dansHeuresCalmes(prefs.heures_calmes, quand);
  const fil = filPush(templateCode);
  if (niveau === "URGENT") {
    return { niveau, livrer: true, son: true, interruption: "time-sensitive", canalAndroid: CANAUX_ANDROID.URGENT, fil };
  }
  const livrer = niveau === "INFO" ? prefs.push_info : prefs.push_normal;
  const son = prefs.push_son && !calme && niveau === "NORMAL";
  const interruption = calme || niveau === "INFO" ? "passive" : "active";
  return { niveau, livrer, son, interruption, canalAndroid: calme ? CANAUX_ANDROID.INFO : CANAUX_ANDROID[niveau], fil };
}
