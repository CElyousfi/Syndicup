# Langues de l'interface (web + mobile)

Français = référence (`apps/web/lib/i18n/fr.ts`, `apps/mobile/lib/core/i18n/mobile_dict.dart`), arabe écrit à la main (`ar.ts`, blocs `ar` de mobile_dict.dart). Les autres langues (en, es, it, de, nl, pt, ru, tr, zh) sont **générées** depuis la mémoire de traduction `translations/<code>.json` (texte français → traduction). Un texte non traduit retombe sur le français.

Les documents à valeur probante (PDF, e-mails, convocations, notifications envoyées par le serveur) restent en FR ou AR : `langue_preferee` du profil n'a que ces deux valeurs. Une autre langue d'interface est mémorisée sur l'appareil (cookie `su_locale` sur le web, préférences sur mobile) et laisse `langue_preferee` inchangée.

## Après avoir ajouté ou modifié des textes français

```bash
python3 scripts/i18n/extract.py --missing      # → scripts/i18n/work/source.json (textes à traduire)
# faire traduire selon BRIEF.md → work/out/<langue>.part*.json, puis merge.py <langue> (0 problème)
python3 scripts/i18n/build.py --ingest         # mémoire de traduction + fichiers web/mobile
```

Sans nouvelle traduction : `python3 scripts/i18n/build.py` régénère `apps/web/lib/i18n/locales/*`, `apps/mobile/lib/core/i18n/mobile_dict_l10n.dart` et `dict.dart` (via `apps/mobile/tool/gen_i18n.mjs`).

## Ajouter une langue
1. `LANGS` dans `scripts/i18n/common.py`, `LOCALES`/`LANG_NAMES`/`LANG_FLAGS`/`LANG_TAGS` dans `apps/web/lib/i18n/core.ts`, `appLanguages`/`languageNames`/`languageFlags` dans `apps/mobile/lib/core/i18n/i18n.dart`.
2. `extract.py --missing`, traduction, `build.py --ingest`.
3. Natif : `android/app/src/main/res/values-<code>/strings_{widgets,shortcuts}.xml`, `ios/SyndicUpWidgets/<code>.lproj/Localizable.strings`, `CFBundleLocalizations` (ios/Runner/Info.plist).
