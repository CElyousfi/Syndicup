import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'dict.dart';

export 'dict.dart';

/// Locales supportées — FR (référence) et AR (RTL). Master Spec Partie 13.1 / CLAUDE.md §1.6.
const List<Locale> supportedLocales = [Locale('fr'), Locale('ar')];

/// Interpolation simple : fill("Bonjour {nom}", {"nom": "Amina"}).
String fill(String template, Map<String, Object?> vars) {
  return template.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) {
    final v = vars[m.group(1)!];
    return v == null ? '{${m.group(1)}}' : v.toString();
  });
}

/// SharedPreferences chargées avant `runApp` (override dans main.dart).
final sharedPrefsProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError('sharedPrefsProvider doit être surchargé dans main.dart');
});

class LocaleController extends Notifier<Locale> {
  static const _key = 'locale';

  @override
  Locale build() {
    final saved = ref.read(sharedPrefsProvider).getString(_key);
    return saved == 'ar' ? const Locale('ar') : const Locale('fr');
  }

  Future<void> set(Locale locale) async {
    state = locale;
    await ref.read(sharedPrefsProvider).setString(_key, locale.languageCode);
  }

  /// Aligne la langue de l'interface sur `langue_preferee` du profil (FR | AR).
  Future<void> syncFromProfile(String? langue) async {
    if (langue == null) return;
    final l = langue == 'AR' ? const Locale('ar') : const Locale('fr');
    if (l != state) await set(l);
  }
}

final localeProvider = NotifierProvider<LocaleController, Locale>(LocaleController.new);

final dictProvider = Provider<Dict>((ref) {
  return ref.watch(localeProvider).languageCode == 'ar' ? dictAr : dictFr;
});

extension LocaleX on Locale {
  bool get isAr => languageCode == 'ar';
  bool get isRtl => isAr;
  Dict get dict => isAr ? dictAr : dictFr;
}

/// Accès pratique depuis un widget : `context.dict`, `context.locale`.
extension DictContext on BuildContext {
  Locale get locale => Localizations.localeOf(this);
  Dict get dict => locale.dict;
  bool get isRtl => locale.isRtl;
}
