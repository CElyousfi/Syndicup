/// Niveaux de notification (miroir de apps/api/lib/notifications/push-niveaux.ts) : le serveur
/// envoie `niveau` / `fil` / `son` avec chaque push FCM et chaque événement du flux temps réel ;
/// ce fichier ne sert qu'au repli (événement ancien sans niveau) et au mappage vers les canaux
/// Android / niveaux d'interruption iOS.
library;

const niveauUrgent = 'URGENT';
const niveauNormal = 'NORMAL';
const niveauInfo = 'INFO';
const niveauSilencieux = 'SILENCIEUX';

const _urgents = {
  'INCIDENT_URGENCE_MAXIMALE', 'ANNONCE_URGENTE', 'VISITE_NOUVELLE', 'VISITE_REPONSE', 'LCD_ARRIVEE_AUJOURDHUI', 'LCD_SEJOUR_GARDIEN',
  'VISITEUR_DEPASSEMENT', 'VEHICULE_MAL_STATIONNE', 'BADGE_PERDU', 'IMPAYE_N4', 'IMPAYE_N5', 'IMPAYE_N6', 'AG_OUVERTE',
  'ASSURANCE_IMMEUBLE_ABSENTE', 'CONTRAT_ECHEANCE_MANQUEE', 'MANDAT_PROPOSE',
};
const _infos = {
  'PV_DISPONIBLE', 'DOCUMENT_PUBLIE', 'RAPPORT_GESTION_DISPONIBLE', 'COMMUNICATION_DIGEST', 'TACHES_EN_RETARD_HEBDO', 'ANNONCE_PUBLIEE',
  'ANNONCE_COMMENTAIRE', 'SONDAGE_OUVERT', 'SONDAGE_CLOS', 'TACHE_COMMENTAIRE', 'CONTRAT_RECONDUIT', 'PAIEMENT_RECU', 'PAIEMENT_VALIDE',
  'LOT_RATTACHE', 'INVITATION_ACCEPTEE', 'IMPORT_TERMINE', 'CONGE_APPROUVE', 'PAIE_VALIDEE', 'RESERVATION_VALIDEE', 'ATTRIBUTION_EMPLACEMENT',
  'BADGE_REMIS', 'MANDAT_CONFIRME', 'MANDAT_TERMINE',
};

/// Niveau effectif : celui du serveur s'il est connu, sinon la classification locale.
String niveauPour(String? niveauServeur, String templateCode) {
  if (niveauServeur == niveauUrgent || niveauServeur == niveauNormal || niveauServeur == niveauInfo || niveauServeur == niveauSilencieux) {
    return niveauServeur!;
  }
  if (_urgents.contains(templateCode)) return niveauUrgent;
  if (_infos.contains(templateCode)) return niveauInfo;
  return niveauNormal;
}

/// Fil de regroupement (iOS thread-id / Android group).
String filPour(String? filServeur, String t) {
  if (filServeur != null && filServeur.isNotEmpty) return filServeur;
  if (t.startsWith('AG_') || t == 'PV_DISPONIBLE') return 'ag';
  if (t.startsWith('APPEL_') || t.startsWith('IMPAYE_') || t.startsWith('PAIEMENT_') || t.startsWith('JUSTIFICATIF_') || t.startsWith('CONTESTATION_') || t.startsWith('DEPENSE_') || t.startsWith('FACTURE_') || t.startsWith('RAPPORT_')) return 'finances';
  if (t.startsWith('INCIDENT_') || t.startsWith('LITIGE_')) return 'incidents';
  if (t.startsWith('VISITE') || t.startsWith('LCD_') || t.startsWith('VEHICULE_') || t.startsWith('BADGE_') || t.startsWith('ATTRIBUTION_')) return 'acces';
  if (t.startsWith('RESERVATION_')) return 'reservations';
  if (t.startsWith('ANNONCE_') || t.startsWith('SONDAGE_') || t == 'COMMUNICATION_DIGEST') return 'communication';
  if (t.startsWith('TACHE')) return 'taches';
  if (t.startsWith('CONTRAT_') || t == 'ASSURANCE_IMMEUBLE_ABSENTE') return 'contrats';
  if (t.startsWith('PAIE_') || t.startsWith('CONGE_') || t == 'CONTRAT_TRAVAIL_FIN_PROCHE') return 'personnel';
  if (t.startsWith('MANDAT_')) return 'cabinet';
  return 'general';
}

/// Identifiant du canal Android par niveau — mêmes valeurs que côté API (CANAUX_ANDROID).
String canalAndroidPour(String niveau) => switch (niveau) {
      niveauUrgent => 'syndicup_urgent',
      niveauInfo => 'syndicup_info',
      niveauSilencieux => 'syndicup_silencieux',
      _ => 'syndicup',
    };
