/**
 * Textes des moments difficiles utilisés CÔTÉ CLIENT (frontières d'erreur, visionneuse,
 * pastille de direct, référence copiable) — module séparé pour que le tableau des codes
 * d'erreur (errors-fr.ts) ne parte jamais dans un bundle client (poids des pages publiques).
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
  seconds: "{n} s",
  minutes: "{n} min",
  retry: "Réessayer",
};

/** Référence courte (8 caractères) à communiquer au support — copiable. */
export const referenceFr = {
  reference: "Réf. {ref}",
  referenceCopy: "Copier la référence",
  referenceCopied: "Référence copiée",
};
