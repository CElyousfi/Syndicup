import 'package:flutter/widgets.dart';

import 'illustration.dart';

/// Bibliothèque d'illustrations de marque « SyndicUp » (set v1, oct. 2026) : planches plates
/// à grain doux, personnages sans visage, palette verte. Même identifiants que le web et le
/// site vitrine (`su_<ID>_<slug>`), même prompt maître — une seule main sur tout le produit.
///
/// Fichiers : `assets/illustrations/su/su_<ID>_<slug>_<S|C>.webp` (+ `2.0x/`).
///   S = scène carrée avec fond crème (fold, onboarding, affiches),
///   C = découpe sur fond transparent, rognée (cartes, états vides, bandeaux).
/// Une illustration non encore livrée rend `fallback` : la liste ci-dessous est le plan complet,
/// les fichiers arrivent planche par planche. `SuArt.available` dit ce qui est en place.
enum SuArt {
  // A — Authentification & onboarding
  a01('A01', 'welcome', 'Accueil : Amina devant la résidence, registre contre elle'),
  a02('A02', 'invitation-qr', 'Rejoindre par invitation (QR)'),
  a03('A03', 'login', 'Connexion e-mail + mot de passe'),
  a04('A04', 'biometric', 'Face ID / empreinte'),
  a05('A05', 'password-forgot', 'Mot de passe oublié'),
  a06('A06', 'password-reset-done', 'Mot de passe réinitialisé'),
  a07('A07', 'email-sent', 'E-mail envoyé, vérifiez votre boîte'),
  a08('A08', 'update-required', 'Mise à jour requise'),
  a09('A09', 'set-password-first-time', 'Premier mot de passe après invitation'),
  // E — États vides
  e01('E01', 'no-residences', 'Aucune résidence'),
  e02('E02', 'no-lots', 'Aucun lot'),
  e03('E03', 'no-incidents', 'Aucun incident'),
  e04('E04', 'no-ag', 'Aucune assemblée'),
  e05('E05', 'no-documents', 'Aucun document'),
  e06('E06', 'no-notifications', 'Aucune notification'),
  e07('E07', 'no-visitors', 'Aucune visite'),
  e08('E08', 'no-reservations', 'Aucune réservation'),
  e09('E09', 'no-contracts', 'Aucun contrat'),
  e10('E10', 'no-expenses', 'Aucune dépense'),
  e11('E11', 'no-staff', 'Aucun personnel'),
  e12('E12', 'no-fund-calls', 'Aucun appel de fonds'),
  e13('E13', 'no-announcements', 'Aucune annonce'),
  e14('E14', 'no-search-results', 'Aucun résultat'),
  e15('E15', 'no-messages-assistant', 'Assistant : conversation vide'),
  e16('E16', 'no-tasks', 'Aucune tâche'),
  e17('E17', 'no-budget', 'Aucun budget proposé'),
  e18('E18', 'no-residents-connected', 'Aucun résident connecté'),
  // S — Succès
  s01('S01', 'payment-recorded', 'Paiement enregistré'),
  s02('S02', 'vote-cast', 'Vote enregistré'),
  s03('S03', 'ag-convened', 'Convocation envoyée'),
  s04('S04', 'incident-resolved', 'Incident résolu'),
  s05('S05', 'document-uploaded', 'Justificatif ajouté'),
  s06('S06', 'invitation-sent', 'Invitations envoyées'),
  s07('S07', 'double-validation', 'Double validation faite'),
  s08('S08', 'annexes-generated', 'Annexes générées'),
  s09('S09', 'migration-done', 'Import terminé'),
  s10('S10', 'trial-started', 'Essai démarré'),
  // D — Moments difficiles
  d01('D01', 'offline', 'Serveur injoignable / hors ligne'),
  d02('D02', 'session-expired', 'Session expirée'),
  d03('D03', 'access-suspended', 'Abonnement suspendu (402)'),
  d04('D04', 'forbidden', 'Section réservée (403)'),
  d05('D05', 'generic-error', 'Erreur inattendue'),
  d06('D06', 'maintenance', 'Maintenance'),
  d07('D07', 'loading', 'Chargement long'),
  d08('D08', 'payment-overdue-reminder', 'Rappel de charges (résident)'),
  d09('D09', 'renewal-due', 'Renouvellement à venir (syndic)'),
  d10('D10', 'grace-period', 'Délai de grâce'),
  d11('D11', 'no-connection-for-vote', 'Connexion perdue en séance d\'AG'),
  d12('D12', 'delete-confirm', 'Confirmation d\'action irréversible'),
  // F — Fonctionnalités / pédagogie
  f01('F01', 'charges-and-fund-calls', 'Charges et appels de fonds'),
  f02('F02', 'twelve-annexes', '12 annexes du décret'),
  f03('F03', 'general-assembly', 'Assemblée générale'),
  f04('F04', 'incidents-maintenance', 'Incidents et maintenance'),
  f05('F05', 'caretaker-and-visitors', 'Gardien et visiteurs'),
  f06('F06', 'documents-proof', 'Documents probants'),
  f07('F07', 'multi-residence-cabinet', 'Cabinet multi-résidences'),
  f08('F08', 'residents-app', 'App résidents'),
  f09('F09', 'migration-import', 'Import / migration'),
  f10('F10', 'trial-30-days', 'Essai 30 jours'),
  f11('F11', 'double-validation-feature', 'Double validation'),
  f12('F12', 'arabic-and-french', 'Arabe et français'),
  f13('F13', 'caretaker-tools', 'Outils du gardien'),
  f14('F14', 'promoter-handover', 'Remise promoteur'),
  f15('F15', 'morning-summary', 'Résumé du matin'),
  f16('F16', 'reminders', 'Relances'),
  f17('F17', 'security-hosting', 'Sécurité / hébergement'),
  f18('F18', 'common-spaces', 'Espaces communs'),
  f19('F19', 'budget-vote', 'Vote du budget'),
  f20('F20', 'recovery-rate', 'Taux de recouvrement'),
  // R — Portraits de rôle
  r01('R01', 'role-volunteer-syndic', 'Syndic bénévole'),
  r02('R02', 'role-cabinet', 'Cabinet de syndic'),
  r03('R03', 'role-coowner', 'Copropriétaire'),
  r04('R04', 'role-promoter', 'Promoteur'),
  r05('R05', 'role-caretaker', 'Gardien'),
  r06('R06', 'role-resident-senior', 'Résident senior'),
  // W — Héros larges
  w01('W01', 'hero-serenity', 'Sérénité devant la résidence'),
  w02('W02', 'hero-cabinet', 'Bureau du cabinet'),
  w03('W03', 'hero-residents', 'Résidents sur la terrasse'),
  // N — Glyphes de notification / widget (découpe seulement)
  n01('N01', 'glyph-payment', 'Enveloppe cochée'),
  n02('N02', 'glyph-vote', 'Urne'),
  n03('N03', 'glyph-incident', 'Boîte à outils'),
  n04('N04', 'glyph-visitor', 'Clé'),
  n05('N05', 'glyph-document', 'Dossier'),
  n06('N06', 'glyph-ag', 'Deux chaises'),
  n07('N07', 'glyph-morning', 'Verre de thé'),
  n08('N08', 'glyph-reminder', 'Enveloppe à point'),
  n09('N09', 'glyph-residence', 'Résidence'),
  n10('N10', 'glyph-lift', 'Porte d\'ascenseur');

  const SuArt(this.id, this.slug, this.description);
  final String id;
  final String slug;
  final String description;

  static const String dir = 'assets/illustrations/su';

  /// Chemin de la scène (`S`) ou de la découpe (`C`).
  String path({bool cutout = true}) => '$dir/su_${id}_${slug}_${cutout ? 'C' : 'S'}.webp';

  /// Livrée dans ce build (manifeste lu par `SuIllustration.init`).
  bool has({bool cutout = true}) => SuIllustration.hasAsset(path(cutout: cutout));

  /// Tout ce qui est en place, pour le journal de démarrage et les tests.
  static List<SuArt> get available => values.where((a) => a.has() || a.has(cutout: false)).toList();

  /// Noms historiques de `SuIllustration` → planche du set. Les écrans qui demandent
  /// `'welcome-hero'` ou `'offline'` reçoivent la nouvelle illustration sans changer de code.
  static const Map<String, SuArt> legacy = {
    'welcome-hero': SuArt.a01,
    'offline': SuArt.d01,
    'empty-residences': SuArt.e01,
    'empty-lots': SuArt.e02,
    'empty-incidents': SuArt.e03,
    'empty-ag': SuArt.e04,
    'empty-documents': SuArt.e05,
    'empty-notifications': SuArt.e06,
    'empty-visites': SuArt.e07,
    'empty-reservations': SuArt.e08,
    'empty-appels': SuArt.e12,
    'empty-annonces': SuArt.e13,
    'empty-search': SuArt.e14,
    'empty-taches': SuArt.e16,
    'empty-personnel': SuArt.e11,
    'ok-paiement': SuArt.s01,
    'ok-vote': SuArt.s02,
    'ok-incident': SuArt.s04,
    'ok-invitation': SuArt.s06,
  };
}

/// Une planche du set, découpe par défaut. Rend [fallback] (ou rien) tant qu'elle n'est pas livrée.
class SuArtImage extends StatelessWidget {
  const SuArtImage(this.art, {super.key, this.cutout = true, this.width, this.height, this.fit = BoxFit.contain, this.alignment = Alignment.center, this.fallback, this.radius = 0});
  final SuArt art;
  final bool cutout;
  final double? width;
  final double? height;
  final BoxFit fit;
  final AlignmentGeometry alignment;
  final Widget? fallback;

  /// Coins arrondis (scènes à fond crème dans une carte).
  final double radius;

  @override
  Widget build(BuildContext context) {
    // Variante demandée, sinon l'autre si elle seule est livrée, sinon le repli.
    final useCutout = art.has(cutout: cutout) ? cutout : !cutout;
    if (!art.has(cutout: useCutout)) return fallback ?? const SizedBox.shrink();
    Widget img = Image.asset(
      art.path(cutout: useCutout),
      width: width,
      height: height,
      fit: fit,
      alignment: alignment,
      excludeFromSemantics: true,
      filterQuality: FilterQuality.medium,
      errorBuilder: (_, __, ___) => fallback ?? const SizedBox.shrink(),
    );
    if (radius > 0) img = ClipRRect(borderRadius: BorderRadius.circular(radius), child: img);
    return img;
  }
}
