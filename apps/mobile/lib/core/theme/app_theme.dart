import 'package:flutter/material.dart';

import 'tokens.dart';

/// Thème unique — langage Wise (refero.design : app iOS Wise, wise.com, wise.design) appliqué à
/// la palette « Résidence » :
///   • Inter partout (Noto Sans Arabic en tête en arabe) ; titres lourds (700) à l'approche
///     resserrée, corps 400, libellés 600 — jamais de 700 dans le corps ;
///   • toile blanche, tuiles greige plates, aucun relief ;
///   • action principale = pill sauge pleine, texte encre (rôle « lime » de Wise), 52 px ;
///   • action secondaire = pill contour vert profond ; liens soulignés vert profond.
class AppTheme {
  AppTheme._();

  static ThemeData light(Locale locale) {
    final bool ar = locale.languageCode == 'ar';
    final String family = ar ? 'NotoSansArabic' : 'Inter';
    final List<String> fallback = ar ? const ['Inter'] : const ['NotoSansArabic'];

    final TextTheme base = ThemeData.light().textTheme;
    // Approche négative proportionnelle à la taille (Wise : −0,03 em à l'affichage → −0,005 em
    // au corps) ; nulle en arabe, dont les liaisons ne supportent pas le resserrement.
    TextStyle s(double size, FontWeight w, {double? h, double em = 0, Color c = SuColors.ink}) => TextStyle(
          fontFamily: family,
          fontFamilyFallback: fallback,
          fontSize: size,
          fontWeight: w,
          height: h,
          letterSpacing: ar ? 0 : em * size,
          color: c,
        );

    // Échelle Wise mobile : titre d'écran 32/700 (« Account »), titres de section 22/700
    // (« Transactions »), titres de ligne 16/600, corps 15–16/400 ardoise, mentions 13 soft.
    final TextTheme text = base.copyWith(
      displayLarge: s(34, FontWeight.w700, h: 1.08, em: -0.03),
      displayMedium: s(30, FontWeight.w700, h: 1.1, em: -0.025),
      displaySmall: s(26, FontWeight.w700, h: 1.15, em: -0.02),
      headlineMedium: s(22, FontWeight.w700, h: 1.2, em: -0.015),
      headlineSmall: s(19, FontWeight.w700, h: 1.25, em: -0.01),
      titleLarge: s(17, FontWeight.w600, h: 1.3, em: -0.008),
      titleMedium: s(16, FontWeight.w600, h: 1.35, em: -0.006),
      titleSmall: s(15, FontWeight.w600, h: 1.35, em: -0.005),
      bodyLarge: s(16, FontWeight.w400, h: 1.5, em: -0.003, c: SuColors.inkStrong),
      bodyMedium: s(15, FontWeight.w400, h: 1.5, em: -0.003, c: SuColors.body),
      bodySmall: s(13.5, FontWeight.w400, h: 1.45, c: SuColors.soft),
      labelLarge: s(16, FontWeight.w600, h: 1.2, em: -0.005),
      labelMedium: s(14, FontWeight.w600, h: 1.2, c: SuColors.inkStrong),
      labelSmall: s(12.5, FontWeight.w500, h: 1.25, c: SuColors.faint),
    );

    const ColorScheme scheme = ColorScheme(
      brightness: Brightness.light,
      primary: SuColors.link,
      onPrimary: Colors.white,
      secondary: SuColors.cta,
      onSecondary: SuColors.onCta,
      error: SuColors.danger,
      onError: Colors.white,
      surface: SuColors.surface,
      onSurface: SuColors.ink,
      surfaceContainerHighest: SuColors.tile,
      outline: SuColors.hairlineStrong,
      outlineVariant: SuColors.hairline,
      primaryContainer: SuColors.actionTint,
      onPrimaryContainer: SuColors.actionDeep,
      tertiary: SuColors.ok,
      onTertiary: Colors.white,
    );

    final OutlineInputBorder border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(SuRadius.field),
      borderSide: const BorderSide(color: SuColors.hairlineStrong),
    );
    const StadiumBorder pill = StadiumBorder();

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: SuColors.surface,
      canvasColor: SuColors.surface,
      fontFamily: family,
      fontFamilyFallback: fallback,
      textTheme: text,
      splashFactory: InkSparkle.splashFactory,
      // Pas d'éclaboussure grise sur la toile blanche : la pression se lit par l'enfoncement
      // (SuPressable), comme dans l'app Wise.
      highlightColor: SuColors.wash,
      splashColor: SuColors.wash,
      // Navigation : zoom-fondu Android (desktop idem), glissé natif avec retour par geste (iOS).
      // Pas de FadeForwardsPageTransitionsBuilder : sous Flutter 3.29 il laisse parfois l'écran
      // d'accueil invisible après un rechargement de session (changement de langue) — reproduit
      // sur émulateur, absent avec le zoom.
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: ZoomPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.linux: ZoomPageTransitionsBuilder(),
          TargetPlatform.windows: ZoomPageTransitionsBuilder(),
        },
      ),
      // Retour / fermeture Wise partout (y compris les AppBar natives) : disque greige, glyphe
      // vert profond ; la flèche suit le sens de lecture.
      actionIconTheme: ActionIconThemeData(
        backButtonIconBuilder: (context) => const _RoundGlyph(Icons.arrow_back_rounded, mirror: true),
        closeButtonIconBuilder: (context) => const _RoundGlyph(Icons.close_rounded),
      ),
      dividerTheme: const DividerThemeData(color: SuColors.hairline, thickness: 1, space: 1),
      appBarTheme: AppBarTheme(
        toolbarHeight: 64,
        backgroundColor: SuColors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: text.headlineSmall,
        iconTheme: const IconThemeData(color: SuColors.link, size: 24),
        actionsIconTheme: const IconThemeData(color: SuColors.link, size: 24),
      ),
      cardTheme: CardTheme(
        color: SuColors.tile,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(SuRadius.card)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: SuColors.surface,
        border: border,
        enabledBorder: border,
        // Focus Wise : liseré encre franc (pas de couleur vive).
        focusedBorder: border.copyWith(borderSide: const BorderSide(color: SuColors.ink, width: 2)),
        errorBorder: border.copyWith(borderSide: const BorderSide(color: SuColors.danger)),
        focusedErrorBorder: border.copyWith(borderSide: const BorderSide(color: SuColors.danger, width: 2)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        hintStyle: text.bodyLarge?.copyWith(color: SuColors.faint),
        labelStyle: text.labelMedium,
        errorStyle: text.bodySmall?.copyWith(color: SuColors.danger),
      ),
      // Action principale : pill sauge pleine, texte encre, 52 px (bouton « Get started »).
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: SuColors.cta,
          foregroundColor: SuColors.onCta,
          disabledBackgroundColor: SuColors.wash,
          disabledForegroundColor: SuColors.faint,
          minimumSize: const Size.fromHeight(52),
          padding: const EdgeInsets.symmetric(horizontal: 24),
          textStyle: text.labelLarge,
          shape: pill,
          elevation: 0,
        ),
      ),
      // Action secondaire : pill contour vert profond.
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          backgroundColor: Colors.transparent,
          foregroundColor: SuColors.link,
          minimumSize: const Size.fromHeight(52),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          side: const BorderSide(color: SuColors.link, width: 1.2),
          textStyle: text.labelLarge,
          shape: pill,
        ),
      ),
      // Liens : vert profond, souligné, 600 (« See all »).
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: SuColors.link,
          minimumSize: const Size(44, 40),
          padding: const EdgeInsets.symmetric(horizontal: 10),
          textStyle: text.labelMedium?.copyWith(fontSize: 15, decoration: TextDecoration.underline, decorationThickness: 1.4),
          shape: pill,
        ),
      ),
      iconButtonTheme: IconButtonThemeData(style: IconButton.styleFrom(foregroundColor: SuColors.link)),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: SuColors.cta,
        foregroundColor: SuColors.onCta,
        elevation: 0,
        focusElevation: 0,
        hoverElevation: 0,
        highlightElevation: 0,
        shape: StadiumBorder(),
        extendedTextStyle: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
      ),
      // Puces Wise : contour fin, texte vert profond ; actives = pill sauge pleine.
      chipTheme: ChipThemeData(
        backgroundColor: SuColors.surface,
        selectedColor: SuColors.cta,
        side: const BorderSide(color: SuColors.hairlineStrong),
        labelStyle: text.labelMedium?.copyWith(color: SuColors.link),
        shape: const StadiumBorder(),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        showCheckmark: false,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: SuColors.surface,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        dragHandleColor: SuColors.hairlineStrong,
        dragHandleSize: Size(44, 5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(SuRadius.sheet))),
      ),
      dialogTheme: DialogTheme(
        backgroundColor: SuColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        titleTextStyle: text.headlineMedium,
        contentTextStyle: text.bodyMedium,
      ),
      // Notifications éphémères Wise : bloc encre, texte blanc.
      snackBarTheme: SnackBarThemeData(
        backgroundColor: SuColors.ink,
        contentTextStyle: text.bodyMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w600),
        actionTextColor: SuColors.cta,
        behavior: SnackBarBehavior.floating,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
      listTileTheme: const ListTileThemeData(minVerticalPadding: 12, iconColor: SuColors.link),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: SuColors.link, linearTrackColor: SuColors.wash, circularTrackColor: Colors.transparent),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? SuColors.ink : SuColors.surface),
        checkColor: const WidgetStatePropertyAll(Colors.white),
        side: const BorderSide(color: SuColors.hairlineStrong, width: 1.5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      ),
      radioTheme: RadioThemeData(fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? SuColors.ink : SuColors.hairlineStrong)),
      switchTheme: SwitchThemeData(
        thumbColor: const WidgetStatePropertyAll(Colors.white),
        trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? SuColors.link : SuColors.hairlineStrong),
        trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
      tabBarTheme: TabBarTheme(
        labelColor: SuColors.ink,
        unselectedLabelColor: SuColors.soft,
        indicatorColor: SuColors.ink,
        indicatorSize: TabBarIndicatorSize.label,
        labelStyle: text.labelMedium?.copyWith(fontSize: 15),
        unselectedLabelStyle: text.labelMedium?.copyWith(fontSize: 15, fontWeight: FontWeight.w500),
        dividerColor: SuColors.hairline,
      ),
      iconTheme: const IconThemeData(color: SuColors.body),
    );
  }
}

class _RoundGlyph extends StatelessWidget {
  const _RoundGlyph(this.icon, {this.mirror = false});
  final IconData icon;
  final bool mirror;
  @override
  Widget build(BuildContext context) {
    Widget g = Icon(icon, size: 22, color: SuColors.link);
    if (mirror && Directionality.of(context) == TextDirection.rtl) g = Transform.flip(flipX: true, child: g);
    return Container(width: 42, height: 42, decoration: const BoxDecoration(color: SuColors.tile, shape: BoxShape.circle), alignment: Alignment.center, child: g);
  }
}
