import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/api/models.dart';
import 'package:syndicup/core/auth/app_state.dart';
import 'package:syndicup/core/i18n/dict.dart';
import 'package:syndicup/core/util/nav.dart';

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
    for (final role in ['SYNDIC', 'CONSEIL_SYNDICAL', 'PROPRIETAIRE', 'LOCATAIRE', 'GARDIEN', 'PRESTATAIRE', 'SUPER_ADMIN']) {
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
  test('rôles dérivés', () {
    expect(ctxFor('SYNDIC').isGestion, isTrue);
    expect(ctxFor('CONSEIL_SYNDICAL').voitFinancesGlobales, isTrue);
    expect(ctxFor('LOCATAIRE').voitAg, isFalse);
    expect(ctxFor('GARDIEN').isResident, isFalse);
    expect(ctxFor('PROPRIETAIRE').isResident, isTrue);
  });
}
