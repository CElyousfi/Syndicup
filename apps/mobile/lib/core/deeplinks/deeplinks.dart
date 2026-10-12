import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Entrées « système » dans l'app (M26-D) :
///  - liens : `https://app.syndicup.pro/{fr|ar}/…` et `syndicup:///…` (Assistant, Siri, raccourcis)
///    arrivent au routeur comme route initiale — [sansLangue] retire le préfixe de langue ;
///  - partage (Android : cible de partage ; iOS : extension à créer) : photo → signalement,
///    PDF → preuve de paiement ;
///  - Spotlight (iOS) : lots, incidents, annonces, documents indexés ; un résultat ouvre l'objet.
class DeepLinks {
  DeepLinks._();
  static final DeepLinks instance = DeepLinks._();

  static const _share = MethodChannel('ma.syndicup.app/share');
  static const _spotlight = MethodChannel('ma.syndicup.app/spotlight');
  static const _routes = EventChannel('ma.syndicup.app/routes');

  final _partages = StreamController<Partage>.broadcast();
  Stream<Partage> get partages => _partages.stream;
  StreamSubscription<dynamic>? _routesSub;
  void Function(String path)? onRoute;

  Future<void> init() async {
    if (kIsWeb) return;
    _share.setMethodCallHandler((call) async {
      if (call.method == 'partage') {
        final p = await prendrePartage();
        if (p != null) _partages.add(p);
      }
    });
    if (Platform.isIOS) {
      _routesSub ??= _routes.receiveBroadcastStream().listen((e) {
        final r = e?.toString();
        if (r != null && r.startsWith('/')) onRoute?.call(sansLangue(r));
      }, onError: (_) {});
    }
  }

  /// Contenu partagé en attente (consommé une fois).
  Future<Partage?> prendrePartage() async {
    if (kIsWeb || !Platform.isAndroid) return null;
    try {
      final m = await _share.invokeMethod<Map<dynamic, dynamic>>('prendre');
      final path = m?['path']?.toString();
      if (path == null || path.isEmpty) return null;
      return Partage(path: path, mime: m?['mime']?.toString() ?? 'application/octet-stream');
    } catch (_) {
      return null;
    }
  }

  /// Route cible d'un contenu partagé : photo → signalement pré-rempli ; PDF → paiement.
  static String routePour(Partage p) => p.mime.startsWith('image/') ? '/incidents/nouveau?photo=${Uri.encodeComponent(p.path)}' : '/payer';

  /// Indexe des objets dans Spotlight (iOS) — remplace l'index précédent de l'app.
  Future<void> indexerSpotlight(List<SpotlightItem> items) async {
    if (kIsWeb || !Platform.isIOS) return;
    try {
      await _spotlight.invokeMethod<void>('index', {
        'items': [for (final i in items) {'id': i.id, 'titre': i.titre, 'sous_titre': i.sousTitre, 'route': i.route, 'type': i.type}],
      });
    } catch (e) {
      debugPrint('Spotlight : $e');
    }
  }

  Future<void> viderSpotlight() async {
    if (kIsWeb || !Platform.isIOS) return;
    try {
      await _spotlight.invokeMethod<void>('clear');
    } catch (_) {}
  }

  /// `/fr/lots/abc` → `/lots/abc` ; les chemins sans préfixe sont rendus tels quels.
  static String sansLangue(String path) {
    final m = RegExp(r'^/(fr|ar)(?=/|$)').firstMatch(path);
    if (m == null) return path;
    final reste = path.substring(m.end);
    return reste.isEmpty ? '/' : reste;
  }
}

class Partage {
  const Partage({required this.path, required this.mime});
  final String path;
  final String mime;
}

class SpotlightItem {
  const SpotlightItem({required this.id, required this.titre, this.sousTitre, required this.route, required this.type});
  final String id, titre, route, type;
  final String? sousTitre;
}
