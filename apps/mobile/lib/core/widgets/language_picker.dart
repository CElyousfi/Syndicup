import 'package:flutter/material.dart';

import '../i18n/i18n.dart';
import '../theme/tokens.dart';
import 'alive.dart';
import 'page.dart';

/// Feuille du bas « choisir la langue » : toutes les langues de l'interface, chacune écrite dans
/// sa propre langue, avec son drapeau ; la langue courante est cochée. Renvoie la locale choisie.
Future<Locale?> showLanguagePicker(BuildContext context, {required Locale current}) {
  return showSuSheet<Locale>(
    context,
    builder: (ctx) => SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        child: CardList([
          for (final code in appLanguages)
            ListRow(
              key: ValueKey(code),
              leading: Text(languageFlags[code] ?? '', style: const TextStyle(fontSize: 22)),
              title: languageNames[code] ?? code,
              trailing: code == current.languageCode ? const Icon(Icons.check_rounded, color: SuColors.link) : null,
              onTap: () => Navigator.pop(ctx, localeOf(code)),
            ),
        ]),
      ),
    ),
  );
}
