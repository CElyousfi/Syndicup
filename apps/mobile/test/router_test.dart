import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/api/models.dart';
import 'package:syndicup/core/auth/app_state.dart';
import 'package:syndicup/core/i18n/dict.dart';
import 'package:syndicup/core/util/nav.dart';
import 'package:syndicup/core/util/notifications_link.dart';

AppContext ctxFor(String role) => AppContext(
      profil: Profil(id: 'u', languePreferee: 'FR', statutCompte: 'ACTIF', roles: [ProfilRole(coproprieteId: 'c', role: role, actif: true)]),
      role: role,
      roles: [role],
      copropriete: null,
      coproprietes: const [],
      coproprieteId: 'c',
    );

void main() {
  test('navigation par rôle : 4 onglets + Plus, jamais une entrée grisée', () {
    for (final role in ['SYNDIC', 'CONSEIL_SYNDICAL', 'PROPRIETAIRE', 'LOCATAIRE', 'GARDIEN', 'PRESTATAIRE', 'GESTIONNAIRE_LCD', 'SUPER_ADMIN']) {
      final nav = buildNav(ctxFor(role), dictFr);
      final tabs = buildTabs(nav, ctxFor(role), dictFr);
      expect(tabs.length, lessThanOrEqualTo(4), reason: role);
      expect(tabs.isNotEmpty, isTrue, reason: role);
    }
  });
  test('le locataire ne voit ni finances ni AG ; le prestataire ne voit que ses tickets', () {
    final loc = buildNav(ctxFor('LOCATAIRE'), dictFr).expand((s) => s.items).map((i) => i.path).toList();
    expect(loc, isNot(contains('/ag')));
    expect(loc, isNot(contains('/finances/appels-de-fonds')));
    final prest = buildNav(ctxFor('PRESTATAIRE'), dictFr).expand((s) => s.items).map((i) => i.path).toList();
    expect(prest, ['/tableau-de-bord', '/incidents']);
  });
  test('M15 : le module LCD est dans la navigation des rôles concernés, jamais chez le locataire ou le prestataire', () {
    List<String> paths(String r) => buildNav(ctxFor(r), dictFr).expand((s) => s.items).map((i) => i.path).toList();
    for (final r in ['SYNDIC', 'CONSEIL_SYNDICAL', 'PROPRIETAIRE', 'GESTIONNAIRE_LCD', 'GARDIEN']) {
      expect(paths(r), contains('/location-courte-duree'), reason: r);
    }
    expect(paths('LOCATAIRE'), isNot(contains('/location-courte-duree')));
    expect(paths('PRESTATAIRE'), isNot(contains('/location-courte-duree')));
    expect(paths('GESTIONNAIRE_LCD'), isNot(contains('/ag')));
    expect(paths('GESTIONNAIRE_LCD'), isNot(contains('/finances/appels-de-fonds')));
    final tabs = buildTabs(buildNav(ctxFor('GARDIEN'), dictFr), ctxFor('GARDIEN'), dictFr).map((t) => t.path);
    expect(tabs, contains('/location-courte-duree'));
  });
  test('M16 : les dépenses sont dans la navigation du syndic et du conseil, jamais chez un résident, le gardien ou le prestataire', () {
    List<String> paths(String r) => buildNav(ctxFor(r), dictFr).expand((s) => s.items).map((i) => i.path).toList();
    expect(paths('SYNDIC'), contains('/depenses'));
    expect(paths('CONSEIL_SYNDICAL'), contains('/depenses'));
    for (final r in ['PROPRIETAIRE', 'LOCATAIRE', 'GARDIEN', 'PRESTATAIRE', 'GESTIONNAIRE_LCD']) {
      expect(paths(r), isNot(contains('/depenses')), reason: r);
    }
    expect(ctxFor('CONSEIL_SYNDICAL').approuveDepenses, isTrue);
    expect(ctxFor('CONSEIL_SYNDICAL').gereDepenses, isFalse);
    expect(ctxFor('SYNDIC').gereDepenses, isTrue);
    expect(lienNotification('DEPENSE_A_APPROUVER', {'depense_id': 'abc'}), '/depenses/abc');
    expect(lienNotification('FACTURE_ECHEANCE_PROCHE', {'depense_id': 'abc'}), '/depenses/abc');
  });
  test('rôles dérivés', () {
    expect(ctxFor('SYNDIC').isGestion, isTrue);
    expect(ctxFor('CONSEIL_SYNDICAL').voitFinancesGlobales, isTrue);
    expect(ctxFor('LOCATAIRE').voitAg, isFalse);
    expect(ctxFor('GARDIEN').isResident, isFalse);
    expect(ctxFor('PROPRIETAIRE').isResident, isTrue);
    expect(ctxFor('GESTIONNAIRE_LCD').isGestionnaireLcd, isTrue);
    expect(ctxFor('GESTIONNAIRE_LCD').voitAg, isFalse);
    expect(ctxFor('GESTIONNAIRE_LCD').declareSejoursLcd, isTrue);
    expect(ctxFor('GARDIEN').declareSejoursLcd, isFalse);
  });

  test('M18 : rapports pour le syndic et le conseil ; transparence pour tout membre (locataire inclus), jamais pour le gardien ni le prestataire', () {
    List<String> paths(String r) => buildNav(ctxFor(r), dictFr).expand((s) => s.items).map((i) => i.path).toList();
    expect(paths('SYNDIC'), contains('/rapports'));
    expect(paths('CONSEIL_SYNDICAL'), contains('/rapports'));
    for (final r in ['PROPRIETAIRE', 'INDIVISAIRE', 'PERSONNE_MORALE_REPRESENTANT', 'LOCATAIRE']) {
      expect(paths(r), contains('/rapports/transparence'), reason: r);
      expect(paths(r), isNot(contains('/rapports')), reason: r);
    }
    for (final r in ['GARDIEN', 'PRESTATAIRE', 'GESTIONNAIRE_LCD']) {
      expect(paths(r), isNot(contains('/rapports/transparence')), reason: r);
    }
    expect(lienNotification('RAPPORT_GESTION_DISPONIBLE', {'rapport_id': 'x'}), '/rapports/transparence');
  });


  test('M19 : contrats pour le syndic et le conseil uniquement ; deep-links contrat / assurance', () {
    List<String> paths(String r) => buildNav(ctxFor(r), dictFr).expand((s) => s.items).map((i) => i.path).toList();
    expect(paths('SYNDIC'), contains('/contrats'));
    expect(paths('CONSEIL_SYNDICAL'), contains('/contrats'));
    for (final r in ['PROPRIETAIRE', 'LOCATAIRE', 'GARDIEN', 'PRESTATAIRE', 'GESTIONNAIRE_LCD']) {
      expect(paths(r), isNot(contains('/contrats')), reason: r);
    }
    expect(lienNotification('CONTRAT_ECHEANCE_PROCHE', {'contrat_id': 'c1'}), '/contrats/c1');
    expect(lienNotification('ASSURANCE_IMMEUBLE_ABSENTE', {}), '/contrats');
  });

  test('M20 : « Mon dossier » pour le gardien, registre pour syndic / conseil ; deep-links congés / paie / fin de contrat', () {
    List<String> paths(String r) => buildNav(ctxFor(r), dictFr).expand((s) => s.items).map((i) => i.path).toList();
    expect(paths('GARDIEN'), contains('/personnel/me'));
    expect(paths('GARDIEN'), isNot(contains('/personnel')));
    expect(paths('SYNDIC'), contains('/personnel'));
    for (final r in ['PROPRIETAIRE', 'LOCATAIRE', 'PRESTATAIRE', 'GESTIONNAIRE_LCD']) {
      expect(paths(r), isNot(contains('/personnel/me')), reason: r);
    }
    expect(lienNotification('CONGE_DEMANDE', {'conge_id': 'c1', 'personnel_id': 'p1'}), '/personnel/p1?onglet=conges');
    expect(lienNotification('CONGE_APPROUVE', {}), '/personnel/me?onglet=conges');
    expect(lienNotification('PAIE_VALIDEE', {'personnel_id': 'p1', 'fiche_id': 'f1'}), '/personnel/p1?onglet=paie');
    expect(lienNotification('PAIE_A_VALIDER', {'periode': '2026-09'}), '/personnel');
    expect(lienNotification('CONTRAT_TRAVAIL_FIN_PROCHE', {'personnel_id': 'p1'}), '/personnel/p1');
  });
  test('M21 : tableau d\'affichage pour tout membre sauf le prestataire ; onglet résident ; deep-links annonce / sondage / digest', () {
    List<String> paths(String r) => buildNav(ctxFor(r), dictFr).expand((s) => s.items).map((i) => i.path).toList();
    for (final r in ['SYNDIC', 'CONSEIL_SYNDICAL', 'PROPRIETAIRE', 'LOCATAIRE', 'GARDIEN', 'GESTIONNAIRE_LCD']) {
      expect(paths(r), contains('/affichage'), reason: r);
    }
    expect(paths('PRESTATAIRE'), isNot(contains('/affichage')));
    expect(buildTabs(buildNav(ctxFor('PROPRIETAIRE'), dictFr), ctxFor('PROPRIETAIRE'), dictFr).map((t) => t.path), contains('/affichage'));
    expect(lienNotification('ANNONCE_PUBLIEE', {'annonce_id': 'a1'}), '/affichage/a1');
    expect(lienNotification('ANNONCE_URGENTE', {'annonce_id': 'a1'}), '/affichage/a1');
    expect(lienNotification('SONDAGE_OUVERT', {'sondage_id': 's1'}), '/affichage/sondages/s1');
    expect(lienNotification('COMMUNICATION_DIGEST', {}), '/affichage');
  });
  test('M22 : tâches pour le syndic, le conseil et le gardien (les siennes) ; deep-links tâche / retards', () {
    List<String> paths(String r) => buildNav(ctxFor(r), dictFr).expand((s) => s.items).map((i) => i.path).toList();
    for (final r in ['SYNDIC', 'CONSEIL_SYNDICAL', 'GARDIEN']) {
      expect(paths(r), contains('/taches'), reason: r);
    }
    for (final r in ['PROPRIETAIRE', 'LOCATAIRE', 'PRESTATAIRE', 'GESTIONNAIRE_LCD']) {
      expect(paths(r), isNot(contains('/taches')), reason: r);
    }
    expect(lienNotification('TACHE_ASSIGNEE', {'tache_id': 't1'}), '/taches/t1');
    expect(lienNotification('TACHE_ECHEANCE', {'tache_id': 't1'}), '/taches/t1');
    expect(lienNotification('TACHES_EN_RETARD_HEBDO', {'nb': '3'}), '/taches');
  });
  test('M23 : parkings & badges pour tout membre sauf le prestataire et le gestionnaire LCD ; deep-links attribution / badge / véhicule gênant / visiteur', () {
    List<String> paths(String r) => buildNav(ctxFor(r), dictFr).expand((s) => s.items).map((i) => i.path).toList();
    for (final r in ['SYNDIC', 'CONSEIL_SYNDICAL', 'PROPRIETAIRE', 'LOCATAIRE', 'GARDIEN']) {
      expect(paths(r), contains('/parkings'), reason: r);
    }
    for (final r in ['PRESTATAIRE', 'GESTIONNAIRE_LCD']) {
      expect(paths(r), isNot(contains('/parkings')), reason: r);
    }
    expect(lienNotification('ATTRIBUTION_EMPLACEMENT', {'emplacement_id': 'e1'}), '/parkings/e1');
    expect(lienNotification('ATTRIBUTION_EXPIREE', {'emplacement_id': 'e1'}), '/parkings/e1');
    expect(lienNotification('BADGE_PERDU', {'badge_id': 'b1'}), '/parkings?onglet=badges');
    expect(lienNotification('VEHICULE_MAL_STATIONNE', {'incident_id': 'i1'}), '/incidents/i1');
    expect(lienNotification('VISITEUR_DEPASSEMENT', {'visite_id': 'v1'}), '/parkings?onglet=visiteurs');
  });
  test('M24 : deep-link import terminé → tableau de bord (import web-first)', () {
    expect(lienNotification('IMPORT_TERMINE', {'import_job_id': 'i1'}), '/tableau-de-bord');
  });
}
