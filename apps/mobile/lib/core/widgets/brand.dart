import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// Marque SyndicUp : symbole (double chevron + hampe, docs/brand/symbole-*.svg) et wordmark
/// « syndic » encre / « up » vert (Archivo Black, police SuWordmark). Le nom ne se traduit pas
/// et le logo ne se miroite jamais en arabe.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 34, this.color = SuColors.brand});
  final double size;
  final Color color;
  @override
  Widget build(BuildContext context) => SizedBox(
        width: size,
        height: size,
        child: CustomPaint(painter: _SymbolPainter(color)),
      );
}

/// Icône d'app : symbole lime sur carré vert arrondi.
class BrandTile extends StatelessWidget {
  const BrandTile({super.key, this.size = 40});
  final double size;
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        padding: EdgeInsets.all(size * 0.2),
        decoration: BoxDecoration(color: SuColors.brand, borderRadius: BorderRadius.circular(size * 0.28)),
        child: BrandMark(size: size * 0.6, color: SuColors.lime),
      );
}

class _SymbolPainter extends CustomPainter {
  const _SymbolPainter(this.color);
  final Color color;

  // Repère 370 × 395 relevé sur la planche logo.
  static const _w = 370.0, _h = 395.0;
  static const _top = [Offset(0, 125), Offset(185, 0), Offset(370, 125), Offset(370, 225), Offset(185, 100), Offset(0, 225)];
  static const _bottom = [
    Offset(0, 280), Offset(185, 155), Offset(370, 280), Offset(370, 380), Offset(226, 282.7), //
    Offset(226, 395), Offset(144, 395), Offset(144, 282.7), Offset(0, 380),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final s = (size.width / _w) < (size.height / _h) ? size.width / _w : size.height / _h;
    final dx = (size.width - _w * s) / 2, dy = (size.height - _h * s) / 2;
    final paint = Paint()..color = color..isAntiAlias = true;
    for (final poly in [_top, _bottom]) {
      canvas.drawPath(Path()..addPolygon([for (final p in poly) Offset(dx + p.dx * s, dy + p.dy * s)], true), paint);
    }
  }

  @override
  bool shouldRepaint(_SymbolPainter old) => old.color != color;
}

class BrandWordmark extends StatelessWidget {
  const BrandWordmark({super.key, this.inverse = false, this.size = 22});
  final bool inverse;
  final double size;
  @override
  Widget build(BuildContext context) {
    return Text.rich(
      TextSpan(
        style: TextStyle(fontFamily: 'SuWordmark', fontSize: size, fontWeight: FontWeight.w900, height: 1.0, letterSpacing: -0.045 * size, color: inverse ? SuColors.lime : SuColors.ink),
        children: [const TextSpan(text: 'syndic'), TextSpan(text: 'up', style: TextStyle(color: inverse ? SuColors.lime : SuColors.brand))],
      ),
      textDirection: TextDirection.ltr,
    );
  }
}

/// Logo horizontal : symbole + wordmark, toujours de gauche à droite.
class Brand extends StatelessWidget {
  const Brand({super.key, this.inverse = false, this.size = 34});
  final bool inverse;
  final double size;
  @override
  Widget build(BuildContext context) => Directionality(
        textDirection: TextDirection.ltr,
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          BrandMark(size: size * 0.82, color: inverse ? SuColors.lime : SuColors.brand),
          SizedBox(width: size * 0.26),
          BrandWordmark(inverse: inverse, size: size * 0.74),
        ]),
      );
}
