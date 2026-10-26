import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../api/api_result.dart';
import '../api/error_text.dart';
import '../i18n/i18n.dart';
import '../i18n/mobile_dict.dart';
import '../theme/motion.dart';
import '../theme/tokens.dart';
import '../feel/feel.dart';
import 'alive.dart';
import 'cards.dart';
import 'illustration.dart';
import 'su_art.dart';
import 'motion.dart';
import 'toast.dart';

/// État vide (empty-state.tsx) : carte, motif « résidence sous le soleil » en couleurs de la
/// palette, titre 15 px, aide 13 px soft, action.
class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.title, this.hint, this.icon, this.actionLabel, this.onAction, this.tone = Tone.sage, this.illustration});
  final String title;
  /// Nom d'illustration (`empty-incidents`…) : affichée si livrée, sinon le pictogramme.
  final String? illustration;
  final String? hint;
  final IconData? icon;
  final String? actionLabel;
  final VoidCallback? onAction;
  final Tone tone;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    // État vide Wise : pas de cadre — illustration, titre gras, aide ardoise, pill d'action.
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 28),
      child: Column(
        children: [
          SuEnter(offset: 0.15, child: SuIllustration(illustration ?? '', size: 200, fallback: icon == null ? const MotifResidence() : IconCircle(icon!, tone: tone, size: 72))),
          const SizedBox(height: 22),
          Text(title, style: t.headlineSmall, textAlign: TextAlign.center),
          if (hint != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(hint!, style: t.bodyMedium?.copyWith(color: SuColors.soft, height: 1.5), textAlign: TextAlign.center)),
          if (actionLabel != null) Padding(padding: const EdgeInsets.only(top: 22), child: SuEnter(index: 2, child: SuButton(label: actionLabel!, onPressed: onAction))),
        ],
      ),
    );
  }
}

/// MotifResidence — reproduction du SVG d'empty-state.tsx (132×88), vivant au repos comme
/// sur le web : le soleil flotte, des fenêtres s'éteignent un instant, les arbres se balancent.
/// Figé quand l'utilisateur a demandé moins d'animations.
class MotifResidence extends StatefulWidget {
  const MotifResidence({super.key});
  @override
  State<MotifResidence> createState() => _MotifResidenceState();
}

class _MotifResidenceState extends State<MotifResidence> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 9));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (SuMotion.reduced(context)) {
      _c.stop();
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizedBox(width: 132, height: 88, child: RepaintBoundary(child: CustomPaint(painter: _MotifPainter(_c))));
}

class _MotifPainter extends CustomPainter {
  _MotifPainter(this.t) : super(repaint: t);
  final Animation<double> t;

  @override
  void paint(Canvas c, Size s) {
    final ph = t.value * 2 * math.pi;
    final sunDy = -1.6 + 1.6 * math.cos(ph * 1.5);
    // Fenêtres qui s'éteignent brièvement, chacune à son tour.
    double win(double offset) {
      final x = (t.value + offset) % 1.0;
      return x > 0.78 && x < 0.86 ? 0.35 : 1.0;
    }
    final sway = 2.5 * math.pi / 180 * math.sin(ph * 1.8);
    Paint p(Color color, [double a = 1]) => Paint()..color = color.withValues(alpha: a);
    void rr(double x, double y, double w, double h, double r, Paint paint) => c.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x, y, w, h), Radius.circular(r)), paint);
    c.drawOval(Rect.fromCenter(center: const Offset(66, 80), width: 116, height: 14), p(SuColors.tile));
    c.drawCircle(Offset(106, 18 + sunDy), 10, p(SuColors.sandMid));
    c.drawCircle(Offset(106, 18 + sunDy), 6, p(SuColors.sandTint));
    rr(24, 26, 30, 54, 5, p(SuColors.sage, 0.55));
    for (final (x, y, a, o) in [(30.0, 34.0, 0.8, 0.1), (41.0, 34.0, 0.8, -1.0), (30.0, 46.0, 0.6, -1.0), (41.0, 46.0, 0.6, 0.55)]) {
      rr(x, y, 6, 6, 1.8, p(Colors.white, a * (o < 0 ? 1 : win(o))));
    }
    rr(50, 12, 38, 68, 5, p(SuColors.action));
    for (final (x, y, col, a, o) in [(57.0, 22.0, SuColors.sageTint, 1.0, -1.0), (74.0, 22.0, SuColors.sageTint, 1.0, 0.33), (57.0, 36.0, SuColors.sageTint, 0.85, 0.72), (74.0, 36.0, SuColors.sageTint, 0.85, -1.0), (57.0, 50.0, SuColors.sageTint, 0.6, 0.2), (74.0, 50.0, SuColors.sage, 0.9, -1.0)]) {
      rr(x, y, 7, 7, 2, p(col, a * (o < 0 ? 1 : win(o))));
    }
    rr(63, 64, 12, 16, 2.5, p(SuColors.sandMid));
    rr(92, 52, 22, 28, 4, p(SuColors.toscaMid));
    final roof = Path()..moveTo(103, 40)..lineTo(117, 52)..lineTo(89, 52)..close();
    c.drawPath(roof, p(SuColors.toscaDeep));
    rr(99.5, 62, 7, 18, 2, p(SuColors.toscaDeep, 0.7));
    // Arbres : balancement autour du pied du tronc.
    void tree(Offset foot, double angle, void Function() draw) {
      c.save();
      c.translate(foot.dx, foot.dy);
      c.rotate(angle);
      c.translate(-foot.dx, -foot.dy);
      draw();
      c.restore();
    }
    tree(const Offset(16, 81), sway, () {
      c.drawCircle(const Offset(16, 72), 8, p(SuColors.sage));
      rr(14.8, 72, 2.4, 9, 1.2, p(SuColors.moss));
    });
    tree(const Offset(122, 81), -sway * 0.8, () {
      c.drawCircle(const Offset(122, 74), 6, p(SuColors.sage, 0.8));
      rr(121, 74, 2, 7, 1, p(SuColors.moss));
    });
  }

  @override
  bool shouldRepaint(covariant _MotifPainter old) => old.t != t;
}

/// Chemins dont les lectures sont financières (jamais gardées sur le téléphone) : hors ligne, on
/// le dit au lieu d'un « pas de connexion » qui laisse croire à une copie manquante.
const _cheminsFinanciers = ['/finances', '/payer', '/justificatifs', '/especes', '/depenses', '/rapports', '/contrats'];

/// Erreur dans la langue de l'utilisateur, variante choisie d'après l'erreur (errorText) :
///  - 403 « Accès réservé » sans Réessayer ;
///  - 404 « Cet élément n'existe plus » + retour à la liste ;
///  - réseau sans copie locale → illustration hors ligne (finances : « pas conservées hors ligne ») ;
///  - 5xx → référence courte pour le support.
class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.error, this.onRetry, this.finance});
  final Object error;
  final VoidCallback? onRetry;

  /// Lecture financière (null = déduit de l'écran courant).
  final bool? finance;

  bool _estFinance(BuildContext context) {
    if (finance != null) return finance!;
    try {
      final path = GoRouterState.of(context).uri.path;
      return _cheminsFinanciers.any((p) => path == p || path.startsWith('$p/'));
    } catch (_) {
      return false; // hors du routeur (tests, feuilles)
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final ux = context.mdict.ux;
    final t = Theme.of(context).textTheme;
    final e = error;
    String title = d.common.errorTitle;
    String message = e is String && e.isNotEmpty ? e : d.common.errorBody;
    String? ref;
    var action = ErrorAction.retry;
    var offline = false;
    if (e is ApiException) {
      final x = e.text(context);
      title = x.title;
      message = x.body;
      ref = x.reference;
      action = x.action;
      offline = e.error.code == 'NETWORK' || e.error.code == 'TIMEOUT';
      if (e.error.code == 'NETWORK') {
        if (_estFinance(context)) {
          title = ux.financeOfflineTitle;
          message = ux.financeOfflineBody;
        } else {
          title = ux.offlineTitle;
          message = ux.offlineBody;
        }
      }
    }
    final Widget? bouton = switch (action) {
      ErrorAction.retry || ErrorAction.refresh => onRetry == null ? null : SuButton(label: action == ErrorAction.refresh ? ux.actRefresh : d.common.retry, variant: SuButtonVariant.secondary, onPressed: onRetry),
      ErrorAction.backToList => SuButton(
          label: ux.actBackToList,
          variant: SuButtonVariant.secondary,
          onPressed: () {
            final nav = Navigator.maybeOf(context);
            if (nav != null && nav.canPop()) {
              nav.pop();
            } else {
              GoRouter.maybeOf(context)?.go('/');
            }
          },
        ),
      ErrorAction.reconnect || ErrorAction.none => null,
    };
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Column(
        children: [
          // Planches du set (D01 hors ligne, D04 réservé, D05 erreur) quand livrées ; sinon pictogramme.
          Builder(builder: (context) {
            final forbidden = action == ErrorAction.none && e is ApiException && e.status == 403;
            final icon = IconCircle(forbidden ? Icons.lock_rounded : (action == ErrorAction.backToList ? Icons.search_off_rounded : Icons.priority_high_rounded), tone: Tone.warn, size: 64);
            if (offline) return const SuIllustration('offline', size: 170, fallback: IconCircle(Icons.wifi_off_rounded, tone: Tone.warn, size: 64));
            if (action == ErrorAction.backToList) return icon;
            return SuArtImage(forbidden ? SuArt.d04 : SuArt.d05, width: 170, height: 170, fallback: icon);
          }),
          const SizedBox(height: 16),
          Text(title, style: t.headlineSmall, textAlign: TextAlign.center),
          const SizedBox(height: 6),
          Text(message, style: t.bodySmall?.copyWith(height: 1.55), textAlign: TextAlign.center),
          if (ref != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(ref, style: t.labelSmall?.copyWith(fontFamily: 'GeistMono'), textAlign: TextAlign.center)),
          if (bouton != null) Padding(padding: const EdgeInsets.only(top: 18), child: bouton),
        ],
      ),
    );
  }
}

/// Squelettes (skeleton.tsx) : blocs hairline en pulsation.
class LoadingList extends StatelessWidget {
  const LoadingList({super.key, this.count = 4, this.height = 76});
  final int count;
  final double height;
  @override
  Widget build(BuildContext context) => Column(
        children: [
          for (int i = 0; i < count; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _Shimmer(child: Container(height: height, decoration: BoxDecoration(color: SuColors.tile, borderRadius: BorderRadius.circular(SuRadius.card)))),
            ),
        ],
      );
}

class _Shimmer extends StatefulWidget {
  const _Shimmer({required this.child});
  final Widget child;
  @override
  State<_Shimmer> createState() => _ShimmerState();
}

/// Reflet qui balaie le squelette dans le sens de lecture (gauche→droite, droite→gauche en arabe).
class _ShimmerState extends State<_Shimmer> {
  @override
  Widget build(BuildContext context) {
    if (SuMotion.reduced(context)) return widget.child;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return widget.child
        .animate(onPlay: (c) => c.repeat())
        .shimmer(duration: 1500.ms, delay: 200.ms, color: Colors.white.withValues(alpha: 0.7), angle: rtl ? math.pi + 0.35 : 0.35);
  }
}

/// Rend un AsyncValue en chargement / erreur / données, avec Réessayer.
class AsyncView<T> extends StatelessWidget {
  const AsyncView(this.value, {super.key, required this.data, this.onRetry, this.loading, this.skeletonCount = 4});
  final AsyncValue<T> value;
  final Widget Function(T data) data;
  final VoidCallback? onRetry;
  final Widget? loading;
  final int skeletonCount;

  @override
  Widget build(BuildContext context) {
    // Fondu enchaîné squelette → contenu, clé = PHASE (chargement / erreur / données) et non
    // les données : un rafraîchissement ou une mise à jour live ne rejoue jamais la transition.
    late final String phase;
    final child = value.when(
      skipLoadingOnRefresh: true,
      data: (v) {
        phase = 'd';
        return data(v);
      },
      loading: () {
        phase = 'l';
        return loading ?? LoadingList(count: skeletonCount);
      },
      error: (e, _) {
        phase = 'e';
        return ErrorState(error: e, onRetry: onRetry);
      },
    );
    return AnimatedSwitcher(
      duration: SuMotion.of(context, const Duration(milliseconds: 320)),
      reverseDuration: SuMotion.of(context, const Duration(milliseconds: 160)),
      switchInCurve: SuMotion.easeOut,
      switchOutCurve: SuMotion.easeIn,
      layoutBuilder: (current, previous) => Stack(alignment: Alignment.topCenter, children: [...previous, if (current != null) current]),
      transitionBuilder: (c, a) => FadeTransition(
        opacity: a,
        child: SlideTransition(position: Tween(begin: const Offset(0, 0.015), end: Offset.zero).animate(a), child: c),
      ),
      child: KeyedSubtree(key: ValueKey(phase), child: child),
    );
  }
}

/// Bannière (banner.tsx) : rayon 16, liseré coloré à 25–30 %, fond teinté, icône colorée,
/// titre semibold encre, corps 13 px body. `legal` = greige + liseré hairline-strong + bouclier.
enum BannerTone { info, warn, ok, danger, legal }

class SuBanner extends StatelessWidget {
  const SuBanner({super.key, this.title, required this.body, this.tone = BannerTone.info, this.action});
  final String? title;
  final String body;
  final BannerTone tone;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final (Color bg, Color border, Color iconColor, IconData icon) = switch (tone) {
      BannerTone.info => (SuColors.sageTint, Colors.transparent, SuColors.actionDeep, Icons.info_rounded),
      BannerTone.warn => (SuColors.warnTint, Colors.transparent, SuColors.warn, Icons.error_rounded),
      BannerTone.ok => (SuColors.okTint, Colors.transparent, SuColors.ok, Icons.check_circle_rounded),
      BannerTone.danger => (SuColors.dangerTint, Colors.transparent, SuColors.danger, Icons.error_rounded),
      BannerTone.legal => (SuColors.tile, Colors.transparent, SuColors.ink, Icons.shield_rounded),
    };
    // Vivant : une bannière qui apparaît (erreur de formulaire, avertissement) se déplie en
    // fondu au lieu de pousser le contenu d'un coup.
    final banner = Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20), border: border == Colors.transparent ? null : Border.all(color: border)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(padding: const EdgeInsets.only(top: 1), child: Icon(icon, color: iconColor, size: 22)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title != null) Padding(padding: const EdgeInsets.only(bottom: 3), child: Text(title!, style: t.titleSmall)),
                Text(body, style: t.bodyMedium?.copyWith(fontSize: 14, color: SuColors.body, height: 1.5)),
                if (action != null) Padding(padding: const EdgeInsets.only(top: 10), child: action!),
              ],
            ),
          ),
        ],
      ),
    );
    if (!Feel.alive) return banner;
    return Semantics(liveRegion: tone == BannerTone.danger || tone == BannerTone.warn, child: _Unfold(child: banner));
  }
}

/// Dépli + fondu au montage (bannières, messages d'état).
class _Unfold extends StatelessWidget {
  const _Unfold({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) {
    if (SuMotion.reduced(context)) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: SuTokens.base,
      curve: SuMotion.easeOut,
      child: child,
      builder: (_, t, ch) => ClipRect(
        child: Align(
          alignment: AlignmentDirectional.topStart,
          heightFactor: t,
          child: Opacity(opacity: t, child: ch),
        ),
      ),
    );
  }
}

/// Bannière « paramètre légal non configuré » (brief §6.3) — un état produit, pas un bug.
class LegalGateBanner extends StatelessWidget {
  const LegalGateBanner({super.key, this.message, this.onSettings});
  final String? message;
  final VoidCallback? onSettings;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    return SuBanner(
      tone: BannerTone.legal,
      title: d.legalGate.banner,
      body: message ?? d.legalGate.bannerBody,
      action: onSettings == null
          ? Text(d.legalGate.notABug, style: Theme.of(context).textTheme.labelSmall)
          : LinkButton(d.legalGate.goToSettings, onTap: onSettings),
    );
  }
}

/// Toast (toaster.tsx) : carte blanche, pastille teintée, titre 14 px semibold encre.
/// Animé, empilable, glissable pour fermer (voir toast.dart).
void showToast(BuildContext context, String message, {bool error = false}) {
  if (error) Haptics.error();
  SuToaster.show(context, message, error: error);
}

/// Toast d'erreur d'API dans la langue de l'utilisateur (errorText) — jamais `r.error.message` brut.
/// La référence de requête (8 caractères) suit le message pour les erreurs serveur.
void showApiError(BuildContext context, ApiFail<dynamic> fail) {
  if (!context.mounted) return;
  showToast(context, fail.text(context).line, error: true);
}

/// Toast de réussite, avec « Annuler » quand l'action a un inverse côté API.
void showDone(BuildContext context, String message, {String? undoLabel, VoidCallback? onUndo}) {
  if (!context.mounted) return;
  SuToaster.show(context, message, actionLabel: onUndo == null ? null : (undoLabel ?? context.mdict.ux.undo), onAction: onUndo, duration: onUndo == null ? const Duration(milliseconds: 4200) : const Duration(seconds: 6));
}
