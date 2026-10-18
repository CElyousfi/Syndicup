import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/format/format.dart';
import 'package:syndicup/core/i18n/mobile_dict.dart';
import 'package:syndicup/core/widgets/forms.dart';

/// Saisie simulée : chaque formateur reçoit l'ancienne valeur et la sortie du précédent.
TextEditingValue _tape(String avant, String apres) {
  final old = TextEditingValue(text: avant, selection: TextSelection.collapsed(offset: avant.length));
  var cur = TextEditingValue(text: apres, selection: TextSelection.collapsed(offset: apres.length));
  for (final f in montantFormatters) {
    cur = f.formatEditUpdate(old, cur);
  }
  return cur;
}

void main() {
  group('parseMontant — saisie française acceptée', () {
    test('virgule décimale et espaces de milliers', () {
      expect(parseMontant('1 250,50'), '1250.50');
      expect(parseMontant('1 250,50'), '1250.50');
      expect(parseMontant('1 250,5'), '1250.5');
      expect(parseMontant('12,5'), '12.5');
      expect(parseMontant('1250'), '1250');
      expect(parseMontant('1250.00'), '1250.00');
      expect(parseMontant(' 300 '), '300');
    });

    test('séparateurs de milliers des deux usages', () {
      expect(parseMontant('1.250,50'), '1250.50');
      expect(parseMontant('1,250.50'), '1250.50');
      expect(parseMontant('1.250.000,75'), '1250000.75');
      expect(parseMontant('1,250,000'), '1250000');
    });

    test('formes tolérées : virgule finale, zéros de tête', () {
      expect(parseMontant('12,'), '12');
      expect(parseMontant('007,5'), '7.5');
      expect(parseMontant('0,00'), '0.00');
    });

    test('refus explicites (jamais un montant deviné)', () {
      expect(parseMontant(null), isNull);
      expect(parseMontant(''), isNull);
      expect(parseMontant('   '), isNull);
      expect(parseMontant('abc'), isNull);
      expect(parseMontant('-12'), isNull);
      expect(parseMontant('12,345'), isNull); // 3 décimales
      expect(parseMontant('1.2.3'), isNull);
      expect(parseMontant('1,25.50'), isNull); // groupe de milliers invalide
      expect(parseMontant('1234567890123'), isNull); // 13 chiffres
      expect(parseMontant(',5'), isNull);
    });

    test('montantPositif', () {
      expect(montantPositif('0'), isFalse);
      expect(montantPositif('0.00'), isFalse);
      expect(montantPositif('0.01'), isTrue);
      expect(montantPositif('1250'), isTrue);
    });
  });

  group('montantFormatters — le texte tapé est gardé, jamais tronqué', () {
    test('virgule et collage gardés tels quels, lus par parseMontant', () {
      expect(_tape('12', '12,').text, '12,');
      expect(_tape('', '1 250,50').text, '1 250,50');
      expect(parseMontant(_tape('', '1 250,50').text), '1250.50');
    });

    test('lettres et séparateurs doublés refusés', () {
      expect(_tape('', 'abc').text, '');
      expect(_tape('12', '12.,').text, '12');
    });

    test('« 1.250 » seul : ambigu, signalé (jamais 1,25 en silence)', () {
      expect(parseMontant('1.250'), isNull);
      expect(montantAmbigu('1.250'), isTrue);
      expect(montantAmbigu('1,250'), isTrue);
      expect(montantAmbigu('12,50'), isFalse);
      expect(montantAmbigu('1.250,50'), isFalse);
      expect(MobileUp.fr.ambiguite('1.250'), 'Montant ambigu : \u20661 250\u2069 ou \u20661,25\u2069 ?');
      expect(MobileUp.fr.ambiguite('2.505'), 'Montant ambigu : \u20662 505\u2069 ?');
    });
  });

  group('saisie touche après touche dans un champ', () {
    for (final (saisie, attendu) in const [('1.250,50', '1250.50'), ('1,250.50', '1250.50'), ('1250,5', '1250.5'), ('12,50', '12.50')]) {
      testWidgets('« $saisie » → $attendu', (tester) async {
        final c = TextEditingController();
        await tester.pumpWidget(MaterialApp(home: Scaffold(body: TextField(controller: c, inputFormatters: montantFormatters))));
        for (var i = 1; i <= saisie.length; i++) {
          await tester.enterText(find.byType(TextField), saisie.substring(0, i));
          await tester.pump();
        }
        expect(c.text, saisie);
        expect(parseMontant(c.text), attendu);
      });
    }
  });

  group('telephonePlausible', () {
    test('mobile et fixe marocains, international', () {
      expect(telephonePlausible('06 12 34 56 78'), isTrue);
      expect(telephonePlausible('+212 6 12 34 56 78'), isTrue);
      expect(telephonePlausible('0522 12 34 56'), isTrue);
      expect(telephonePlausible('+33 6 12 34 56 78'), isTrue);
      expect(telephonePlausible('0033612345678'), isTrue);
      expect(telephonePlausible('12345'), isFalse);
      expect(telephonePlausible('abc'), isFalse);
    });
  });
}
