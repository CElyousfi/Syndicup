import 'package:flutter/material.dart';

/// Jetons de mouvement — miroir de apps/web/app/motion.css. Seules transform / opacity
/// s'animent ; tout décalage horizontal suit le sens de lecture ; « supprimer les
/// animations » (accessibilité système) pose chaque élément sur son état final.
class SuMotion {
  SuMotion._();

  static const Duration fast = Duration(milliseconds: 120);
  static const Duration base = Duration(milliseconds: 220);
  static const Duration slow = Duration(milliseconds: 350);
  static const Duration page = Duration(milliseconds: 320);
  static const Duration stagger = Duration(milliseconds: 45);

  /// Sortie douce (cubic-bezier(.22,1,.36,1)).
  static const Curve easeOut = Cubic(0.22, 1, 0.36, 1);
  static const Curve easeIn = Cubic(0.4, 0, 1, 1);

  /// Ressort léger (dépassement ~6 %) — relâchements, pastilles qui apparaissent.
  static const Curve spring = Cubic(0.34, 1.56, 0.64, 1);

  /// Nombre maximal d'éléments décalés dans une cascade (au-delà : même délai).
  static const int maxStagger = 12;

  /// Feuilles du bas : montée douce, descente plus vive.
  static final AnimationStyle sheet = AnimationStyle(
    duration: Duration(milliseconds: 420),
    reverseDuration: Duration(milliseconds: 260),
    curve: easeOut,
    reverseCurve: easeIn,
  );

  static bool reduced(BuildContext context) => MediaQuery.maybeDisableAnimationsOf(context) ?? false;

  /// Durée effective : zéro quand l'utilisateur a demandé moins d'animations.
  static Duration of(BuildContext context, Duration d) => reduced(context) ? Duration.zero : d;

  /// +1 en LTR, −1 en RTL — pour tout décalage horizontal.
  static double sign(BuildContext context) => Directionality.of(context) == TextDirection.rtl ? -1 : 1;
}
