# Audit de restyle — état avant application du design system (04/09/2026)

Périmètre : `apps/web` (Next.js + Tailwind v4) et `apps/mobile` (Flutter). Comportement, routage,
données et API des composants inchangés : présentation uniquement.

## 1. Couleurs codées en dur (hors fichiers de tokens)

| Fichier | Occurrences | Traitement |
|---|---|---|
| `apps/web/app/globals.css` (`@theme`) | palette « Résidence » (greige / sauge / lilas / sable / tosca) | remplacée par `docs/design/tokens.css` — mêmes noms d'alias conservés pour ne pas casser les classes existantes (`text-ink`, `bg-surface`, `text-action`…), valeurs remappées |
| `apps/web/components/ui/color-icons.tsx` | 14 hex (glyphes couleur) | palette locale réécrite avec les tokens bleu / ambre / crème |
| `apps/web/components/ui/empty-state.tsx` | 23 hex (motif SVG « résidence ») | motif supprimé : l'état vide devient la bannière crème avec action (§5.8) |
| `apps/web/components/ui/button.tsx`, `field.tsx` | 1 hex chacun (ombre / accent checkbox) | tokens |
| `apps/web/app/[locale]/layout.tsx` | `themeColor #ecebe4` | `#FFFFFF` (`bg`) |
| `apps/web/app/manifest.ts`, `app/api/qr/route.ts` | couleurs PWA / QR | `bg` + `text` |
| `apps/web/app/[locale]/(app)/finances/quittances/[id]/page.tsx`, `lots/[id]/rattachement-modals.tsx` | 1 hex chacun | tokens |
| `apps/mobile/lib/core/theme/tokens.dart` | palette « Résidence » | réécrite depuis `tokens.ts` |

## 2. Rayons en usage (web)

`rounded-full` (52), `rounded-btn` (28), `rounded-2xl` (17), `rounded-field` (16), `rounded-xl` (12),
`rounded-card` (10), `rounded-lg`, `rounded-md`, arbitraires `[4px] [5px] [10px] [18px] [20px] [22px] [26px] [28px]`.
→ Échelle Tailwind écrasée : `sm/md/lg/xl/2xl` = 16 (`radius-row`), `3xl` = 24, `card` = 20, `hero` = 24,
`btn`/`pill`/`full` = 999, `field` = 16. Les arbitraires sont remplacés par ces tokens.

## 3. Tailles de police en usage (web)

`text-[13px]` (180), `text-sm` (128), `text-[12px]` (83), `text-[15px]` (27), `text-[11px]` (20), `text-lg`,
`text-xl`, `text-2xl`, `text-[17px]`, `text-[10px]`, `text-3xl`, `text-[10.5px]`, `text-[64px]`, `text-[28px]`…
→ Échelle de type du système exposée en classes utilitaires (`t-display`, `t-title`, `t-section`,
`t-card-title`, `t-tab`, `t-body`, `t-meta`, `t-pill`, `t-label`, `t-nav`, `t-stat-*`) et Tailwind
`text-xs/sm/base/lg/xl/2xl/3xl` remappé sur 12/13/15/17/20/24/28.

## 4. Ombres en usage (web)

`shadow-pop`, `shadow-lift`, `shadow-float`, `shadow-sm`, `shadow-[…]` dans 20 fichiers (boutons, cartes,
barre latérale, feuilles, tooltips, wizard…). → Toutes à `none` sauf `shadow-nav`
(`0 -4px 24px rgba(17,17,19,.06)`) sur la barre d'onglets / la barre latérale / les tooltips de graphique / les toasts.

## 5. Primitives partagées existantes

| Primitive (design system) | Web | Mobile |
|---|---|---|
| StatusPill | `components/ui/badge.tsx` | `lib/core/widgets/badge.dart` |
| ListRow / TransactionRow | `.card` + listes `divide-y` dans les pages ; `components/ui/table.tsx` (→ cartes < md) | `ListRow`, `CardList` (`widgets/page.dart`) |
| OverviewTile | `components/ui/stat-card.tsx` | `StatTile` (`widgets/cards.dart`) |
| HeroCard | — (nouveau, `components/ui/hero-card.tsx`) | — (nouveau, `widgets/cards.dart`) |
| Tabs | `components/ui/tabs.tsx` (Segmented), `link-tabs.tsx` | `Segmented` (`widgets/forms.dart`), `TabBar` |
| SearchField | `components/ui/field.tsx` `Input` + `.filters` | `TextField` thème |
| Banner | `components/ui/banner.tsx` | `SuBanner` (`widgets/states.dart`) |
| CircleButton | `components/ui/button.tsx` (variantes) | `SubmitButton`, `ChevronEnd` → `CircleArrow` |
| DonutStatCard / BarChart | `components/ui/progress.tsx` (RingGauge), `charts.tsx` (Donut, Bars) | `Gauge` |
| Nav | `components/shell/app-frame.tsx` (+ `globals.css` coque mobile) | `features/shell/app_shell.dart` |
| Boutons | `components/ui/button.tsx` | thème `FilledButton`/`OutlinedButton` |
| Champs | `components/ui/field.tsx` | `SuField`, `SuSelect` |
| Modale / feuille | `components/ui/modal.tsx` | `showFormSheet` |

## 6. Points qui ne se mappent pas proprement (décisions prises, à valider)

- **Statuts hors « bleu / jaune »** : le système ne prévoit que deux pilules. Les statuts d'échec
  (IMPAYÉ, REFUSÉ, REJETÉ, SUSPENDU) utilisent `red-500` (couleur de la palette, texte blanc), les
  statuts positifs (PAYÉ, ADOPTÉE, CONFIRMÉE) `blue-600`, les états d'attente `yellow-400`, les niveaux
  d'escalade N1→N6 `text` (encre, chiffres tabulaires). Aucune couleur ajoutée.
- **Teintes de bannière** : pas de teinte verte/rouge dans la palette → bannières ok/danger sur
  `surface` avec icône colorée ; info/warn sur `cream-100`.
- **Illustration isométrique du HeroCard** : asset Figma non exporté. Emplacement prévu
  (`apps/web/public/images/hero-house.png`, `apps/mobile/assets/images/hero-house.png`) ; en attendant,
  la photo `residence-hero` est masquée à la même position. À remplacer par l'export 3x du fichier Figma.
- **Arabe** : Plus Jakarta Sans n'a pas de glyphes arabes ; Noto Sans Arabic reste en repli (déjà présent).
- **Graphiques « appelé / encaissé »** : les deux séries deviennent `amber-500` (encaissé) / `amber-400`
  (appelé) comme le BarChart de référence ; l'anneau de répartition utilise la série bleu/ambre.

## 7. Fichiers modifiés par phase

- Phase 1 (tokens) : `apps/web/app/globals.css`, `apps/web/app/[locale]/layout.tsx`, `apps/web/app/fonts/`,
  `apps/mobile/lib/core/theme/{tokens,app_theme}.dart`, `apps/mobile/pubspec.yaml`, `apps/mobile/assets/fonts/`.
- Phase 2 (primitives) : `apps/web/components/ui/*`, `components/shell/*`, `components/brand.tsx`,
  `apps/mobile/lib/core/widgets/*`, `lib/features/shell/app_shell.dart`.
- Phase 3 (écrans) : tableaux de bord (HeroCard + tuiles), pages `(app)/**` (ombres, rayons, chevrons → flèche
  circulaire), écrans Flutter `lib/features/**`.
- Phase 4 (balayage) : suppression des hex/ombres/rayons résiduels, `manifest.ts`, route QR.
