/**
 * Mapping enum métier → variante de badge (source : brief §6). Centralisé pour que la même
 * couleur raconte toujours la même chose, partout.
 */
import type { BadgeVariant } from "../components/ui/badge";

const map = <T extends string>(m: Record<T, BadgeVariant>) => m;

export const ligneAppelVariant = map({ PAYE: "ok", PARTIEL: "warn", IMPAYE: "danger" });

export const escaladeVariant = (niveau: string): BadgeVariant =>
  niveau === "N0" ? "neutral" : "ink";

export const budgetVariant = map({
  PROPOSE: "neutral",
  VOTE: "info",
  ACTIF: "ok",
  REMPLACE: "outline",
});

export const appelVariant = map({ BROUILLON: "neutral", EMIS: "info", CLOTURE: "outline" });

export const agVariant = map({
  PLANIFIEE: "neutral",
  CONVOQUEE: "info",
  EN_COURS: "warn",
  CLOTUREE: "ok",
  ANNULEE: "outline",
});

export const resolutionVariant = map({ EN_ATTENTE: "neutral", ADOPTEE: "ok", REJETEE: "danger" });

export const incidentVariant = map({
  OUVERT: "danger",
  EN_COURS: "warn",
  RESOLU: "ok",
  FERME: "outline",
});

export const urgenceVariant = map({
  NORMALE: "neutral",
  URGENTE: "warn",
  URGENCE_MAXIMALE: "danger",
});

export const reservationVariant = map({
  EN_ATTENTE: "neutral",
  CONFIRMEE: "ok",
  REJETEE: "danger",
  ANNULEE: "outline",
});

export const visiteVariant = map({ EN_ATTENTE: "warn", AUTORISE: "ok", REFUSE: "danger" });

export const personnelVariant = map({ PRESENT: "ok", ABSENT: "danger", REMPLACE: "warn" });

export const litigeVariant = map({ OUVERT: "danger", RESOLU: "ok", CLOS: "outline" });

export const invitationVariant = map({
  EN_ATTENTE: "info",
  ACCEPTEE: "ok",
  EXPIREE: "outline",
  REGENEREE: "neutral",
});

export const compteVariant = map({
  INVITE: "neutral",
  EN_VALIDATION: "warn",
  ACTIF: "ok",
  SUSPENDU: "danger",
  DESACTIVE: "outline",
  ANONYMISE: "ink",
});

export const contestationVariant = map({
  OUVERTE: "warn",
  REPONDUE: "ok",
  MEDIEE: "info",
  TRIBUNAL: "ink",
});

export const lotVariant = map({
  OCCUPE: "ok",
  VACANT: "neutral",
  ORPHELIN: "warn",
  EN_SUCCESSION: "outline",
  SINISTRE: "danger",
  TANTIEME_A_REGULARISER: "warn",
});

export const envoiVariant = map({ EN_ATTENTE: "neutral", ENVOYE: "ok", ECHOUE: "danger" });

export const coproVariant = map({ ACTIVE: "ok", ARCHIVEE: "outline" });

export const declarationLcdVariant = map({
  EN_ATTENTE: "warn",
  VALIDEE: "ok",
  REFUSEE: "danger",
  SUSPENDUE: "danger",
  CLOTUREE: "neutral",
});

export const sejourVariant = map({
  PREVU: "info",
  EN_COURS: "ok",
  TERMINE: "neutral",
  ANNULE: "neutral",
});

export const regimeLcdVariant = map({
  NON_DEFINI: "outline",
  AUTORISEE: "ok",
  ENCADREE: "info",
  INTERDITE: "danger",
});
