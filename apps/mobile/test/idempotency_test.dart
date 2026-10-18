import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/api/api_result.dart';
import 'package:syndicup/core/api/idempotency.dart';

final _uuid = RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

void main() {
  group('IdemKey — une intention, une clé', () {
    test('même contenu → même clé à chaque nouvel essai (Réessayer ne duplique pas)', () {
      final k = IdemKey();
      final body = {'montant': '1250.00', 'methode': 'VIREMENT'};
      final a = k.forPayload(body);
      final b = k.forPayload({'montant': '1250.00', 'methode': 'VIREMENT'});
      expect(a, b);
      expect(_uuid.hasMatch(a), isTrue);
    });

    test('contenu modifié → nouvelle clé (sinon 409 côté serveur)', () {
      final k = IdemKey();
      final a = k.forPayload({'montant': '1250.00'});
      final b = k.forPayload({'montant': '1300.00'});
      expect(a, isNot(b));
      // Et elle reste stable ensuite.
      expect(k.forPayload({'montant': '1300.00'}), b);
    });

    test('succès → la prochaine écriture a une nouvelle clé', () {
      final k = IdemKey();
      final a = k.forPayload({'x': 1});
      k.consumed();
      expect(k.forPayload({'x': 1}), isNot(a));
    });
  });

  group('IdemKeys — actions sans état', () {
    test('même intention → même clé jusqu\'au succès', () {
      final a = IdemKeys.of('budget-activer:b1').value;
      expect(IdemKeys.of('budget-activer:b1').value, a);
      expect(IdemKeys.of('budget-activer:b2').value, isNot(a));
      IdemKeys.done('budget-activer:b1');
      expect(IdemKeys.of('budget-activer:b1').value, isNot(a));
    });
  });

  group('IdemKey — échecs ambigus', () {
    const timeout = ApiFail<dynamic>(ApiError(code: 'TIMEOUT', message: ''), 0);
    const refus = ApiFail<dynamic>(ApiError(code: 'VALIDATION_ERROR', message: ''), 422);
    const ok = ApiOk<dynamic>(null, ApiMeta(requestId: 'r'), 201);

    test('délai dépassé → contenu modifié → renvoi : MÊME clé (peut-être déjà écrit)', () {
      final k = IdemKey();
      final a = k.forPayload({'montant': '100.00'});
      k.settle(timeout);
      expect(k.forPayload({'montant': '120.00'}), a);
    });

    test('5xx et 409 sont ambigus aussi', () {
      expect(IdemKey.isAmbiguous(502, 'INTERNAL_ERROR'), isTrue);
      expect(IdemKey.isAmbiguous(409, 'CONFLICT'), isTrue);
      expect(IdemKey.isAmbiguous(422, 'VALIDATION_ERROR'), isFalse);
    });

    test('refus certain (422) → contenu modifié → renvoi : nouvelle clé', () {
      final k = IdemKey();
      final a = k.forPayload({'montant': '100.00'});
      k.settle(refus);
      expect(k.forPayload({'montant': '120.00'}), isNot(a));
    });

    test('succès → nouvelle clé', () {
      final k = IdemKey();
      final a = k.forPayload({'montant': '100.00'});
      k.settle(timeout);
      k.settle(ok);
      expect(k.forPayload({'montant': '100.00'}), isNot(a));
    });

    test('IdemKeys.settle / clear', () {
      final a = IdemKeys.of('x').forPayload({'v': 1});
      IdemKeys.settle('x', timeout);
      expect(IdemKeys.of('x').forPayload({'v': 2}), a);
      IdemKeys.clear();
      expect(IdemKeys.of('x').value, isNot(a));
    });
  });
}
