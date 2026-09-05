import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/providers.dart';
import '../auth/app_state.dart';
import '../theme/tokens.dart';

/// Photos de la résidence (M20) — emplacements personnalisables par le syndic, image du produit
/// par défaut sinon. Mêmes clés que le web (`lib/photos.ts`) :
///   accueil → carte héro · entree → lots, gardien · cour → documents, prestataires ·
///   salle → assemblées, espace « salle » · piscine → espace « piscine » · espace:<id> → un espace.
const clesPhoto = ['accueil', 'entree', 'cour', 'salle', 'piscine'];

const photosDefaut = <String, String>{
  'accueil': 'assets/images/residence-hero.jpg',
  'entree': 'assets/images/residence-entrance.jpg',
  'cour': 'assets/images/residence-courtyard.jpg',
  'salle': 'assets/images/espace-salle.jpg',
  'piscine': 'assets/images/espace-piscine.jpg',
};

String photoDefautAsset(String cle) => photosDefaut[cle] ?? photosDefaut['entree']!;

/// Emplacement par défaut d'un espace commun, déduit des mots-clés du nom/type (comme le web).
String espacePhotoCle(String nom, String type) {
  final texte = '$nom $type'.toLowerCase();
  if (RegExp(r'piscine|pool|natation|مسبح').hasMatch(texte)) return 'piscine';
  if (RegExp(r'salle|f[eê]te|r[eé]union|r[eé]ception|قاعة').hasMatch(texte)) return 'salle';
  if (RegExp(r'jardin|espace vert|parc|cour|terrasse|toit|rooftop|حديقة|سطح').hasMatch(texte)) return 'cour';
  return 'entree';
}

/// Photo d'un emplacement : URL signée si personnalisée (repli sur `fallbackCle` puis l'asset),
/// sinon l'image par défaut. Décorative : aucune sémantique portée par l'image.
class CoproPhoto extends ConsumerWidget {
  const CoproPhoto(this.cle, {super.key, this.fallbackCle, this.fit = BoxFit.cover, this.width, this.height});
  final String cle;
  final String? fallbackCle;
  final BoxFit fit;
  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coproId = ref.watch(appContextProvider.select((c) => c.coproprieteId));
    final photos = coproId.isEmpty ? const <String, String>{} : (ref.watch(coproPhotosProvider(coproId)).valueOrNull ?? const <String, String>{});
    final asset = photoDefautAsset(fallbackCle ?? cle);
    final url = photos[cle] ?? (fallbackCle == null ? null : photos[fallbackCle!]);
    final defaut = Image.asset(asset, fit: fit, width: width, height: height);
    if (url == null) return defaut;
    return Image.network(
      url,
      fit: fit,
      width: width,
      height: height,
      gaplessPlayback: true,
      errorBuilder: (_, __, ___) => defaut,
      loadingBuilder: (_, child, progress) => progress == null ? child : defaut,
    );
  }
}

/// Bandeau photo de page (rayon 24, voile `text` progressif sous le titre) — la résidence en
/// tête d'écran, personnalisable par le syndic.
class PhotoBanner extends StatelessWidget {
  const PhotoBanner(this.cle, {super.key, this.title, this.subtitle, this.height = 140, this.margin = const EdgeInsets.only(bottom: 12)});
  final String cle;
  final String? title;
  final String? subtitle;
  final double height;
  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: margin,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(SuRadius.hero),
        child: SizedBox(
          height: height,
          width: double.infinity,
          child: Stack(
            fit: StackFit.expand,
            children: [
              CoproPhoto(cle),
              if (title != null) ...[
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [SuColors.text.withValues(alpha: 0.70), SuColors.text.withValues(alpha: 0.10), Colors.transparent],
                    ),
                  ),
                ),
                Positioned.fill(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title!, style: t.titleMedium?.copyWith(color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis),
                        if (subtitle != null) Text(subtitle!, style: t.labelSmall?.copyWith(color: Colors.white.withValues(alpha: 0.85)), maxLines: 1, overflow: TextOverflow.ellipsis),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
