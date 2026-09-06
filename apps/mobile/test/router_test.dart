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

}
