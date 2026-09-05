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
  return '/notifications';
}
