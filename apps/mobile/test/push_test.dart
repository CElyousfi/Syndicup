import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/api/models.dart';
import 'package:syndicup/core/i18n/mobile_dict.dart';
import 'package:syndicup/core/push/niveaux.dart';
import 'package:syndicup/core/push/push_service.dart';

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

  test('boutons de notification : miroir du serveur (porte, argent, séance, prestataire, défaut)', () {
    expect(actionsPour('VISITE_NOUVELLE', {'visite_id': 'v'}), ['AUTORISER', 'REFUSER']);
    expect(actionsPour('VISITE_NOUVELLE', {}), ['VOIR', 'MARQUER_LU']);
    expect(actionsPour('IMPAYE_N2', {}), ['PAYER', 'VOIR']);
    expect(actionsPour('AG_OUVERTE', {'ag_id': 'a'}), ['VOTER', 'VOIR']);
    expect(actionsPour('INCIDENT_STATUT_CHANGE', {'prestataire_tel': '06'}), ['APPELER', 'VOIR']);
    expect(actionsPour('PV_DISPONIBLE', {}), ['VOIR', 'MARQUER_LU']);
  });

  test('préférences : résumé du matin (opt-in) sérialisé', () {
    expect(PreferencesNotification.fromJson({'resume_matin': true}).resumeMatin, isTrue);
    expect(const PreferencesNotification().toJson()['resume_matin'], isFalse);
  });

  test('activités en direct : progression et sous-titre par objet', () {
    expect(progressionActivite('APPEL_DE_FONDS', {'progression': '0.25'}), 0.25);
    expect(progressionActivite('INCIDENT', {'etape': '1', 'nb_etapes': '3'}), closeTo(1 / 3, 0.001));
    expect(progressionActivite('AG_SEANCE', {'nb_finalisees': '2', 'nb_resolutions': '4'}), 0.5);
    expect(progressionActivite('AG_SEANCE', {}), isNull);
    // Dari suit l'état (icône dari_n_<pose> présente dans res/drawable-nodpi).
    expect(dariPoseActivite('APPEL_DE_FONDS', {'statut': 'EMIS'}), 'point');
    expect(dariPoseActivite('APPEL_DE_FONDS', {'statut': 'PAYE'}), 'laugh');
    expect(dariPoseActivite('INCIDENT', {'statut': 'OUVERT'}), 'think');
    expect(dariPoseActivite('INCIDENT', {'statut': 'EN_COURS'}), 'type');
    expect(dariPoseActivite('AG_SEANCE', {'statut': 'EN_COURS'}), 'type');
    expect(dariPoseActivite('AG_SEANCE', {'statut': 'CLOTUREE'}), 'laugh');
    expect(sousTitreActivite('APPEL_DE_FONDS', {'statut': 'PAYE'}, MobileDict.fr), 'Réglé');
    expect(sousTitreActivite('AG_SEANCE', {'ordre': '2', 'nb_resolutions': '5'}, MobileDict.fr), 'Résolution 2 / 5');
    expect(sousTitreActivite('INCIDENT', {'etape': '1'}, MobileDict.ar), 'المرحلة 2 / 3');
  });
}
