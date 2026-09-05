import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// Marque SyndicUp (components/brand.tsx) : logo officiel + wordmark « Syndic » encre /
/// « Up » action. Le nom produit ne se traduit pas.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 34});
  final double size;
  @override
  Widget build(BuildContext context) => Image.asset('assets/images/logo.png', width: size, height: size);
}

class BrandWordmark extends StatelessWidget {
  const BrandWordmark({super.key, this.inverse = false});
  final bool inverse;
  @override
  Widget build(BuildContext context) {
    return Text.rich(
      TextSpan(
        style: TextStyle(fontFamily: 'Geist', fontSize: 17, fontWeight: FontWeight.w600, letterSpacing: -0.3, color: inverse ? Colors.white : SuColors.ink),
        children: [const TextSpan(text: 'Syndic'), TextSpan(text: 'Up', style: TextStyle(color: inverse ? SuColors.sage : SuColors.action))],
      ),
      textDirection: TextDirection.ltr,
    );
  }
}

class Brand extends StatelessWidget {
  const Brand({super.key, this.inverse = false, this.size = 34});
  final bool inverse;
  final double size;
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [BrandMark(size: size), const SizedBox(width: 10), BrandWordmark(inverse: inverse)]);
}
