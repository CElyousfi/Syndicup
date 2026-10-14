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
    expect(aJour['nom'], 'Résidence Al Manar');
    expect(aJour['charges']['a_jour'], isTrue);
    expect(aJour['charges']['route'], '/lots/lot-1?onglet=finances');
    expect(aJour['charges']['sous_titre'], MobileDict.fr.widgetAJour);
    expect(aJour['charges']['dari'], DariPose.laugh);

    final dans3j = DateTime.now().add(const Duration(days: 3)).toIso8601String().substring(0, 10);
    final du = forme({
      'charges': {'solde_du': '1750.00', 'nb_lots': 2, 'lot_id': null, 'prochaine_echeance': dans3j, 'prochain_montant': '750.00', 'taux_paye': 0.4167, 'nb_quittances': 1},
    });
    expect(du['charges']['a_jour'], isFalse);
    expect(du['charges']['route'], '/payer');
    expect(du['charges']['route_detail'], '/lots');
    expect(du['charges']['sous_titre'], contains('3'));
    expect(du['charges']['taux'], closeTo(0.4167, 0.0001));
    expect(du['charges']['dari'], DariPose.point);
  });

  test('AG : trois états, séance en cours → « Voter » vers le pupitre', () {
    final aucune = forme({'ag': null});
    expect(aucune['ag']['etat'], 'AUCUNE');
    expect(aucune['ag']['route'], '/ag');
    expect(aucune['ag']['dari'], DariPose.wave);

    final enCours = forme({
      'ag': {'id': 'ag-1', 'type': 'ORDINAIRE', 'date_ag': DateTime.now().toIso8601String(), 'statut': 'EN_COURS', 'nb_resolutions': 5, 'nb_votees': 2},
    });
    expect(enCours['ag']['etat'], 'EN_COURS');
    expect(enCours['ag']['route'], '/ag/ag-1/seance');
    expect(enCours['ag']['cta'], MobileDict.fr.widgetVoter);
    expect(enCours['ag']['progression'], '2/5 résolutions votées');
    expect(enCours['ag']['dari'], DariPose.type);

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
    // Dari : SLA dépassé → il montre ; annonce urgente non lue → il montre ; visites → il montre.
    expect(s['residence']['dari'], DariPose.point);
    expect(s['affichage']['dari'], DariPose.point);
    expect(s['gardien']['dari'], DariPose.point);
  });

  test('Dari : humeur des widgets selon l\'état, toujours une pose connue des images natives', () {
    final calme = forme({
      'residence': {'taux_recouvrement': 0.97, 'impaye_total': '0.00', 'incidents_ouverts': 0, 'incidents_sla_depasse': 0, 'reservations_a_valider': 0, 'recouvrement_6': []},
      'affichage': {'non_lues': 0, 'annonces': []},
      'gardien': {'visites_en_attente': 0},
    });
    expect(calme['residence']['dari'], DariPose.laugh);
    expect(calme['affichage']['dari'], DariPose.laugh);
    expect(calme['gardien']['dari'], DariPose.wave);

    final tendu = forme({
      'residence': {'taux_recouvrement': 0.6, 'impaye_total': '90000.00', 'incidents_ouverts': 1, 'incidents_sla_depasse': 0, 'reservations_a_valider': 0, 'recouvrement_6': []},
      'affichage': {
        'non_lues': 1,
        'annonces': [
          {'id': 'a1', 'titre': 'AG', 'urgent': false, 'publie_le': DateTime.now().toIso8601String(), 'lu': false},
        ],
      },
    });
    expect(tendu['residence']['dari'], DariPose.think);
    expect(tendu['affichage']['dari'], DariPose.wave);

    final loin = DateTime.now().add(const Duration(days: 20)).toIso8601String().substring(0, 10);
    final tranquille = forme({
      'charges': {'solde_du': '750.00', 'nb_lots': 1, 'lot_id': 'l', 'prochaine_echeance': loin, 'taux_paye': 0.5},
      'ag': {'id': 'ag', 'type': 'ORDINAIRE', 'date_ag': DateTime.now().add(const Duration(days: 12)).toIso8601String(), 'statut': 'CONVOQUEE', 'nb_resolutions': 2, 'nb_votees': 0},
    });
    expect(tranquille['charges']['dari'], DariPose.wave);
    expect(tranquille['ag']['dari'], DariPose.wave);

    for (final m in [calme, tendu, tranquille]) {
      for (final bloc in ['charges', 'ag', 'residence', 'affichage', 'gardien']) {
        if (m[bloc] is Map) expect(DariPose.toutes, contains(m[bloc]['dari']), reason: bloc);
      }
    }
  });

  test('templates temps réel qui rafraîchissent les widgets', () {
    expect(HomeWidgets.concerne('AG_OUVERTE'), isTrue);
    expect(HomeWidgets.concerne('PAIEMENT_RECU'), isTrue);
    expect(HomeWidgets.concerne('ANNONCE_PUBLIEE'), isTrue);
    expect(HomeWidgets.concerne('CONGE_DEMANDE'), isFalse);
  });
}
