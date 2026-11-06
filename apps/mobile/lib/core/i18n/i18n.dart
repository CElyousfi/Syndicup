import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'dict.dart';

export 'dict.dart';

/// Langues de l'interface — FR (référence), AR (RTL), puis les langues générées par
/// scripts/i18n/build.py (même liste que le web, apps/web/lib/i18n/core.ts). Un texte non
/// traduit retombe sur le français. Les documents à valeur probante (PDF, e-mails, convocations,
/// notifications serveur) restent en FR ou AR : `langue_preferee` du profil n'a que ces valeurs.
const List<String> appLanguages = ['fr', 'ar', 'en', 'es', 'it', 'de', 'nl', 'pt', 'ru', 'tr', 'zh'];

/// Nom de chaque langue dans sa propre langue (sélecteur).
const Map<String, String> languageNames = {
  'fr': 'Français',
  'ar': 'العربية',
  'en': 'English',
  'es': 'Español',
  'it': 'Italiano',
  'de': 'Deutsch',
  'nl': 'Nederlands',
  'pt': 'Português',
  'ru': 'Русский',
  'tr': 'Türkçe',
  'zh': '简体中文',
};

/// Drapeau affiché à côté du nom (l'arabe : le Maroc).
const Map<String, String> languageFlags = {
  'fr': '🇫🇷',
  'ar': '🇲🇦',
  'en': '🇬🇧',
  'es': '🇪🇸',
  'it': '🇮🇹',
  'de': '🇩🇪',
  'nl': '🇳🇱',
  'pt': '🇵🇹',
  'ru': '🇷🇺',
  'tr': '🇹🇷',
  'zh': '🇨🇳',
};

/// Locales déclarées à Flutter (MaterialApp.supportedLocales).
final List<Locale> supportedLocales = [
  for (final c in appLanguages) c == 'zh' ? const Locale.fromSubtags(languageCode: 'zh', scriptCode: 'Hans') : Locale(c),
];

/// Interpolation simple : fill("Bonjour {nom}", {"nom": "Amina"}).
String fill(String template, Map<String, Object?> vars) {
  return template.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) {
    final v = vars[m.group(1)!];
    return v == null ? '{${m.group(1)}}' : v.toString();
  });
}

/// Langue du téléphone → la première de ses langues préférées que l'app parle (sinon français).
Locale deviceLocale() {
  try {
    for (final l in PlatformDispatcher.instance.locales) {
      final c = l.languageCode.toLowerCase();
      if (c == 'zh' && (l.scriptCode == 'Hant' || const {'TW', 'HK', 'MO'}.contains(l.countryCode))) continue;
      if (appLanguages.contains(c)) return localeOf(c);
    }
  } catch (_) {
    // Plateforme sans liste de langues (tests) : français.
  }
  return const Locale('fr');
}

/// Locale Flutter d'un code de langue de l'app.
Locale localeOf(String code) => supportedLocales.firstWhere((l) => l.languageCode == code, orElse: () => const Locale('fr'));

/// Valeur `langue_preferee` (profil) d'une langue d'interface : FR | AR, ou null pour les autres.
String? languePrefereeOf(Locale l) => switch (l.languageCode) {'ar' => 'AR', 'fr' => 'FR', _ => null};

/// Langue des contenus produits par le serveur (PDF, Dari, liens d'invitation) : ar ou fr.
String langueServeurOf(Locale l) => l.languageCode == 'ar' ? 'ar' : 'fr';

/// SharedPreferences chargées avant `runApp` (override dans main.dart).
final sharedPrefsProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError('sharedPrefsProvider doit être surchargé dans main.dart');
});

/// Dernière langue d'interface connue — pour ce qui s'affiche hors de MaterialApp (carte
/// d'erreur d'affichage, isolate de notifications) ; français tant que rien n'est chargé.
Locale lastAppLocale = const Locale('fr');

class LocaleController extends Notifier<Locale> {
  static const _key = 'locale';

  @override
  Locale build() {
    final saved = ref.read(sharedPrefsProvider).getString(_key);
    return lastAppLocale = saved != null && appLanguages.contains(saved) ? localeOf(saved) : deviceLocale();
  }

  Future<void> set(Locale locale) async {
    state = lastAppLocale = localeOf(locale.languageCode);
    await ref.read(sharedPrefsProvider).setString(_key, state.languageCode);
  }

  /// Aligne la langue de l'interface sur `langue_preferee` du profil (FR | AR) — sauf si
  /// l'utilisateur a choisi une autre langue d'interface (anglais, espagnol…) : le profil ne
  /// connaît que FR | AR, il ne doit pas l'écraser.
  Future<void> syncFromProfile(String? langue) async {
    if (langue == null) return;
    if (languePrefereeOf(state) == null) return;
    final l = langue == 'AR' ? const Locale('ar') : const Locale('fr');
    if (l != state) await set(l);
  }
}

final localeProvider = NotifierProvider<LocaleController, Locale>(LocaleController.new);

final dictProvider = Provider<Dict>((ref) => ref.watch(localeProvider).dict);

extension LocaleX on Locale {
  bool get isAr => languageCode == 'ar';
  bool get isRtl => isAr;
  Dict get dict => dictByLang[languageCode] ?? dictFr;
}

/// Accès pratique depuis un widget : `context.dict`, `context.locale`.
extension DictContext on BuildContext {
  Locale get locale => Localizations.localeOf(this);
  Dict get dict => locale.dict;
  bool get isRtl => locale.isRtl;
}
