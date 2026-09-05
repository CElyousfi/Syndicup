import 'package:flutter/material.dart';

/// Design tokens — copie EXACTE de apps/web/app/globals.css (thème « Résidence » : fond greige
/// chaud, surfaces blanches très arrondies, encre #121212, accent vert sauge profond, accents
/// lilas / sable / tosca pour les pastilles d'icônes ; statuts armée / ambre / rouge profond).
/// Aucune couleur propre au mobile : tout vient du web (Master Spec 14.2, parité).
class SuColors {
  SuColors._();

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

  // Action — vert sauge profond (liens, focus, jauges, éléments actifs)
  static const Color action = Color(0xFF4C6C5A);
  static const Color actionDeep = Color(0xFF3D5A4A);
  static const Color actionTint = Color(0xFFE6EFEA);
  static const Color actionWash = Color(0xFFF2F6F3);

  // Accents secondaires — pastilles d'icônes, séries de graphiques
  static const Color sage = Color(0xFFA4C8AE);
  static const Color sageTint = Color(0xFFE6EFEA);
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

  // Alias conservés pour les écrans (même valeur que les tokens web ci-dessus).
  static const Color actionDark = actionDeep;
  static const Color actionSoft = sage;
  static const Color canvas = ground;
  /// Liserés de bannières : warn/30, danger/30, action/25, ok/30 (globals.css banner.tsx).
  static const Color warnBorder = Color(0x4D8A5A00);
  static const Color dangerSoft = Color(0x4D98140B);
  static const Color actionBorder = Color(0x404C6C5A);
  static const Color okBorder = Color(0x4D395917);
  /// Bordure de carte : rgb(32 31 35 / 0.05).
  static const Color cardBorder = Color(0x0D201F23);
  // Anciennes teintes « sombres » (maquette) — plus utilisées, mappées sur l'encre.
  static const Color darkBg = ink;
  static const Color darkSurface = inkStrong;
  static const Color darkHairline = Color(0xFF2E3230);
  static const Color darkText = faint;

  // Alias de compatibilité pour les écrans écrits avec les noms de la maquette bleue —
  // TOUS mappés sur la palette « Résidence » ci-dessus (aucune nouvelle couleur).
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

/// Rayons — globals.css : cartes 24 (22 sous lg, 20 pour les tuiles stat), pills 999,
/// champs 14, feuilles 28.
class SuRadius {
  SuRadius._();
  static const double card = 22;
  static const double tile = 20;
  static const double button = 999;
  static const double field = 14;
  static const double sheet = 28;
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

/// Ombres — --shadow-lift / --shadow-pop.
class SuShadows {
  SuShadows._();
  static const List<BoxShadow> lift = [
    BoxShadow(color: Color(0x08201F23), blurRadius: 2, offset: Offset(0, 1)),
    BoxShadow(color: Color(0x24201F23), blurRadius: 32, offset: Offset(0, 12), spreadRadius: -20),
  ];
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
