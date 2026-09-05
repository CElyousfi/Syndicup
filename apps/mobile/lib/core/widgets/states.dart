import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_result.dart';
import '../i18n/i18n.dart';
import '../i18n/mobile_dict.dart';
import '../theme/tokens.dart';
import 'cards.dart';

/// État vide (empty-state.tsx) : carte, motif « résidence sous le soleil » en couleurs de la
/// palette, titre 15 px, aide 13 px soft, action.
class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.title, this.hint, this.icon, this.actionLabel, this.onAction, this.tone = Tone.sage});
  final String title;
  final String? hint;
  final IconData? icon;
  final String? actionLabel;
  final VoidCallback? onAction;
  final Tone tone;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return SuCard(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
      child: Column(
        children: [
          icon == null ? const MotifResidence() : IconCircle(icon!, tone: tone, size: 64),
          const SizedBox(height: 22),
          Text(title, style: t.titleMedium, textAlign: TextAlign.center),
          if (hint != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(hint!, style: t.bodySmall?.copyWith(height: 1.55), textAlign: TextAlign.center)),
          if (actionLabel != null) Padding(padding: const EdgeInsets.only(top: 22), child: FilledButton(onPressed: onAction, style: FilledButton.styleFrom(minimumSize: const Size(0, 44)), child: Text(actionLabel!))),
        ],
      ),
    );
  }
}

/// MotifResidence — reproduction du SVG d'empty-state.tsx (132×88).
class MotifResidence extends StatelessWidget {
  const MotifResidence({super.key});
  @override
  Widget build(BuildContext context) => const SizedBox(width: 132, height: 88, child: CustomPaint(painter: _MotifPainter()));
}

class _MotifPainter extends CustomPainter {
  const _MotifPainter();
  @override
  void paint(Canvas c, Size s) {
    Paint p(Color color, [double a = 1]) => Paint()..color = color.withValues(alpha: a);
    void rr(double x, double y, double w, double h, double r, Paint paint) => c.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x, y, w, h), Radius.circular(r)), paint);
    c.drawOval(Rect.fromCenter(center: const Offset(66, 80), width: 116, height: 14), p(SuColors.ground));
    c.drawCircle(const Offset(106, 18), 10, p(SuColors.sandMid));
    c.drawCircle(const Offset(106, 18), 6, p(SuColors.sandTint));
    rr(24, 26, 30, 54, 5, p(SuColors.sage, 0.55));
    for (final (x, y, a) in [(30.0, 34.0, 0.8), (41.0, 34.0, 0.8), (30.0, 46.0, 0.6), (41.0, 46.0, 0.6)]) {
      rr(x, y, 6, 6, 1.8, p(Colors.white, a));
    }
    rr(50, 12, 38, 68, 5, p(SuColors.action));
    for (final (x, y, col, a) in [(57.0, 22.0, SuColors.sageTint, 1.0), (74.0, 22.0, SuColors.sageTint, 1.0), (57.0, 36.0, SuColors.sageTint, 0.85), (74.0, 36.0, SuColors.sageTint, 0.85), (57.0, 50.0, SuColors.sageTint, 0.6), (74.0, 50.0, SuColors.sage, 0.9)]) {
      rr(x, y, 7, 7, 2, p(col, a));
    }
    rr(63, 64, 12, 16, 2.5, p(SuColors.sandMid));
    rr(92, 52, 22, 28, 4, p(SuColors.toscaMid));
    final roof = Path()..moveTo(103, 40)..lineTo(117, 52)..lineTo(89, 52)..close();
    c.drawPath(roof, p(SuColors.toscaDeep));
    rr(99.5, 62, 7, 18, 2, p(SuColors.toscaDeep, 0.7));
    c.drawCircle(const Offset(16, 72), 8, p(SuColors.sage));
    rr(14.8, 72, 2.4, 9, 1.2, p(SuColors.moss));
    c.drawCircle(const Offset(122, 74), 6, p(SuColors.sage, 0.8));
    rr(121, 74, 2, 7, 1, p(SuColors.moss));
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}

/// Erreur avec référence pour le support (request_id) et bouton Réessayer.
class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.error, this.onRetry});
  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final e = error;
    final String message;
    final String? ref;
    if (e is ApiException) {
      message = e.error.code == 'NETWORK'
          ? (e.error.message.contains('Délai') ? context.mdict.timeoutError : context.mdict.networkError)
          : (e.status >= 500 ? d.common.errorBody : e.error.message);
      ref = e.requestId;
    } else {
      message = d.common.errorBody;
      ref = null;
    }
    return SuCard(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
      child: Column(
        children: [
          const IconCircle(Icons.error_outline_rounded, tone: Tone.danger, size: 56),
          const SizedBox(height: 14),
          Text(d.common.errorTitle, style: t.titleMedium, textAlign: TextAlign.center),
          const SizedBox(height: 6),
          Text(message, style: t.bodySmall?.copyWith(height: 1.55), textAlign: TextAlign.center),
          if (ref != null && ref.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text(fill(d.common.errorReference, {'id': ref}), style: t.labelSmall?.copyWith(fontFamily: 'GeistMono'), textAlign: TextAlign.center)),
          if (onRetry != null) Padding(padding: const EdgeInsets.only(top: 18), child: OutlinedButton(onPressed: onRetry, style: OutlinedButton.styleFrom(minimumSize: const Size(0, 44)), child: Text(d.common.retry))),
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
              child: _Shimmer(child: Container(height: height, decoration: BoxDecoration(color: SuColors.hairline, borderRadius: BorderRadius.circular(SuRadius.card)))),
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

class _ShimmerState extends State<_Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1000))..repeat(reverse: true);
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(opacity: Tween(begin: 0.5, end: 1.0).animate(_c), child: widget.child);
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
    return value.when(
      skipLoadingOnRefresh: true,
      data: data,
      loading: () => loading ?? LoadingList(count: skeletonCount),
      error: (e, _) => ErrorState(error: e, onRetry: onRetry),
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
      BannerTone.info => (SuColors.actionWash, SuColors.actionBorder, SuColors.action, Icons.info_outline_rounded),
      BannerTone.warn => (SuColors.warnTint, SuColors.warnBorder, SuColors.warn, Icons.warning_amber_rounded),
      BannerTone.ok => (SuColors.okTint, SuColors.okBorder, SuColors.ok, Icons.info_outline_rounded),
      BannerTone.danger => (SuColors.dangerTint, SuColors.dangerSoft, SuColors.danger, Icons.warning_amber_rounded),
      BannerTone.legal => (SuColors.ground, SuColors.hairlineStrong, SuColors.soft, Icons.shield_outlined),
    };
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16), border: Border.all(color: border)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(padding: const EdgeInsets.only(top: 2), child: Icon(icon, color: iconColor, size: 18)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title != null) Padding(padding: const EdgeInsets.only(bottom: 2), child: Text(title!, style: t.bodyMedium?.copyWith(color: SuColors.inkStrong, fontWeight: FontWeight.w600))),
                Text(body, style: t.bodySmall?.copyWith(color: SuColors.body, height: 1.55)),
                if (action != null) Padding(padding: const EdgeInsets.only(top: 10), child: action!),
              ],
            ),
          ),
        ],
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
          : TextButton(onPressed: onSettings, style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 36)), child: Text(d.legalGate.goToSettings)),
    );
  }
}

/// Toast (toaster.tsx) : carte blanche, pastille teintée, titre 14 px semibold encre.
void showToast(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(color: error ? SuColors.dangerTint : SuColors.okTint, shape: BoxShape.circle),
              child: Icon(error ? Icons.warning_amber_rounded : Icons.check_rounded, size: 17, color: error ? SuColors.danger : SuColors.ok),
            ),
            const SizedBox(width: 12),
            Expanded(child: Text(message, maxLines: 3, overflow: TextOverflow.ellipsis)),
          ],
        ),
      ),
    );
}
