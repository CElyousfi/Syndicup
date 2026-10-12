import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/auth/biometric_lock.dart';
import 'core/auth/session.dart';
import 'core/feel/feel.dart';
import 'core/i18n/i18n.dart';
import 'core/router/router.dart';
import 'core/theme/app_theme.dart';
import 'core/update/update_gate.dart';
import 'features/auth/lock_screen.dart';
import 'features/auth/welcome_screen.dart';
import 'features/update/update_screens.dart';

class SyndicUpApp extends ConsumerStatefulWidget {
  const SyndicUpApp({super.key});

  @override
  ConsumerState<SyndicUpApp> createState() => _SyndicUpAppState();
}

class _SyndicUpAppState extends ConsumerState<SyndicUpApp> {
  // Retour au premier plan : drapeau alive_v1 et économiseur de batterie relus ; verrou
  // biométrique réarmé après 2 min en arrière-plan ; verdict de mise à jour rafraîchi.
  late final AppLifecycleListener _lifecycle = AppLifecycleListener(
    onResume: () {
      Feel.onResume();
      ref.read(lockedProvider.notifier).onResumed();
      ref.invalidate(updateVerdictProvider);
    },
    onPause: () => ref.read(lockedProvider.notifier).onPaused(),
  );

  @override
  void dispose() {
    _lifecycle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final locale = ref.watch(localeProvider);
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'SyndicUp',
      debugShowCheckedModeBanner: false,
      locale: locale,
      supportedLocales: supportedLocales,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: AppTheme.light(locale),
      routerConfig: router,
      builder: (context, child) => ListenableBuilder(
        listenable: Feel.changes,
        builder: (context, _) {
          // Lisibilité : l'échelle système est respectée mais bornée pour préserver les mises en
          // page (le minimum effectif reste ≥ 14 px — Partie 14.1).
          final mq = MediaQuery.of(context);
          // « Animations réduites » = préférence système OU réglage Sensations de l'utilisateur :
          // fusionnées ici, tout le code en aval ne lit que MediaQuery.disableAnimations.
          final reduced = mq.disableAnimations || Sensations.instance.prefs.value.reducedMotion;
          // Toutes les chaînes flutter_animate s'exécutent alors en zéro seconde et posent les
          // éléments sur leur état final.
          Animate.defaultDuration = reduced ? Duration.zero : const Duration(milliseconds: 300);
          return LocaleSwitchScope(
            onChange: (l) => ref.read(localeProvider.notifier).set(l),
            child: MediaQuery(
              data: mq.copyWith(textScaler: mq.textScaler.clamp(minScaleFactor: 1.0, maxScaleFactor: 1.3), disableAnimations: reduced),
              child: _Gates(child: child ?? const SizedBox.shrink()),
            ),
          );
        },
      ),
    );
  }
}


/// Portes au-dessus du routeur, dans l'ordre : mise à jour obligatoire (bloque tout), verrou
/// biométrique (si une session existe), bandeau de mise à jour conseillée (au-dessus du contenu).
class _Gates extends ConsumerWidget {
  const _Gates({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final verdict = ref.watch(updateVerdictProvider).valueOrNull ?? UpdateVerdict.none;
    if (verdict.statut == UpdateStatut.bloquer) return UpdateRequiredScreen(verdict: verdict);

    final locked = ref.watch(lockedProvider) && ref.watch(sessionProvider) != null;
    final body = verdict.statut == UpdateStatut.proposer
        ? Column(children: [UpdateBanner(verdict: verdict), Expanded(child: child)])
        : child;
    return Stack(
      fit: StackFit.expand,
      children: [
        body,
        if (locked) const LockScreen(),
      ],
    );
  }
}
