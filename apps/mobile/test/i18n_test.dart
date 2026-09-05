import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/i18n/dict.dart';
import 'package:syndicup/core/i18n/i18n.dart';
import 'package:syndicup/core/i18n/mobile_dict.dart';

void main() {
  test('les dictionnaires FR et AR couvrent les mêmes enums', () {
    expect(dictAr.enums.typeLot.keys, dictFr.enums.typeLot.keys);
    expect(dictAr.enums.statutAg.keys, dictFr.enums.statutAg.keys);
    expect(dictAr.roles.keys, dictFr.roles.keys);
    expect(dictAr.enums.categorieIncident.length, 11);
  });
  test('interpolation', () {
    expect(fill('Bonjour {prenom}', {'prenom': 'Amina'}), 'Bonjour Amina');
    expect(fill('{n} visites', {'n': 2}), '2 visites');
  });
  test('chaînes mobiles présentes dans les deux langues', () {
    expect(MobileDict.fr.offline, isNotEmpty);
    expect(MobileDict.ar.offline, isNotEmpty);
    expect(MobileDict.ar.queueTitle, contains('{n}'));
  });
}
