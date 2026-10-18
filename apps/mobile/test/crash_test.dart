import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/crash.dart';
import 'package:syndicup/core/i18n/mobile_dict.dart';

void main() {
  testWidgets('carte d\'erreur d\'affichage : autonome (sans MaterialApp), message calme', (tester) async {
    await tester.pumpWidget(const CalmErrorCard());
    expect(find.text(MobileUx.fr.renderErrorTitle), findsOneWidget);
    expect(find.text(MobileUx.fr.renderErrorBody), findsOneWidget);
  });

  test('journal JSON d\'une erreur sans planter', () {
    CrashCapture.log('test', StateError('boom'), StackTrace.current, contexte: 'unitaire');
  });
}
