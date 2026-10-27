# Set d'illustrations de marque — v1 (oct. 2026)

Planches plates à grain doux, personnages sans visage, palette verte (prompt maître dans le
projet Claude « syndicup »). Même nommage sur le mobile, le web (`apps/web/public/illustrations/su`)
et le site vitrine : `su_<ID>_<slug>_<S|C>.webp`.

- `S` = scène carrée, fond crème · `C` = découpe transparente, rognée (états vides, erreurs).
- `2.0x/` : même fichier en 1254 px (Flutter choisit la densité).
- La liste complète des 93 identifiants et leur usage : `lib/core/widgets/su_art.dart` (`SuArt`).
- Déposer une nouvelle planche = l'application l'affiche au prochain build (manifeste lu au
  démarrage) ; les noms historiques (`offline`, `empty-lots`, `ok-paiement`…) basculent seuls
  (`SuArt.legacy`).

Livrées : A01 welcome · E01 no-residences · D01 offline · P03 poster-onboarding.
