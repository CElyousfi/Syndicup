/// Cible de navigation d'une notification (push ou in-app) — déduite du template et de ses
/// variables. Même table que apps/web/lib/notifications-link.ts (deep-links brief §8.2).
String lienNotification(String templateCode, Map<String, dynamic>? contenu) {
  final c = contenu ?? const {};
  String? id(String k) => c[k] is String ? c[k] as String : null;

  if (templateCode == 'PV_DISPONIBLE' && id('ag_id') != null) return '/ag/${id('ag_id')}/pv';
  if (templateCode.startsWith('AG_') && id('ag_id') != null) return '/ag/${id('ag_id')}';
  if (templateCode.startsWith('INCIDENT_') && id('incident_id') != null) return '/incidents/${id('incident_id')}';
  if (templateCode == 'APPEL_DE_FONDS_EMIS' || templateCode == 'PAIEMENT_RECU' || templateCode.startsWith('IMPAYE_')) {
    if (id('lot_id') != null) return '/lots/${id('lot_id')}?onglet=finances';
    if (id('appel_de_fonds_id') != null) return '/finances/appels-de-fonds/${id('appel_de_fonds_id')}';
    return '/finances/appels-de-fonds';
  }
  if (templateCode.startsWith('CONTESTATION_')) return '/finances/contestations';
  if (templateCode == 'LOT_RATTACHE' && id('lot_id') != null) return '/lots/${id('lot_id')}';
  if (templateCode.startsWith('DOCUMENT_')) return '/documents';
  if (templateCode == 'INVITATION_ACCEPTEE') return id('utilisateur_id') != null ? '/membres/${id('utilisateur_id')}' : '/invitations';
  if (templateCode.startsWith('VISITE_')) return id('visite_id') != null ? '/visites/${id('visite_id')}' : '/visites';
  if (templateCode.startsWith('RESERVATION_')) return '/reservations';
  if (templateCode.startsWith('LITIGE_')) return '/litiges';
  // M17 — justificatifs : déclaration à valider, validation, rejet, espèces, relance.
  if (templateCode.startsWith('JUSTIFICATIF_') || templateCode == 'PAIEMENT_VALIDE' || templateCode == 'PAIEMENT_ESPECES_SAISI') {
    return id('justificatif_id') != null ? '/justificatifs/${id('justificatif_id')}' : '/justificatifs';
  }
  // M19 — contrats : échéances, expiration, reconduction, assurance absente.
  if (templateCode.startsWith('CONTRAT_')) return id('contrat_id') != null ? '/contrats/${id('contrat_id')}' : '/contrats';
  if (templateCode == 'ASSURANCE_IMMEUBLE_ABSENTE') return '/contrats';
  // M18 — rapport de gestion soumis à l'AG : les copropriétaires le lisent depuis la transparence.
  if (templateCode.startsWith('RAPPORT_GESTION_')) return '/rapports/transparence';
  // M16 — dépenses : approbation, décision, échéance de facture.
  if (templateCode.startsWith('DEPENSE_') || templateCode == 'FACTURE_ECHEANCE_PROCHE') {
    return id('depense_id') != null ? '/depenses/${id('depense_id')}' : '/depenses';
  }
  if (templateCode.startsWith('LCD_')) {
    if (id('sejour_id') != null) return '/location-courte-duree/sejours/${id('sejour_id')}';
    if (id('declaration_id') != null) return '/location-courte-duree/declarations/${id('declaration_id')}';
    return '/location-courte-duree';
  }
  return '/notifications';
}
