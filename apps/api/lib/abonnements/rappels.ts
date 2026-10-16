/**
 * Rappels d'abonnement (M29) — job quotidien 09:00 Casablanca (inngest/functions/abonnements.ts).
 *
 * Paliers : fin d'essai J-7 et J-1 ; renouvellement J-30, J-14 et J-3 ; entrée en délai de grâce ;
 * coupure. Chaque rappel a une clé unique (abonnement_evenement.cle) : il n'est envoyé qu'une fois,
 * et un jour manqué (job en panne) est rattrapé le lendemain sans doublon.
 * Destinataires : le contact de facturation du client (s'il a un e-mail) + l'opérateur
 * (ABONNEMENTS_OPERATEUR_EMAIL, séparés par des virgules). Côté application, la fenêtre de rappel
 * du syndic est calculée en direct (GET /v1/abonnement) — elle ne dépend pas de ce job.
 */
import type { EtatAcces } from "./etat";

export interface RappelDu {
  cle: string;
  palier: string;
  titre: string;
  corps: string;
  /** Prévenir aussi l'opérateur (toujours vrai sauf rappels très en amont). */
  operateur: boolean;
}

const fr = (jour: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${jour}T00:00:00Z`));

export function rappelsDus(params: {
  abonnementId: string;
  statut: "ESSAI" | "ACTIF" | "SUSPENDU" | "RESILIE";
  etat: EtatAcces;
  residences: string[];
  contact?: string | null;
}): RappelDu[] {
  const { abonnementId: id, statut, etat } = params;
  if (statut === "RESILIE" || statut === "SUSPENDU" || !etat.echeance) return [];
  const qui = params.residences.length > 0 ? params.residences.join(", ") : "votre résidence";
  const signature = "\n\nL'équipe SyndicUp";
  const bonjour = `Bonjour${params.contact ? ` ${params.contact}` : ""},\n\n`;
  const j = etat.jours_avant_echeance ?? 0;
  const ech = etat.echeance;
  const out: RappelDu[] = [];

  if (etat.etat === "EN_ESSAI") {
    for (const palier of [7, 1]) {
      if (j <= palier) {
        out.push({
          cle: `rappel:${id}:essai:${ech}:j${palier}`,
          palier: `ESSAI_J${palier}`,
          titre: palier === 1 ? "Votre essai SyndicUp se termine demain" : `Votre essai SyndicUp se termine dans ${j} jours`,
          corps:
            `${bonjour}L'essai gratuit de SyndicUp pour ${qui} se termine le ${fr(ech)}.\n` +
            `Pour continuer sans interruption, répondez à ce message : nous vous envoyons la facture et les coordonnées de paiement (virement ou chèque).` +
            (etat.date_blocage ? `\nSans règlement, l'accès sera suspendu le ${fr(etat.date_blocage)}.` : "") +
            signature,
          operateur: palier === 1,
        });
        break; // un seul palier à la fois : le plus proche de l'échéance
      }
    }
  }

  if (etat.etat === "RENOUVELLEMENT_PROCHE") {
    for (const palier of [3, 14, 30]) {
      if (j <= palier) {
        out.push({
          cle: `rappel:${id}:renouvellement:${ech}:j${palier}`,
          palier: `RENOUVELLEMENT_J${palier}`,
          titre: `Renouvellement de votre abonnement SyndicUp le ${fr(ech)}`,
          corps:
            `${bonjour}La période payée de l'abonnement SyndicUp de ${qui} se termine le ${fr(ech)}.\n` +
            `Votre facture de renouvellement est disponible sur demande ; le règlement se fait par virement ou chèque.` +
            signature,
          operateur: palier <= 14,
        });
        break;
      }
    }
  }

  if (etat.niveau === "GRACE") {
    out.push({
      cle: `rappel:${id}:grace:${ech}`,
      palier: "GRACE",
      titre: "Abonnement SyndicUp : règlement en attente",
      corps:
        `${bonjour}L'échéance du ${fr(ech)} est dépassée pour ${qui}. L'application reste ouverte pour l'instant` +
        (etat.date_blocage ? ` jusqu'au ${fr(etat.date_blocage)} inclus` : "") +
        `.\nMerci de régulariser par virement ou chèque — répondez à ce message pour recevoir la facture.` +
        signature,
      operateur: true,
    });
  }

  if (etat.niveau === "BLOQUE" && etat.etat === "BLOQUE_IMPAYE") {
    out.push({
      cle: `rappel:${id}:bloque:${ech}`,
      palier: "BLOQUE",
      titre: "Accès SyndicUp suspendu",
      corps:
        `${bonjour}Faute de règlement, l'accès à SyndicUp pour ${qui} est suspendu` +
        (etat.date_blocage ? ` (dernier jour d'accès : ${fr(etat.date_blocage)})` : "") +
        `.\n` +
        `Vos données sont conservées intégralement : l'accès est rétabli dès réception du paiement.` +
        signature,
      operateur: true,
    });
  }

  return out;
}
