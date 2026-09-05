import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/i18n/i18n.dart';
import 'core/router/router.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/welcome_screen.dart';

class SyndicUpApp extends ConsumerWidget {
  const SyndicUpApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
      builder: (context, child) {
        // Lisibilité : l'échelle système est respectée mais bornée pour préserver les mises en
        // page (le minimum effectif reste ≥ 14 px — Partie 14.1).
        final mq = MediaQuery.of(context);
        return LocaleSwitchScope(
          onChange: (l) => ref.read(localeProvider.notifier).set(l),
          child: MediaQuery(
            data: mq.copyWith(textScaler: mq.textScaler.clamp(minScaleFactor: 1.0, maxScaleFactor: 1.3)),
            child: child ?? const SizedBox.shrink(),
          ),
        );
      },
    );
  }
}
