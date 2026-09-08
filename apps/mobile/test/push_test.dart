import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/api/models.dart';
import 'package:syndicup/core/push/niveaux.dart';

void main() {
  test('niveaux push : le serveur prime, repli local par template, canal Android par niveau', () {
    expect(niveauPour('INFO', 'VISITE_NOUVELLE'), 'INFO');
    expect(niveauPour(null, 'VISITE_NOUVELLE'), niveauUrgent);
    expect(niveauPour('inconnu', 'PV_DISPONIBLE'), niveauInfo);
    expect(niveauPour(null, 'APPEL_DE_FONDS_EMIS'), niveauNormal);
    expect(canalAndroidPour(niveauUrgent), 'syndicup_urgent');
    expect(canalAndroidPour(niveauNormal), 'syndicup');
    expect(canalAndroidPour(niveauInfo), 'syndicup_info');
    expect(canalAndroidPour(niveauSilencieux), 'syndicup_silencieux');
    expect(filPour(null, 'IMPAYE_N2'), 'finances');
    expect(filPour('acces', 'IMPAYE_N2'), 'acces');
    expect(filPour(null, 'LCD_ARRIVEE_AUJOURDHUI'), 'acces');
    expect(filPour(null, 'XYZ'), 'general');
  });

  test('préférences de notification : lecture tolérante et aller-retour JSON avec heures calmes', () {
    final p = PreferencesNotification.fromJson({'digest_hebdo': false, 'push_info': false, 'heures_calmes': {'debut': '22:00', 'fin': '07:00'}});
    expect(p.digestHebdo, isFalse);
    expect(p.pushNormal, isTrue);
    expect(p.pushInfo, isFalse);
    expect(p.heuresCalmes?.debut, '22:00');
    expect(p.toJson()['heures_calmes'], {'debut': '22:00', 'fin': '07:00'});
    expect(PreferencesNotification.fromJson({'heures_calmes': {'debut': 22}}).heuresCalmes, isNull);
    expect(const PreferencesNotification().toJson()['heures_calmes'], isNull);
  });
}
