import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/api/api_result.dart';
import 'package:syndicup/core/api/error_text.dart';
import 'package:syndicup/core/i18n/mobile_dict.dart';

const fr = Locale('fr');
const ar = Locale('ar');

ErrorText e(Locale l, String code, int status, {String message = '', int? retryAfter, String? requestId}) =>
    errorTextFor(l, ApiError(code: code, message: message), status, retryAfter: retryAfter, requestId: requestId);

final _arabe = RegExp(r'[؀-ۿ]');
final _latinMot = RegExp(r'[A-Za-zÀ-ÿ]{4,}');

void main() {
  group('errorText — codes transport et HTTP', () {
    test('NETWORK / TIMEOUT / PARSE_ERROR : messages client, action Réessayer', () {
      expect(e(fr, 'NETWORK', 0).title, MobileUx.fr.errNetworkTitle);
      expect(e(fr, 'NETWORK', 0).action, ErrorAction.retry);
      expect(e(ar, 'NETWORK', 0).body, MobileUx.ar.errNetworkBody);
      expect(e(fr, 'TIMEOUT', 0).title, MobileUx.fr.errTimeoutTitle);
      expect(e(ar, 'PARSE_ERROR', 200).title, MobileUx.ar.errParseTitle);
      expect(e(fr, 'BAD_RESPONSE', 502).title, MobileUx.fr.errParseTitle);
    });

    test('403 : accès réservé, pas de Réessayer ; 404 : retour à la liste', () {
      expect(e(fr, 'FORBIDDEN', 403).title, 'Accès réservé');
      expect(e(fr, 'FORBIDDEN', 403).action, ErrorAction.none);
      expect(e(fr, 'NOT_FOUND', 404).title, 'Cet élément n\'existe plus');
      expect(e(ar, 'NOT_FOUND', 404).action, ErrorAction.backToList);
      expect(e(ar, 'NOT_FOUND', 404).title, contains('لم يعد'));
    });

    test('RATE_LIMITED : retry-after converti en minutes (arrondi au-dessus)', () {
      expect(e(fr, 'RATE_LIMITED', 429, retryAfter: 90).body, 'Patientez 2 min avant de réessayer.');
      expect(e(fr, 'RATE_LIMITED', 429, retryAfter: 30).body, 'Patientez 1 min avant de réessayer.');
      expect(e(ar, 'RATE_LIMITED', 429, retryAfter: 600).body, contains('10'));
      expect(e(fr, 'RATE_LIMITED', 429).body, MobileUx.fr.errRateBodyGeneric);
    });

    test('5xx : message générique + référence courte (8 caractères)', () {
      final x = e(fr, 'INTERNAL_ERROR', 500, message: 'TypeError: cannot read x', requestId: '0123456789abcdef');
      expect(x.body, MobileUx.fr.errInternalBody);
      expect(x.reference, 'Réf. 01234567');
      expect(x.line, contains('01234567'));
      expect(e(fr, 'SERVICE_UNAVAILABLE', 503).title, MobileUx.fr.errUnavailableTitle);
      expect(e(fr, 'NOT_IMPLEMENTED', 501).title, MobileUx.fr.errNotImplTitle);
      // Pas de référence pour une erreur 4xx.
      expect(e(fr, 'CONFLICT', 409, requestId: '0123456789abcdef').reference, isNull);
    });

    test('UNAUTHENTICATED : reconnexion', () {
      expect(e(fr, 'UNAUTHENTICATED', 401).action, ErrorAction.reconnect);
      expect(e(ar, 'UNAUTHENTICATED', 401).body, MobileUx.ar.errUnauthBody);
    });
  });

  group('errorText — codes métier', () {
    test('*_STATUT_INVALIDE → « a changé, actualisez »', () {
      for (final c in ['DEPENSE_STATUT_INVALIDE', 'JUSTIFICATIF_STATUT_INVALIDE', 'TACHE_STATUT_INVALIDE', 'CONGE_STATUT_INVALIDE']) {
        final x = e(fr, c, 422, message: 'Transition interdite (Doc A §8.3).');
        expect(x.title, MobileUx.fr.errStaleTitle, reason: c);
        expect(x.body, contains('actualisez'), reason: c);
        expect(x.action, ErrorAction.refresh, reason: c);
      }
    });

    test('codes connus traduits en FR et en AR', () {
      for (final c in ['FONDS_RESERVE_INSUFFISANT', 'JUSTIFICATIF_PREUVE_REQUISE', 'CONGE_SOLDE_INSUFFISANT', 'SONDAGE_DEJA_REPONDU', 'INCIDENT_DEJA_EVALUE', 'LCD_QUOTA_NUITS_DEPASSE', 'LCD_SEJOUR_CHEVAUCHEMENT']) {
        expect(e(fr, c, 422).body, MobileUx.fr.codes[c], reason: c);
        expect(e(ar, c, 422).body, MobileUx.ar.codes[c], reason: c);
        expect(_arabe.hasMatch(e(ar, c, 422).body), isTrue, reason: c);
      }
    });

    test('les deux dictionnaires couvrent les mêmes codes', () {
      expect(MobileUx.ar.codes.keys.toSet(), MobileUx.fr.codes.keys.toSet());
    });
  });

  group('errorText — repli', () {
    test('FR : message serveur sans références de spécification', () {
      expect(e(fr, 'CONFLICT', 409, message: 'Déjà inscrit — connectez-vous (Partie 5.5).').body, 'Déjà inscrit — connectez-vous.');
      expect(e(fr, 'UNPROCESSABLE_ENTITY', 422, message: 'Seul le syndic gère les contrats (Doc A §8).').body, 'Seul le syndic gère les contrats.');
      expect(e(fr, 'CODE_INCONNU', 422, message: 'Règle Doc A §2.1 non respectée.').body, 'Règle non respectée.');
    });

    test('AR : jamais le message français du serveur', () {
      final x = e(ar, 'UNPROCESSABLE_ENTITY', 422, message: 'Seul le syndic gère les contrats (Doc A §8).');
      expect(x.body, MobileUx.ar.errUnprocessableBody);
      expect(_latinMot.hasMatch(x.body), isFalse);
      expect(e(ar, 'CODE_INCONNU', 409, message: 'Conflit quelconque').body, MobileUx.ar.errConflictBody);
    });

    test('stripSpecRefs', () {
      expect(stripSpecRefs('Créneau déjà réservé (Doc A §7.2).'), 'Créneau déjà réservé.');
      expect(stripSpecRefs('Le règlement exige un gestionnaire (Doc A §2.1 : propriétaire MRE / absent).'), 'Le règlement exige un gestionnaire.');
      expect(stripSpecRefs('Message simple.'), 'Message simple.');
    });
  });
}
