import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/deeplinks/deeplinks.dart';

void main() {
  test('liens de l\'app web : le préfixe de langue est retiré, le reste intact', () {
    expect(DeepLinks.sansLangue('/fr/lots/abc'), '/lots/abc');
    expect(DeepLinks.sansLangue('/ar/invitation/XYZ'), '/invitation/XYZ');
    expect(DeepLinks.sansLangue('/fr'), '/');
    expect(DeepLinks.sansLangue('/payer'), '/payer');
    expect(DeepLinks.sansLangue('/france/x'), '/france/x');
  });

  test('contenu partagé : photo → signalement pré-rempli, PDF → paiement', () {
    expect(DeepLinks.routePour(const Partage(path: '/tmp/a b.jpg', mime: 'image/jpeg')), '/incidents/nouveau?photo=%2Ftmp%2Fa%20b.jpg');
    expect(DeepLinks.routePour(const Partage(path: '/tmp/r.pdf', mime: 'application/pdf')), '/payer');
  });
}
