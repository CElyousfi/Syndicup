import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../feel/feel.dart';
import 'illustration.dart';

/// Illustration éditoriale ANIMÉE en vidéo (accueil, onboarding) — `assets/videos/<nom>.mp4`
/// (boucle sans couture, muette, ≈ 400 Ko) + `assets/videos/<nom>.jpg` (première image, affichée
/// tout de suite). Source et fabrication : docs/ALIVE_ILLUSTRATIONS.md § Illustrations vidéo.
///
///  - Image fixe seule (aucun décodage vidéo) si le mouvement d'ambiance est coupé : alive_v1 à
///    OFF, « Animations réduites » / préférence système, ou mode lite (appareil modeste,
///    économiseur de batterie).
///  - [active] : la vidéo ne joue que sur la page visible (onboarding) ; en pause sinon.
///  - Fichiers absents ou erreur de lecture : [fallback] (l'illustration Lottie existante).
class SuVideoArt extends StatefulWidget {
  const SuVideoArt(this.name, {super.key, required this.size, required this.fallback, this.active = true, this.radius = 28});
  final String name;
  final double size;
  final Widget fallback;
  final bool active;
  final double radius;

  static String videoPath(String name) => 'assets/videos/$name.mp4';
  static String posterPath(String name) => 'assets/videos/$name.jpg';

  @override
  State<SuVideoArt> createState() => _SuVideoArtState();
}

class _SuVideoArtState extends State<SuVideoArt> {
  VideoPlayerController? _ctrl;
  bool _ready = false;
  bool _failed = false;
  bool? _ambient;

  bool get _hasFiles => SuIllustration.hasAsset(SuVideoArt.posterPath(widget.name));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final ambient = Feel.ambient(context) && SuIllustration.hasAsset(SuVideoArt.videoPath(widget.name));
    if (_ambient == ambient) return;
    _ambient = ambient;
    if (ambient && _ctrl == null) _start();
    if (!ambient) _stop();
  }

  @override
  void didUpdateWidget(SuVideoArt old) {
    super.didUpdateWidget(old);
    if (old.active != widget.active) _sync();
  }

  Future<void> _start() async {
    final c = VideoPlayerController.asset(SuVideoArt.videoPath(widget.name), videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true));
    _ctrl = c;
    try {
      await c.initialize();
      await c.setLooping(true);
      await c.setVolume(0);
      if (!mounted || _ctrl != c) return;
      setState(() => _ready = true);
      _sync();
    } catch (e) {
      debugPrint('SuVideoArt ${widget.name}: $e');
      if (mounted) setState(() => _failed = true);
    }
  }

  void _sync() {
    final c = _ctrl;
    if (c == null || !_ready) return;
    widget.active ? c.play() : c.pause();
  }

  void _stop() {
    _ctrl?.dispose();
    _ctrl = null;
    _ready = false;
  }

  @override
  void dispose() {
    _ctrl?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_hasFiles || _failed) return widget.fallback;
    final c = _ctrl;
    return SizedBox.square(
      dimension: widget.size,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(widget.radius),
        child: Stack(fit: StackFit.expand, children: [
          Image.asset(SuVideoArt.posterPath(widget.name), fit: BoxFit.cover, excludeFromSemantics: true, gaplessPlayback: true, errorBuilder: (_, __, ___) => widget.fallback),
          if (c != null && _ready)
            // La première image de la vidéo est l'affiche : le passage de l'une à l'autre est invisible.
            FittedBox(fit: BoxFit.cover, clipBehavior: Clip.hardEdge, child: SizedBox(width: c.value.size.width, height: c.value.size.height, child: VideoPlayer(c))),
        ]),
      ),
    );
  }
}
