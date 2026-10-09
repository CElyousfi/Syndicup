import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../theme/motion_tokens.g.dart';
import 'flags.dart';
import 'sensations.dart';

/// Haptique SÉMANTIQUE — on appelle une intention, jamais un moteur :
///  - [tap]      action principale validée (bouton CTA, envoi) ;
///  - [select]   changement de sélection (onglet, segment, interrupteur, seuil de glissement) ;
///  - [success]  écriture confirmée par le serveur ;
///  - [warning]  saisie refusée (validation), action bloquée ;
///  - [error]    échec serveur / réseau ;
///  - [heavy]    moment signature (annexes générées, scellé).
/// Limité à un retour toutes les 80 ms, jamais au défilement ni à la frappe ; muet si l'utilisateur
/// a coupé les vibrations ou si `alive_v1` est désactivé. Les vibrations restent actives en
/// « animations réduites » (accessibilité : le mouvement est réduit, pas le toucher).
class Haptics {
  Haptics._();

  static DateTime _last = DateTime.fromMillisecondsSinceEpoch(0);

  /// Journal de test : la dernière intention émise (null si filtrée).
  @visibleForTesting
  static String? lastEmitted;

  static bool get enabled => ClientFlags.instance.alive && Sensations.instance.prefs.value.haptics;

  static bool _gate(String name) {
    if (!enabled) return false;
    final now = DateTime.now();
    if (now.difference(_last) < SuTokens.hapticThrottle) return false;
    _last = now;
    lastEmitted = name;
    return true;
  }

  static void _then(Duration d, Future<void> Function() f) => Future<void>.delayed(d, f);

  static void tap() {
    if (_gate('tap')) HapticFeedback.lightImpact();
  }

  static void select() {
    if (_gate('select')) HapticFeedback.selectionClick();
  }

  static void success() {
    if (!_gate('success')) return;
    HapticFeedback.lightImpact();
    _then(const Duration(milliseconds: 90), HapticFeedback.mediumImpact);
  }

  static void warning() {
    if (!_gate('warning')) return;
    HapticFeedback.mediumImpact();
    _then(const Duration(milliseconds: 110), HapticFeedback.lightImpact);
  }

  static void error() {
    if (!_gate('error')) return;
    HapticFeedback.heavyImpact();
    _then(const Duration(milliseconds: 100), HapticFeedback.mediumImpact);
  }

  static void heavy() {
    if (_gate('heavy')) HapticFeedback.heavyImpact();
  }

  @visibleForTesting
  static void debugReset() {
    _last = DateTime.fromMillisecondsSinceEpoch(0);
    lastEmitted = null;
  }
}
