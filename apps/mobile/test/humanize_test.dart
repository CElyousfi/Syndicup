import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/util/status.dart';

void main() {
  test('humanizeCode : jamais de SCREAMING_SNAKE à l\'écran', () {
    expect(humanizeCode('A_APPROUVER'), 'A approuver');
    expect(humanizeCode('EN_COURS'), 'En cours');
    expect(humanizeCode('NOUVEAU_STATUT_2'), 'Nouveau statut 2');
    expect(humanizeCode('BROUILLON'), 'Brouillon');
    // Libellés déjà lisibles et sigles courts : inchangés.
    expect(humanizeCode('En attente'), 'En attente');
    expect(humanizeCode('AG'), 'AG');
    expect(humanizeCode('0_30'), '0_30');
    expect(humanizeCode(null), '—');
  });

  test('looksLikeCode', () {
    expect(looksLikeCode('EN_ATTENTE'), isTrue);
    expect(looksLikeCode('PAYE'), isFalse);
    expect(looksLikeCode('Payé'), isFalse);
  });
}
