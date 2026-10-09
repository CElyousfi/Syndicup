import 'package:flutter/material.dart';

import 'motion_tokens.g.dart';

export 'motion_tokens.g.dart';

/// Jetons de mouvement — générés depuis packages/config/motion/tokens.json (source unique web +
/// mobile, voir `SuTokens`). Seules transform / opacity s'animent ; tout décalage horizontal suit
/// le sens de lecture ; « animations réduites » (système ou réglage Sensations) pose chaque
/// élément sur son état final.
class SuMotion {
  SuMotion._();

  /// Retour tactile : enfoncement (vif) et relâchement (ressort).
  static const Duration press = SuTokens.press;
  static const Duration release = SuTokens.release;

  /// Bascule (interrupteur, case, segment, puce de filtre).
  static const Duration toggle = SuTokens.toggle;

  static const Duration fast = SuTokens.fast;
  static const Duration base = SuTokens.base;
  static const Duration slow = SuTokens.slow;
  static const Duration page = SuTokens.page;
  static const Duration stagger = SuTokens.stagger;
  static const Duration signature = SuTokens.signature;

  /// Sortie douce (cubic-bezier(.22,1,.36,1)).
  static const Curve easeOut = SuTokens.easeOut;
  static const Curve easeIn = SuTokens.easeIn;

  /// Ressort léger (dépassement ~6 %) — relâchements, pastilles qui apparaissent.
  static const Curve spring = SuTokens.spring;

  /// Nombre maximal d'éléments décalés dans une cascade (au-delà : même délai).
  static const int maxStagger = SuTokens.maxStagger;

  /// Feuilles du bas : montée douce, descente plus vive.
  static final AnimationStyle sheet = AnimationStyle(
    duration: SuTokens.sheetIn,
    reverseDuration: SuTokens.sheetOut,
    curve: easeOut,
    reverseCurve: easeIn,
  );

  static bool reduced(BuildContext context) => MediaQuery.maybeDisableAnimationsOf(context) ?? false;

  /// Durée effective : zéro quand l'utilisateur a demandé moins d'animations.
  static Duration of(BuildContext context, Duration d) => reduced(context) ? Duration.zero : d;

  /// +1 en LTR, −1 en RTL — pour tout décalage horizontal.
  static double sign(BuildContext context) => Directionality.of(context) == TextDirection.rtl ? -1 : 1;
}
