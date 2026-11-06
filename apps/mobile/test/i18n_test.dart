import 'package:flutter/widgets.dart';
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
    expect(dictAr.enums.regimeLcd.keys, dictFr.enums.regimeLcd.keys);
    expect(dictAr.enums.statutSejour.keys, dictFr.enums.statutSejour.keys);
    expect(dictFr.roles.containsKey('GESTIONNAIRE_LCD'), isTrue);
  });
  test('interpolation', () {
    expect(fill('Bonjour {prenom}', {'prenom': 'Amina'}), 'Bonjour Amina');
    expect(fill('{n} visites', {'n': 2}), '2 visites');
  });
  test('chaînes mobiles présentes dans les deux langues', () {
    expect(MobileDict.fr.offline, isNotEmpty);
    expect(MobileDict.ar.offline, isNotEmpty);
    expect(MobileDict.ar.queueTitle, contains('{n}'));
    expect(MobileDict.ar.lcdQueueTitle, contains('{n}'));
    expect(MobileDict.fr.lcdOfflineConfirm, isNotEmpty);
  });
  test('toutes les langues de l\'interface ont leur dictionnaire', () {
    for (final c in appLanguages) {
      expect(dictByLang.containsKey(c), isTrue, reason: c);
      expect(languageNames[c], isNotNull, reason: c);
      expect(languageFlags[c], isNotNull, reason: c);
    }
    expect(supportedLocales.length, appLanguages.length);
    expect(localeOf('zh').scriptCode, 'Hans');
    expect(localeOf('xx'), const Locale('fr'));
  });
  test('langues générées : traduites, variables conservées, repli français', () {
    final en = const Locale('en').dict;
    expect(en.common.save, isNot(dictFr.common.save));
    expect(en.common.results, contains('{count}'));
    expect(const Locale('de').dict.nav.lots, isNot(dictFr.nav.lots));
    expect(MobileDict.of(const Locale('es')).offline, isNot(MobileDict.fr.offline));
    expect(MobileDict.of(const Locale('ru')).queueTitle, contains('{n}'));
    expect(MobileDict.of(const Locale('xx')).offline, MobileDict.fr.offline);
    expect(DariDict.of(const Locale('it')).obBulle.length, DariDict.fr.obBulle.length);
    expect(MobileUp.of(const Locale('zh')).uploading, contains('{pct}'));
  });
  test('profil : FR | AR seulement', () {
    expect(languePrefereeOf(const Locale('ar')), 'AR');
    expect(languePrefereeOf(const Locale('fr')), 'FR');
    expect(languePrefereeOf(const Locale('en')), isNull);
    expect(langueServeurOf(const Locale('de')), 'fr');
  });
}
