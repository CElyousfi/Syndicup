import 'package:flutter/foundation.dart';

/// Événements de session et d'accès remontés par l'ApiClient vers la navigation.
///
///  - **Fin de session** (refresh token refusé) : le routeur mémorise l'écran en cours, envoie à
///    la connexion avec `?expire=1&next=…` (toast « Votre session a expiré ») et y revient après
///    la reconnexion.
///  - **402** (accès de la résidence suspendu) : la coque affiche un toast, au plus une fois par
///    minute.
class SessionEvents {
  SessionEvents._();
  static final SessionEvents instance = SessionEvents._();

  bool _expired = false;
  String? _returnPath;
  DateTime? _dernier402;

  /// Incrémenté à chaque 402 à signaler (écouté par la coque).
  final ValueNotifier<int> accessSuspended = ValueNotifier<int>(0);

  /// Appelé par l'ApiClient AVANT que la session ne soit vidée.
  void markExpired() => _expired = true;

  bool get expiredPending => _expired;

  /// Consomme le drapeau « session expirée » (une seule redirection vers la connexion).
  bool takeExpired() {
    final e = _expired;
    _expired = false;
    return e;
  }

  /// Chemin auquel revenir après la reconnexion (premier gagnant : l'écran où l'on était).
  void rememberReturn(String path) => _returnPath ??= path;

  String? takeReturn() {
    final p = _returnPath;
    _returnPath = null;
    return p;
  }

  void paymentRequired() {
    final now = DateTime.now();
    if (_dernier402 != null && now.difference(_dernier402!) < const Duration(minutes: 1)) return;
    _dernier402 = now;
    accessSuspended.value++;
  }

  @visibleForTesting
  void reset() {
    _expired = false;
    _returnPath = null;
    _dernier402 = null;
  }
}
