import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:lottie/lottie.dart';

import '../feel/feel.dart';

/// Illustrations de marque VIVANTES (scripts/illustrations → docs/ALIVE_ILLUSTRATIONS.md).
///
/// Chaque illustration existe en deux fichiers frères dans `assets/illustrations/` :
///   `<nom>.png`  l'image de repos (rendue depuis l'animation : pixel pour pixel la même)
///   `<nom>.json` l'animation Lottie — mêmes fichiers que le web.
/// Frise : marqueur « intro » [0, repos) joué à l'apparition, marqueur « idle » [repos, fin)
/// boucle douce plafonnée ([idleCycles]) puis l'image se pose sur le repos.
///
/// Mouvement coupé (alive_v1, « Animations réduites », préférence système) : image de repos.
/// Mode lite (appareil modeste, économiseur) : intro oui, respiration non.
/// Hors écran (route recouverte) : TickerMode met l'animation en pause, sans coût.
/// Le manifeste des assets est lu UNE fois au démarrage (`SuIllustration.init`) : un fichier
/// absent rend le repli — jamais un trou ni une tentative de chargement vaine.
class SuIllustration extends StatelessWidget {
  const SuIllustration(this.name, {super.key, required this.fallback, this.size, this.fit = BoxFit.contain, this.idle = true});
  final String name;
  final Widget fallback;
  final double? size;
  final BoxFit fit;

  /// Respiration après l'intro (jamais pour les pictogrammes `quick-*`, alignés en grille).
  final bool idle;

  static Set<String> _assets = const {};

  static Future<void> init() async {
    try {
      final m = await AssetManifest.loadFromAssetBundle(rootBundle);
      _assets = m.listAssets().where((a) => a.startsWith('assets/illustrations/') || a.startsWith('assets/videos/')).toSet();
    } catch (_) {
      _assets = const {}; // manifeste illisible (tests) : replis partout
    }
  }

  static String path(String name) => 'assets/illustrations/$name.png';
  static String animPath(String name) => 'assets/illustrations/$name.json';

  /// L'illustration a été livrée.
  static bool has(String name) => _assets.contains(path(name));

  /// Son animation aussi.
  static bool hasAnim(String name) => _assets.contains(animPath(name));

  /// Un fichier précis du manifeste (illustrations, vidéos).
  static bool hasAsset(String path) => _assets.contains(path);

  @visibleForTesting
  static void debugSetAssets(Set<String> assets) => _assets = assets;

  @override
  Widget build(BuildContext context) {
    if (!has(name)) return fallback;
    return SizedBox(
      width: size,
      height: size,
      child: SuLottieArt(name, fit: fit, idle: idle && !name.startsWith('quick-'), staticChild: _png(name, size, fit, fallback)),
    );
  }

  static Widget _png(String name, double? size, BoxFit fit, Widget fallback, {Alignment alignment = Alignment.center}) => Image.asset(
        path(name),
        width: size,
        height: size,
        fit: fit,
        alignment: alignment,
        excludeFromSemantics: true,
        errorBuilder: (_, __, ___) => fallback,
      );
}

/// Lecteur partagé (illustrations et affiches). [staticChild] : l'image de repos.
class SuLottieArt extends StatefulWidget {
  const SuLottieArt(this.name, {super.key, required this.staticChild, this.fit = BoxFit.contain, this.alignment = Alignment.center, this.idle = true});
  final String name;
  final Widget staticChild;
  final BoxFit fit;
  final Alignment alignment;
  final bool idle;

  /// Boucles de respiration avant de se poser (≈ 12 s) : vivant, jamais insistant.
  static const int idleCycles = 3;

  @override
  State<SuLottieArt> createState() => _SuLottieArtState();
}

class _SuLottieArtState extends State<SuLottieArt> with SingleTickerProviderStateMixin {
  /// Créé seulement si l'animation joue : une illustration au repos n'a ni contrôleur ni ticker.
  AnimationController? _ctrl;
  AnimationController get _c => _ctrl ??= AnimationController(vsync: this);
  bool? _motion;
  bool _ambient = false;
  bool _loaded = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Décidé au montage : un changement de réglage vaut pour les prochaines illustrations.
    _motion ??= Feel.motion(context) && SuIllustration.hasAnim(widget.name);
    _ambient = Feel.ambient(context);
  }

  @override
  void dispose() {
    _ctrl?.dispose();
    super.dispose();
  }

  Future<void> _play(LottieComposition comp) async {
    final span = comp.endFrame - comp.startFrame;
    if (span <= 0) return;
    double at(double frame) => ((frame - comp.startFrame) / span).clamp(0.0, 1.0).toDouble();
    final idle = comp.markers.where((m) => m.name.trim() == 'idle').firstOrNull;
    final rest = idle != null ? at(idle.startFrame) : 1.0;
    final total = comp.duration;
    _c.duration = total;
    try {
      _c.value = 0;
      await _c.animateTo(rest, duration: total * rest, curve: Curves.linear).orCancel;
      if (idle == null || !widget.idle || !_ambient) return;
      for (var k = 0; k < SuLottieArt.idleCycles; k++) {
        if (!mounted) return;
        _c.value = rest;
        await _c.animateTo(1.0, duration: total * (1 - rest), curve: Curves.linear).orCancel;
      }
      if (mounted) _c.value = rest;
    } on TickerCanceled {
      // Écran fermé pendant l'animation : rien à faire.
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_motion != true) return widget.staticChild;
    return Lottie.asset(
      SuIllustration.animPath(widget.name),
      controller: _c,
      fit: widget.fit,
      alignment: widget.alignment,
      frameRate: FrameRate.max,
      onLoaded: (comp) {
        if (_loaded) return;
        _loaded = true;
        _play(comp);
      },
      // Tant que la composition n'est pas prête (≈ 1 image) : rien — l'intro part du vide.
      frameBuilder: (context, child, composition) => composition == null ? const SizedBox.expand() : child,
      errorBuilder: (context, error, stack) {
        debugPrint('SuLottieArt ${widget.name}: $error');
        return widget.staticChild;
      },
    );
  }
}
