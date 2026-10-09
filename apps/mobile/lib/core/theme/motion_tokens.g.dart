// GÉNÉRÉ par packages/config/motion/gen.mjs depuis tokens.json — ne pas modifier à la main.
// ignore_for_file: constant_identifier_names
import 'package:flutter/animation.dart';
import 'package:flutter/physics.dart';

class SuTokens {
  SuTokens._();

  static const Duration press = Duration(milliseconds: 100);
  static const Duration toggle = Duration(milliseconds: 120);
  static const Duration release = Duration(milliseconds: 360);
  static const Duration fast = Duration(milliseconds: 180);
  static const Duration base = Duration(milliseconds: 260);
  static const Duration page = Duration(milliseconds: 320);
  static const Duration slow = Duration(milliseconds: 400);
  static const Duration sheetIn = Duration(milliseconds: 400);
  static const Duration sheetOut = Duration(milliseconds: 260);
  static const Duration number = Duration(milliseconds: 900);
  static const Duration highlight = Duration(milliseconds: 1200);
  static const Duration signature = Duration(milliseconds: 700);
  static const Duration signatureMax = Duration(milliseconds: 1200);
  static const Duration stagger = Duration(milliseconds: 35);
  static const int maxStagger = 8;
  static const double distXs = 8;
  static const double distSm = 16;
  static const double distMd = 24;
  static const double pressButton = 0.965;
  static const double pressCard = 0.98;
  static const double pressRow = 0.985;
  static const double pressChip = 0.94;
  static const double pressIcon = 0.9;
  static const Curve easeOut = Cubic(0.22, 1, 0.36, 1);
  static const Curve easeIn = Cubic(0.4, 0, 1, 1);
  static const Curve spring = Cubic(0.34, 1.56, 0.64, 1);
  static const SpringDescription snappy = SpringDescription(mass: 0.7, stiffness: 520, damping: 34);
  static const SpringDescription smooth = SpringDescription(mass: 0.9, stiffness: 380, damping: 34);
  static const SpringDescription gentle = SpringDescription(mass: 1, stiffness: 180, damping: 22);
  static const Duration hapticThrottle = Duration(milliseconds: 80);
}
