import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../i18n/i18n.dart';

/// Déverrouillage biométrique (Face ID / empreinte) — oct. 2026.
///
/// Activé après la première connexion si l'appareil le permet. Au retour au premier plan après
/// [_graceDelay] en arrière-plan, l'app demande la biométrie avant d'afficher quoi que ce soit.
/// La session (jetons) reste dans le trousseau : la biométrie protège l'affichage, pas le réseau.
/// « Utiliser mon mot de passe » déconnecte et renvoie à la connexion classique.
class BiometricLock {
  BiometricLock(this._prefs, [LocalAuthentication? auth]) : _auth = auth ?? LocalAuthentication();
  final SharedPreferences _prefs;
  final LocalAuthentication _auth;

  static const _kEnabled = 'bio_lock_enabled';
  static const _kAsked = 'bio_lock_asked';
  static const Duration graceDelay = Duration(minutes: 2);

  bool get enabled => _prefs.getBool(_kEnabled) ?? false;
  bool get alreadyAsked => _prefs.getBool(_kAsked) ?? false;

  Future<void> setEnabled(bool v) => _prefs.setBool(_kEnabled, v);
  Future<void> markAsked() => _prefs.setBool(_kAsked, true);

  /// Capteur disponible ET au moins une biométrie enrôlée.
  Future<bool> get available async {
    try {
      final can = await _auth.canCheckBiometrics || await _auth.isDeviceSupported();
      if (!can) return false;
      return (await _auth.getAvailableBiometrics()).isNotEmpty;
    } on PlatformException {
      return false;
    }
  }

  /// `true` si l'utilisateur s'est authentifié ; `false` si refus, erreur ou annulation.
  Future<bool> authenticate(String reason) async {
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(stickyAuth: true, biometricOnly: false),
      );
    } on PlatformException {
      return false;
    }
  }
}

final biometricLockProvider = Provider<BiometricLock>((ref) => BiometricLock(ref.read(sharedPrefsProvider)));

/// `true` tant que l'écran de verrouillage doit couvrir l'app.
class LockedNotifier extends Notifier<bool> {
  DateTime? _backgroundedAt;

  @override
  bool build() {
    // Au lancement à froid, on verrouille si la biométrie est activée et qu'une session existe
    // (le routeur ne saura cela qu'après résolution ; le garde vérifie la session lui-même).
    return ref.read(biometricLockProvider).enabled;
  }

  void onPaused() => _backgroundedAt = DateTime.now();

  void onResumed() {
    final at = _backgroundedAt;
    _backgroundedAt = null;
    if (at == null || !ref.read(biometricLockProvider).enabled) return;
    if (DateTime.now().difference(at) >= BiometricLock.graceDelay) state = true;
  }

  void unlock() => state = false;
  void lock() => state = true;
}

final lockedProvider = NotifierProvider<LockedNotifier, bool>(LockedNotifier.new);
