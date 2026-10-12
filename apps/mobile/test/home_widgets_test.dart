import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:syndicup/core/i18n/i18n.dart';
import 'package:syndicup/core/i18n/mobile_dict.dart';
import 'package:syndicup/core/home_widgets/home_widgets.dart';

void main() {
  setUpAll(() async {
    await initializeDateFormatting('fr');
    await initializeDateFormatting('ar');
  });

  Map<String, dynamic> forme(Map<String, dynamic> j, [String langue = 'fr']) {
    final l = Locale(langue);
    return mettreEnForme(j, locale: l, dict: l.dict, md: MobileDict.of(l));
  }

  test('charges : à jour → libellé rassurant, route vers le lot ; dû → « Payer » et échéance relative', () {
    final aJour = forme({
      'copropriete': {'id': 'c', 'nom': 'Résidence Al Manar'},
      'charges': {'solde_du': '0.00', 'nb_lots': 1, 'lot_id': 'lot-1', 'prochaine_echeance': null, 'prochain_montant': null, 'taux_paye': 1, 'nb_quittances': 3},
    });
    expect(aJour['residence'], 'Résidence Al Manar');
    expect(aJour['charges']['a_jour'], isTrue);
    expect(aJour['charges']['route'], '/lots/lot-1?onglet=finances');
    expect(aJour['charges']['sous_titre'], MobileDict.fr.widgetAJour);

    final dans3j = DateTime.now().add(const Duration(days: 3)).toIso8601String().substring(0, 10);
    final du = forme({
      'charges': {'solde_du': '1750.00', 'nb_lots': 2, 'lot_id': null, 'prochaine_echeance': dans3j, 'prochain_montant': '750.00', 'taux_paye': 0.4167, 'nb_quittances': 1},
    });
    expect(du['charges']['a_jour'], isFalse);
    expect(du['charges']['route'], '/payer');
    expect(du['charges']['route_detail'], '/lots');
    expect(du['charges']['sous_titre'], contains('3'));
    expect(du['charges']['taux'], closeTo(0.4167, 0.0001));
  });

  test('AG : trois états, séance en cours → « Voter » vers le pupitre', () {
    final aucune = forme({'ag': null});
    expect(aucune['ag']['etat'], 'AUCUNE');
    expect(aucune['ag']['route'], '/ag');

    final enCours = forme({
      'ag': {'id': 'ag-1', 'type': 'ORDINAIRE', 'date_ag': DateTime.now().toIso8601String(), 'statut': 'EN_COURS', 'nb_resolutions': 5, 'nb_votees': 2},
    });
    expect(enCours['ag']['etat'], 'EN_COURS');
    expect(enCours['ag']['route'], '/ag/ag-1/seance');
    expect(enCours['ag']['cta'], MobileDict.fr.widgetVoter);
    expect(enCours['ag']['progression'], '2/5 résolutions votées');

    final demain = forme({
      'ag': {'id': 'ag-2', 'type': 'ORDINAIRE', 'date_ag': DateTime.now().add(const Duration(days: 1)).toIso8601String(), 'statut': 'CONVOQUEE', 'nb_resolutions': 3, 'nb_votees': 0},
    }, 'ar');
    expect(demain['rtl'], isTrue);
    expect(demain['ag']['compte'], MobileDict.ar.widgetAgDemain);
    expect(demain['ag']['route'], '/ag/ag-2');
  });

  test('résidence, affichage, gardien : séries et compteurs conservés, annonces urgentes signalées', () {
    final s = forme({
      'residence': {'taux_recouvrement': 0.82, 'impaye_total': '12500.00', 'incidents_ouverts': 4, 'incidents_sla_depasse': 1, 'reservations_a_valider': 2, 'recouvrement_6': [0.5, 0.7, 0.9, 1, 0.95, 0.82]},
      'affichage': {
        'non_lues': 2,
        'annonces': [
          {'id': 'a1', 'titre': 'Coupure d\'eau', 'categorie': 'COUPURE', 'urgent': true, 'publie_le': DateTime.now().subtract(const Duration(hours: 2)).toIso8601String(), 'lu': false},
        ],
      },
      'gardien': {'visites_en_attente': 3, 'arrivees_lcd_aujourdhui': 1, 'departs_lcd_aujourdhui': 0, 'incidents_ouverts': 2},
    });
    expect(s['residence']['serie'], hasLength(6));
    expect(s['residence']['taux_fmt'], isNot(isEmpty));
    expect(s['residence']['sla_label'], '1 hors délai');
    expect(s['affichage']['annonces'][0]['urgent'], isTrue);
    expect(s['affichage']['annonces'][0]['route'], '/affichage/a1');
    expect(s['affichage']['annonces'][0]['quand'], 'il y a 2 h');
    expect(s['gardien']['visites'], 3);
    expect(s['gardien']['route_enregistrer'], '/visites?enregistrer=1');
  });

  test('templates temps réel qui rafraîchissent les widgets', () {
    expect(HomeWidgets.concerne('AG_OUVERTE'), isTrue);
    expect(HomeWidgets.concerne('PAIEMENT_RECU'), isTrue);
    expect(HomeWidgets.concerne('ANNONCE_PUBLIEE'), isTrue);
    expect(HomeWidgets.concerne('CONGE_DEMANDE'), isFalse);
  });
}
