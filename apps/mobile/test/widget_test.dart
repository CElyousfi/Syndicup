import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/format/centimes.dart';
import 'package:syndicup/core/format/format.dart';
import 'package:syndicup/core/util/notifications_link.dart';
import 'package:flutter/material.dart';

void main() {
  group('centimes (aucun float sur un montant)', () {
    test('versCentimes / versChaine', () {
      expect(versCentimes('1250.5'), BigInt.from(125050));
      expect(versCentimes('1250'), BigInt.from(125000));
      expect(versCentimes('-3.07'), BigInt.from(-307));
      expect(versCentimes('abc'), BigInt.zero);
      expect(versChaine(BigInt.from(125050)), '1250.50');
      expect(versChaine(BigInt.from(-307)), '-3.07');
    });
    test('somme et ratio exacts', () {
      expect(sommeCentimes(['0.10', '0.20']), BigInt.from(30));
      expect(ratio(BigInt.from(50), BigInt.from(200)), 0.25);
      expect(ratio(BigInt.one, BigInt.zero), 0);
    });
  });

  group('formatage', () {
    test('formatMontant groupe les milliers et fixe 2 décimales', () {
      expect(formatMontant('1250.5'), '1\u202f250,50');
      expect(formatMontant('45200'), '45\u202f200,00');
      expect(formatMontant('-3.07'), '−3,07');
      expect(formatMontant(null), '—');
    });
    test('formatMAD selon la locale', () {
      expect(formatMAD('1800.00', const Locale('fr')), '1\u202f800,00 MAD');
      expect(formatMAD('1800.00', const Locale('ar')), '1\u202f800,00 د.م.');
    });
    test('téléphone marocain normalisé', () {
      expect(normaliserTelephone('06 00 00 00 02'), '+212600000002');
      expect(normaliserTelephone('00212600000002'), '+212600000002');
      expect(normaliserTelephone('+212700000002'), '+212700000002');
      expect(normaliserTelephone('12345'), isNull);
      expect(formatTelephone('+212600000002'), '+212 6 00 00 00 02');
    });
    test('chiffres latins en arabe', () {
      expect(latn('٢٠٢٦'), '2026');
    });
  });

  group('deep-links des notifications', () {
    test('mêmes cibles que le web', () {
      expect(lienNotification('VISITE_NOUVELLE', {'visite_id': 'v1'}), '/visites/v1');
      expect(lienNotification('INCIDENT_STATUT', {'incident_id': 'i1'}), '/incidents/i1');
      expect(lienNotification('AG_CONVOCATION', {'ag_id': 'a1'}), '/ag/a1');
      expect(lienNotification('PV_DISPONIBLE', {'ag_id': 'a1'}), '/ag/a1/pv');
      expect(lienNotification('APPEL_DE_FONDS_EMIS', {'lot_id': 'l1'}), '/lots/l1?onglet=finances');
      expect(lienNotification('INCONNU', null), '/notifications');
    });
  });
}
