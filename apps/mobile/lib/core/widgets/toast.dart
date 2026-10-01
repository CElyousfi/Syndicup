import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../theme/motion.dart';
import '../theme/tokens.dart';

/// Toasts (toaster.tsx) : cartes blanches qui montent du bas en ressort, s'empilent (3 max),
/// se réorganisent en glissant, s'écartent d'un geste latéral ou d'un tap, et montrent leur
/// temps restant par un filet discret. Posés dans l'overlay racine : ils survivent à la
/// navigation qui suit souvent une action réussie.
class SuToaster {
  SuToaster._();

  static final Expando<_ToastHostState> _hosts = Expando<_ToastHostState>();

  static void show(BuildContext context, String message, {bool error = false, Duration duration = const Duration(milliseconds: 4200)}) {
    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    if (overlay == null) return;
    final existing = _hosts[overlay];
    if (existing != null && existing.mounted) {
      existing.add(message, error, duration);
      return;
    }
    final key = GlobalKey<_ToastHostState>();
    final entry = OverlayEntry(builder: (_) => _ToastHost(key: key));
    overlay.insert(entry);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final st = key.currentState;
      if (st == null) return;
      _hosts[overlay] = st;
      st.add(message, error, duration);
    });
  }
}

class _ToastData {
  _ToastData(this.id, this.message, this.error, this.duration);
  final int id;
  final String message;
  final bool error;
  final Duration duration;
  bool leaving = false;
}

class _ToastHost extends StatefulWidget {
  const _ToastHost({super.key});
  @override
  State<_ToastHost> createState() => _ToastHostState();
}

class _ToastHostState extends State<_ToastHost> {
  final List<_ToastData> _items = [];
  final List<Timer> _timers = [];
  int _seq = 0;

  void add(String message, bool error, Duration duration) {
    final d = _ToastData(++_seq, message, error, duration);
    setState(() {
      _items.add(d);
      while (_items.where((x) => !x.leaving).length > 3) {
        _items.firstWhere((x) => !x.leaving).leaving = true;
      }
    });
    _timers.add(Timer(duration, () => _leave(d)));
    _sweep();
  }

  void _leave(_ToastData d) {
    if (!mounted || d.leaving) return;
    setState(() => d.leaving = true);
    _sweep();
  }

  void _remove(_ToastData d) {
    if (!mounted) return;
    setState(() => _items.remove(d));
  }

  /// Retire de la liste les toasts dont l'animation de sortie est terminée.
  void _sweep() {
    _timers.add(Timer(const Duration(milliseconds: 320), () {
      if (!mounted) return;
      setState(() => _items.removeWhere((x) => x.leaving));
    }));
  }

  @override
  void dispose() {
    for (final t in _timers) {
      t.cancel();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    return Positioned(
      left: 12,
      right: 12,
      // Au-dessus de la barre d'onglets et du clavier.
      bottom: mq.viewPadding.bottom + mq.viewInsets.bottom + 82,
      child: IgnorePointer(
        ignoring: _items.isEmpty,
        child: AnimatedSize(
          duration: SuMotion.of(context, const Duration(milliseconds: 280)),
          curve: SuMotion.easeOut,
          alignment: Alignment.bottomCenter,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final d in _items)
                Padding(
                  key: ValueKey(d.id),
                  padding: const EdgeInsets.only(top: 8),
                  child: Dismissible(
                    key: ValueKey('dismiss-${d.id}'),
                    direction: DismissDirection.horizontal,
                    onDismissed: (_) => _remove(d),
                    child: _ToastCard(data: d, onTap: () => _leave(d)),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ToastCard extends StatelessWidget {
  const _ToastCard({required this.data, required this.onTap});
  final _ToastData data;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final reduced = SuMotion.reduced(context);
    final card = Material(
      color: SuColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(SuRadius.tile), side: const BorderSide(color: SuColors.hairline)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(color: data.error ? SuColors.dangerTint : SuColors.okTint, shape: BoxShape.circle),
                    child: Icon(data.error ? Icons.warning_amber_rounded : Icons.check_rounded, size: 17, color: data.error ? SuColors.danger : SuColors.ok),
                  ).animate().scaleXY(begin: reduced ? 1 : 0.4, end: 1, duration: 420.ms, delay: 80.ms, curve: SuMotion.spring),
                  const SizedBox(width: 12),
                  Expanded(child: Text(data.message, maxLines: 3, overflow: TextOverflow.ellipsis, style: t.bodyMedium?.copyWith(color: SuColors.ink, fontWeight: FontWeight.w600))),
                ],
              ),
            ),
            // Temps restant : filet qui se vide dans le sens de lecture.
            PositionedDirectional(
              start: 0,
              end: 0,
              bottom: 0,
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 1, end: 0),
                duration: data.duration,
                builder: (_, v, __) => FractionallySizedBox(
                  alignment: AlignmentDirectional.centerStart,
                  widthFactor: v,
                  child: Container(height: 2, color: SuColors.action.withValues(alpha: 0.25)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
    final shadowed = DecoratedBox(decoration: BoxDecoration(borderRadius: BorderRadius.circular(SuRadius.tile), boxShadow: SuShadows.pop), child: card);
    return Semantics(
      liveRegion: true,
      child: AnimatedOpacity(
        opacity: data.leaving ? 0 : 1,
        duration: SuMotion.of(context, const Duration(milliseconds: 220)),
        curve: SuMotion.easeIn,
        child: AnimatedScale(
          scale: data.leaving ? 0.94 : 1,
          duration: SuMotion.of(context, const Duration(milliseconds: 220)),
          curve: SuMotion.easeIn,
          child: reduced
              ? shadowed
              : shadowed
                  .animate()
                  .fadeIn(duration: 260.ms, curve: SuMotion.easeOut)
                  .slideY(begin: 0.45, end: 0, duration: 520.ms, curve: SuMotion.spring)
                  .scaleXY(begin: 0.95, end: 1, duration: 420.ms, curve: SuMotion.easeOut),
        ),
      ),
    );
  }
}
