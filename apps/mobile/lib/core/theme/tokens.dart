import 'package:flutter/material.dart';

/// Design tokens — couleurs du LOGO SyndicUp (vert marque #1E7552, lime #E3EF8D, encre, greige),
/// distribuées selon la GRAMMAIRE du langage Wise (refero.design, app iOS Wise + wise.design) :
///   • toile blanche, tuiles greige plates, aucune ombre portée sur le contenu ;
///   • l'appel à l'action est une pill PLEINE lime au texte encre (15:1) — rôle réservé aux
///     actions principales et aux états actifs ;
///   • liens et accents interactifs en vert marque, soulignés ;
///   • une « salle de marque » (vert, comme le logo inversé) pour les cartes-affiches, titre lime.
/// Les tons secondaires (lilas / sable / tosca) et les statuts restent ceux de la palette Résidence.
class SuColors {
  SuColors._();

  // Logo
  /// Vert marque (chevron du logo, « up »). 5,6:1 sur blanc, 4,7:1 sur greige.
  static const Color brand = Color(0xFF1E7552);
  /// Vert marque appuyé : texte sur teintes vertes, états pressés.
  static const Color brandDeep = Color(0xFF17603F);
  /// Lime du logo inversé.
  static const Color lime = Color(0xFFE3EF8D);

  // Rôles Wise (voir en-tête).
  /// Remplissage des pills d'action principale (rôle « lime » de Wise). Contraste encre : 15:1.
  static const Color cta = lime;
  static const Color onCta = ink;
  /// Liens, onglets actifs, accents interactifs (rôle « forest » de Wise).
  static const Color link = brand;
  /// Tuiles et surfaces secondaires (rôle « ash gray » de Wise).
  static const Color tile = ground;
  /// Voile d'encre translucide : pistes de jauge, pastilles neutres — lisible sur blanc ET greige.
  static const Color wash = Color(0x10121212);
  static const Color washStrong = Color(0x1C121212);

  // Encre & neutres (chauds, jamais bleutés)
  static const Color ink = Color(0xFF121212);
  static const Color inkStrong = Color(0xFF201F23);
  static const Color body = Color(0xFF45515C);
  static const Color soft = Color(0xFF596269);
  static const Color faint = Color(0xFF7D8583);
  static const Color hairline = Color(0xFFE9E7DF);
  static const Color hairlineStrong = Color(0xFFD9D6CB);
  static const Color ground = Color(0xFFECEBE4);
  static const Color hover = Color(0xFFF7F6F2);
  static const Color surface = Color(0xFFFFFFFF);

  // Action — vert marque (liens, focus, jauges, éléments actifs)
  static const Color action = brand;
  static const Color actionDeep = brandDeep;
  static const Color actionTint = Color(0xFFE2EEE7);
  static const Color actionWash = Color(0xFFF0F6F2);

  // Accents secondaires — pastilles d'icônes, séries de graphiques
  static const Color sage = Color(0xFFA4C8AE);
  static const Color sageTint = actionTint;
  static const Color moss = Color(0xFF617C6C);
  static const Color army = Color(0xFF395917);
  static const Color lilac = Color(0xFF595D75);
  static const Color lilacMid = Color(0xFFB8BED5);
  static const Color lilacTint = Color(0xFFE3E4EA);
  static const Color sand = Color(0xFFA39170);
  static const Color sandMid = Color(0xFFE5D6B8);
  static const Color sandTint = Color(0xFFF1EAD9);
  static const Color toscaDeep = Color(0xFF48707A);
  static const Color toscaMid = Color(0xFFC1D8DA);
  static const Color toscaTint = Color(0xFFE4EEEF);

  // Statuts
  static const Color ok = Color(0xFF395917);
  static const Color okTint = Color(0xFFE9F0DD);
  static const Color warn = Color(0xFF8A5A00);
  static const Color warnTint = Color(0xFFF5ECDA);
  static const Color danger = Color(0xFF98140B);
  static const Color dangerTint = Color(0xFFF8E9E7);

  // Alias conservés pour les écrans.
  static const Color actionDark = actionDeep;
  static const Color actionSoft = sage;
  static const Color canvas = ground;
  /// Liserés de bannières : warn/30, danger/30, action/25, ok/30 (globals.css banner.tsx).
  static const Color warnBorder = Color(0x4D8A5A00);
  static const Color dangerSoft = Color(0x4D98140B);
  static const Color actionBorder = Color(0x401E7552);
  static const Color okBorder = Color(0x4D395917);
  /// Bordure de carte : rgb(32 31 35 / 0.05).
  static const Color cardBorder = Color(0x0D201F23);
  // Anciennes teintes « sombres » (maquette) — plus utilisées, mappées sur l'encre.
  static const Color darkBg = ink;
  static const Color darkSurface = inkStrong;
  static const Color darkHairline = Color(0xFF2E3230);
  static const Color darkText = faint;

  // Alias de compatibilité pour les écrans écrits avec les noms de la maquette bleue —
  // TOUS mappés sur la palette ci-dessus (aucune nouvelle couleur).
  static const Color blue700 = actionDeep;
  static const Color blue600 = action;
  static const Color blue500 = action;
  static const Color blue400 = moss;
  static const Color blue300 = sage;
  static const Color blue100 = actionTint;
  static const Color amber600 = warn;
  static const Color amber500 = sand;
  static const Color amber400 = sandMid;
  static const Color yellow400 = sandMid;
  static const Color cream100 = sandTint;
  static const Color green500 = ok;
  static const Color red500 = danger;
  static const Color bg = ground;
  static const Color bgAlt = hover;
  static const Color surfaceHover = hover;
  static const Color border = hairlineStrong;
  static const Color text = ink;
  static const Color textMuted = soft;
  static const Color textFaint = faint;
  static const Color onBrand = Color(0xFFFFFFFF);
}

/// Compatibilité : la maquette bleue utilisait des dégradés ; le thème « Résidence » n'en a
/// pas — dégradés quasi plats sur les teintes de la palette (cartes héro, tuiles).
class SuGradients {
  SuGradients._();
  static const LinearGradient hero = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [SuColors.action, SuColors.actionDeep]);
  static const LinearGradient sky = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [SuColors.toscaMid, SuColors.toscaDeep]);
  static const LinearGradient amber = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [SuColors.sandMid, SuColors.sand]);
}

/// Rayons — Wise : grands rayons doux sur les blocs de contenu (cartes/tuiles 24), pills pour
/// tout ce qui est interactif (boutons, puces, recherche), feuilles 32.
class SuRadius {
  SuRadius._();
  static const double card = 24;
  static const double tile = 24;
  static const double button = 999;
  static const double field = 14;
  static const double sheet = 32;
  static const double pill = 999;
  static const double base = 8;
  // Alias de compatibilité (maquette bleue) → rayons « Résidence ».
  static const double hero = 24;
  static const double row = card;
  static const double nav = sheet;
}

class SuSpace {
  SuSpace._();
  static const double xs = 4;
  static const double s = 8;
  static const double m = 12;
  static const double l = 16;
  static const double xl = 24;
  static const double xxl = 32;
}

/// Ombres — Wise n'en porte aucune sur le contenu (la hiérarchie vient de la couleur et de
/// l'échelle) : `lift` est vide. `pop` / `float` restent pour ce qui flotte VRAIMENT au-dessus
/// de l'écran (toasts, bouton d'action central).
class SuShadows {
  SuShadows._();
  static const List<BoxShadow> lift = [];
  static const List<BoxShadow> pop = [
    BoxShadow(color: Color(0x38201F23), blurRadius: 48, offset: Offset(0, 24), spreadRadius: -16),
    BoxShadow(color: Color(0x14201F23), blurRadius: 12, offset: Offset(0, 4), spreadRadius: -4),
  ];
  /// --shadow-float : barre d'onglets, panneaux flottants.
  static const List<BoxShadow> float = [
    BoxShadow(color: Color(0x0A201F23), blurRadius: 6, offset: Offset(0, 2)),
    BoxShadow(color: Color(0x2E201F23), blurRadius: 44, offset: Offset(0, 20), spreadRadius: -24),
  ];
  static const List<BoxShadow> nav = float;
}

/// Typographie « affiche » (Wise Sans 900 → Archivo semi-condensé Black ; Noto Kufi Arabic en
/// arabe) : réservée aux moments de marque — onboarding, accueil, cartes-affiches. Jamais pour
/// l'interface courante (Inter). Capitales en latin, interlignage serré (0,9) ; l'arabe garde
/// un interlignage normal (pas de capitales, ascendantes hautes).
class SuType {
  SuType._();

  static TextStyle poster(BuildContext context, double size, {Color color = SuColors.ink}) {
    final ar = Localizations.maybeLocaleOf(context)?.languageCode == 'ar';
    return TextStyle(
      fontFamily: ar ? 'SuDisplayAr' : 'SuDisplay',
      fontFamilyFallback: ar ? const ['SuDisplay'] : const ['SuDisplayAr'],
      fontWeight: ar ? FontWeight.w800 : FontWeight.w900,
      fontSize: ar ? size * 0.82 : size,
      height: ar ? 1.35 : 1.0,
      letterSpacing: ar ? 0 : -0.01 * size,
      color: color,
    );
  }

  /// Texte d'affiche : capitales en latin uniquement.
  static String posterText(BuildContext context, String s) => Localizations.maybeLocaleOf(context)?.languageCode == 'ar' ? s : s.toUpperCase();
}
