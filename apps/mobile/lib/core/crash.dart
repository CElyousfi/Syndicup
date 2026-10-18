import 'dart:convert';
import 'dart:ui';

import 'package:flutter/material.dart';

import 'i18n/mobile_dict.dart';
import 'theme/tokens.dart';

/// Capture des plantages (CLAUDE.md §5 : jamais de catch silencieux, logs structurés JSON).
///
/// Aucun SDK de suivi n'est embarqué (sentry_flutter n'est pas une dépendance) : les erreurs sont
/// journalisées en JSON via `debugPrint` (logcat / console), sans PII — le jour où Sentry est
/// ajouté, il se branche ici, en un seul endroit.
class CrashCapture {
  CrashCapture._();

  static bool _installe = false;

  /// À appeler une fois, juste après `WidgetsFlutterBinding.ensureInitialized()`.
  static void install() {
    if (_installe) return;
    _installe = true;
    final precedent = FlutterError.onError;
    FlutterError.onError = (details) {
      log('flutter', details.exception, details.stack, contexte: details.context?.toDescription());
      // En debug, garder l'affichage console standard de Flutter (rouge, détaillé).
      if (kDebugMode) (precedent ?? FlutterError.presentError)(details);
    };
    PlatformDispatcher.instance.onError = (error, stack) {
      log('platform', error, stack);
      // Erreur asynchrone non rattrapée : journalisée, l'app continue (ne pas tuer le processus).
      return true;
    };
    ErrorWidget.builder = (details) {
      log('build', details.exception, details.stack, contexte: details.context?.toDescription());
      return CalmErrorCard(details: kDebugMode ? details : null);
    };
  }

  /// Ligne JSON : horodatage, niveau, source, type et message d'erreur, 8 premières frames.
  static void log(String source, Object error, StackTrace? stack, {String? contexte}) {
    final frames = (stack?.toString() ?? '').split('\n').where((l) => l.trim().isNotEmpty).take(8).toList();
    debugPrint(jsonEncode({
      'timestamp': DateTime.now().toUtc().toIso8601String(),
      'niveau': 'error',
      'source': source,
      'type': error.runtimeType.toString(),
      'message': error.toString(),
      if (contexte != null) 'contexte': contexte,
      'stack': frames,
    }));
  }
}

/// Carte calme qui remplace l'écran rouge d'un widget en erreur : jamais de pile en production,
/// un message dans la langue de l'utilisateur et l'invitation à revenir en arrière.
class CalmErrorCard extends StatelessWidget {
  const CalmErrorCard({super.key, this.details});

  /// Détails techniques (debug seulement).
  final FlutterErrorDetails? details;

  @override
  Widget build(BuildContext context) {
    // ErrorWidget peut être construit hors de MaterialApp / Localizations : tout est autonome.
    final locale = Localizations.maybeLocaleOf(context) ?? PlatformDispatcher.instance.locale;
    final ux = MobileDict.of(locale).ux;
    final rtl = locale.languageCode == 'ar';
    return Directionality(
      textDirection: rtl ? TextDirection.rtl : TextDirection.ltr,
      child: ColoredBox(
        color: SuColors.surface,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 360),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: SuColors.tile, borderRadius: BorderRadius.circular(SuRadius.card)),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.healing_rounded, size: 36, color: SuColors.link),
                  const SizedBox(height: 12),
                  Text(ux.renderErrorTitle, textAlign: TextAlign.center, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: SuColors.ink, decoration: TextDecoration.none)),
                  const SizedBox(height: 6),
                  Text(ux.renderErrorBody, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, height: 1.45, color: SuColors.body, fontWeight: FontWeight.w400, decoration: TextDecoration.none)),
                  if (details != null) ...[
                    const SizedBox(height: 10),
                    Text(details!.exceptionAsString(), maxLines: 4, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: const TextStyle(fontSize: 11, color: SuColors.soft, fontFamily: 'GeistMono', decoration: TextDecoration.none)),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
