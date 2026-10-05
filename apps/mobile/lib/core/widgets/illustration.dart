import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

/// Emplacements d'illustration (langage Wise : objets 3D de marque, affiches texturées).
/// Les fichiers vivent dans `assets/illustrations/<nom>.png` ; tant qu'un fichier n'est pas
/// livré, l'emplacement rend son repli (pictogramme, motif code-natif) — jamais un trou.
/// Le manifeste des assets est lu UNE fois au démarrage (`SuIllustration.init`) : aucune
/// tentative de chargement d'un fichier absent, aucun clignotement.
class SuIllustration extends StatelessWidget {
  const SuIllustration(this.name, {super.key, required this.fallback, this.size, this.fit = BoxFit.contain});
  final String name;
  final Widget fallback;
  final double? size;
  final BoxFit fit;

  static Set<String> _assets = const {};

  static Future<void> init() async {
    try {
      final m = await AssetManifest.loadFromAssetBundle(rootBundle);
      _assets = m.listAssets().where((a) => a.startsWith('assets/illustrations/')).toSet();
    } catch (_) {
      _assets = const {}; // manifeste illisible (tests) : replis partout
    }
  }

  static String path(String name) => 'assets/illustrations/$name.png';

  /// L'illustration a été livrée.
  static bool has(String name) => _assets.contains(path(name));

  @override
  Widget build(BuildContext context) {
    if (!has(name)) return fallback;
    return Image.asset(path(name), width: size, height: size, fit: fit, excludeFromSemantics: true, errorBuilder: (_, __, ___) => fallback);
  }
}
