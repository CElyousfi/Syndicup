import 'package:flutter/material.dart';

import 'tokens.dart';

/// Thème unique = système du web (globals.css + components/ui) : Geist (+ Noto Sans Arabic en
/// tête en arabe), corps 14 px, encre #121212, boutons pills encre, champs rayon 14 bord
/// hairline-strong, cartes blanches rayon 22, fond greige.
class AppTheme {
  AppTheme._();

  static ThemeData light(Locale locale) {
    final bool ar = locale.languageCode == 'ar';
    final String family = ar ? 'NotoSansArabic' : 'Geist';
    final List<String> fallback = ar ? const ['Geist'] : const ['NotoSansArabic'];

    final TextTheme base = ThemeData.light().textTheme;
    TextStyle s(double size, FontWeight w, {double? h, double? ls, Color c = SuColors.ink}) => TextStyle(
          fontFamily: family,
          fontFamilyFallback: fallback,
          fontSize: size,
          fontWeight: w,
          height: h,
          letterSpacing: ls,
          color: c,
        );

    // Échelle du web : h1 22 px (page-header mobile), titres de carte 15 px semibold, corps 14 px,
    // secondaires 13 px soft, mentions 12 px faint, valeurs stat 21 px (mobile) / 28 px.
    final TextTheme text = base.copyWith(
      displayLarge: s(28, FontWeight.w600, h: 1.1, ls: -0.6),
      displayMedium: s(24, FontWeight.w600, h: 1.2, ls: -0.5),
      displaySmall: s(22, FontWeight.w600, h: 1.2, ls: -0.4),
      headlineMedium: s(21, FontWeight.w600, h: 1.25, ls: -0.3),
      headlineSmall: s(17, FontWeight.w600, h: 1.3, ls: -0.2),
      titleLarge: s(16, FontWeight.w600, h: 1.3),
      titleMedium: s(15, FontWeight.w600, h: 1.35),
      titleSmall: s(14, FontWeight.w600, h: 1.35),
      bodyLarge: s(15, FontWeight.w400, h: 1.5, c: SuColors.inkStrong),
      bodyMedium: s(14, FontWeight.w400, h: 1.5, c: SuColors.body),
      bodySmall: s(13, FontWeight.w400, h: 1.45, c: SuColors.soft),
      labelLarge: s(14, FontWeight.w500, h: 1.2),
      labelMedium: s(13, FontWeight.w500, h: 1.2, c: SuColors.inkStrong),
      labelSmall: s(12, FontWeight.w500, h: 1.2, c: SuColors.faint),
    );

    const ColorScheme scheme = ColorScheme(
      brightness: Brightness.light,
      primary: SuColors.action,
      onPrimary: Colors.white,
      secondary: SuColors.ink,
      onSecondary: Colors.white,
      error: SuColors.danger,
      onError: Colors.white,
      surface: SuColors.surface,
      onSurface: SuColors.ink,
      surfaceContainerHighest: SuColors.ground,
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
    final RoundedRectangleBorder pill = RoundedRectangleBorder(borderRadius: BorderRadius.circular(SuRadius.button));

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: SuColors.ground,
      fontFamily: family,
      fontFamilyFallback: fallback,
      textTheme: text,
      splashFactory: InkSparkle.splashFactory,
      dividerTheme: const DividerThemeData(color: SuColors.hairline, thickness: 1, space: 1),
      appBarTheme: AppBarTheme(
        backgroundColor: SuColors.ground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: text.titleLarge,
        iconTheme: const IconThemeData(color: SuColors.ink, size: 22),
      ),
      cardTheme: CardTheme(
        color: SuColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(SuRadius.card), side: const BorderSide(color: SuColors.cardBorder)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: SuColors.surface,
        border: border,
        enabledBorder: border,
        focusedBorder: border.copyWith(borderSide: const BorderSide(color: SuColors.action, width: 1.5)),
        errorBorder: border.copyWith(borderSide: const BorderSide(color: SuColors.danger)),
        focusedErrorBorder: border.copyWith(borderSide: const BorderSide(color: SuColors.danger, width: 1.5)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        hintStyle: text.bodyMedium?.copyWith(color: SuColors.faint, fontSize: 16),
        labelStyle: text.labelMedium,
        errorStyle: text.bodySmall?.copyWith(color: SuColors.danger),
      ),
      // primary : bg-ink text-white rounded-btn (pill), h-11.
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: SuColors.ink,
          foregroundColor: Colors.white,
          disabledBackgroundColor: SuColors.ink.withValues(alpha: 0.45),
          disabledForegroundColor: Colors.white,
          minimumSize: const Size.fromHeight(44),
          padding: const EdgeInsets.symmetric(horizontal: 24),
          textStyle: text.labelLarge?.copyWith(fontWeight: FontWeight.w500),
          shape: pill,
        ),
      ),
      // secondary : bg-surface text-ink-strong border-hairline-strong, pill.
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          backgroundColor: SuColors.surface,
          foregroundColor: SuColors.inkStrong,
          minimumSize: const Size.fromHeight(44),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          side: const BorderSide(color: SuColors.hairlineStrong),
          textStyle: text.labelLarge?.copyWith(fontWeight: FontWeight.w500),
          shape: pill,
        ),
      ),
      // liens / ghost : text-action, 13 px medium.
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: SuColors.action,
          minimumSize: const Size(44, 40),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          textStyle: text.labelMedium?.copyWith(fontSize: 13),
          shape: pill,
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: SuColors.surface,
        selectedColor: SuColors.ink,
        side: const BorderSide(color: SuColors.hairlineStrong),
        labelStyle: text.labelMedium?.copyWith(fontSize: 13),
        shape: const StadiumBorder(),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        showCheckmark: false,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: SuColors.surface,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        dragHandleColor: SuColors.hairlineStrong,
        dragHandleSize: Size(40, 5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(SuRadius.sheet))),
      ),
      dialogTheme: DialogTheme(
        backgroundColor: SuColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(SuRadius.card)),
        titleTextStyle: text.titleLarge,
        contentTextStyle: text.bodyMedium,
      ),
      // Toasts = cartes blanches (toaster.tsx), jamais un bandeau sombre.
      snackBarTheme: SnackBarThemeData(
        backgroundColor: SuColors.surface,
        contentTextStyle: text.bodyMedium?.copyWith(color: SuColors.ink, fontWeight: FontWeight.w600),
        actionTextColor: SuColors.action,
        behavior: SnackBarBehavior.floating,
        elevation: 6,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(SuRadius.tile), side: const BorderSide(color: SuColors.hairline)),
      ),
      listTileTheme: const ListTileThemeData(minVerticalPadding: 12),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: SuColors.action),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? SuColors.action : SuColors.surface),
        side: const BorderSide(color: SuColors.hairlineStrong, width: 1.2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5)),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: const WidgetStatePropertyAll(Colors.white),
        trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? SuColors.action : SuColors.hairlineStrong),
        trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
      tabBarTheme: TabBarTheme(
        labelColor: SuColors.ink,
        unselectedLabelColor: SuColors.soft,
        indicatorColor: SuColors.action,
        labelStyle: text.labelMedium,
        unselectedLabelStyle: text.labelMedium,
        dividerColor: SuColors.hairline,
      ),
      iconTheme: const IconThemeData(color: SuColors.body),
    );
  }
}
