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
  /// Table PARTAGÉE avec le web (apps/web/lib/__tests__/formulaires.test.ts, `CAS_MONTANT`) :
  /// mêmes entrées, mêmes sorties. Toute modification se fait des deux côtés.
  /// (saisie, attendu) — attendu = montant normalisé, 'AMBIGU' ou null (refusé).
  const cas = <(String, String?)>[
    ('1250', '1250.00'),
    ('12,5', '12.50'),
    ('12.5', '12.50'),
    ('1250.50', '1250.50'),
    ('1250,50', '1250.50'),
    ('0,99', '0.99'),
    ('  42 ', '42.00'),
    ('007', '7.00'),
    ('1 250,50', '1250.50'),
    ('1 250,50', '1250.50'),
    ('1 250 000,00', '1250000.00'),
    ('1.250,50', '1250.50'),
    ('1,250.50', '1250.50'),
    ('1 250 000', '1250000.00'),
    ('1.250.000,75', '1250000.75'),
    ('1,250,000', '1250000.00'),
    ('1 250', '1250.00'),
    ('1.250', 'AMBIGU'),
    ('1,250', 'AMBIGU'),
    ('12.500', 'AMBIGU'),
    ('999,000', 'AMBIGU'),
    ('12 50', null),
    ('1 250.000,5', null),
    ('1.250 000', null),
    ('1.250.50', null),
    ('1,25.50', null),
    ('1.2.3', null),
    ('1250,505', null),
    ('1 250,505', null),
    ('12,', null),
    (',50', null),
    ('-50', null),
    ('+50', null),
    ('abc', null),
    ('1e3', null),
    ('1234567890123', null),
    ('', null),
    ('   ', null),
  ];

  group('parseMontant — une seule spécification web + mobile', () {
    for (final (saisie, attendu) in cas) {
      test('« $saisie » → $attendu', () {
        if (attendu == 'AMBIGU') {
          expect(parseMontant(saisie), isNull);
          expect(montantAmbigu(saisie), isTrue);
        } else {
          expect(parseMontant(saisie), attendu);
          expect(montantAmbigu(saisie), isFalse);
        }
      });
    }

    test('null refusé', () => expect(parseMontant(null), isNull));

    test('montantPositif', () {
      expect(montantPositif('0.00'), isFalse);
      expect(montantPositif('0.01'), isTrue);
      expect(montantPositif('1250.00'), isTrue);
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
    for (final (saisie, attendu) in const [('1.250,50', '1250.50'), ('1,250.50', '1250.50'), ('1250,5', '1250.50'), ('12,50', '12.50')]) {
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
