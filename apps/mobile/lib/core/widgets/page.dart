import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/motion.dart';
import '../theme/tokens.dart';
import '../feel/feel.dart';
import 'alive.dart';
import 'cards.dart';
import 'motion.dart';

/// Page standard Wise : bouton rond de retour en haut à gauche, GRAND titre gras dans le corps
/// (« Connect your U.S. bank account to Wise »), qui se replie en petit titre dans la barre dès
/// qu'on fait défiler. Corps défilant avec pull-to-refresh. Une page à `body` personnalisé
/// (onglets…) garde le titre compact dans la barre.
class SuPage extends StatefulWidget {
  const SuPage({super.key, required this.title, this.subtitle, this.children, this.body, this.actions, this.onRefresh, this.fab, this.padding = const EdgeInsets.fromLTRB(16, 0, 16, 40), this.leading, this.bottom, this.largeTitle = true});
  final String title;
  final String? subtitle;
  final List<Widget>? children;
  final Widget? body;
  final List<Widget>? actions;
  final Future<void> Function()? onRefresh;
  final Widget? fab;
  final EdgeInsetsGeometry padding;
  final Widget? leading;
  final PreferredSizeWidget? bottom;
  /// Grand titre dans le corps (par défaut pour toute page à `children`).
  final bool largeTitle;

  /// En-tête des écrans racines d'onglet (avatar, résidence, cloche), fourni par la coque :
  /// une page qu'on ne peut pas « dépiler » est une racine et le porte, comme dans Wise.
  static PreferredSizeWidget Function()? rootHeader;

  @override
  State<SuPage> createState() => _SuPageState();
}

class _SuPageState extends State<SuPage> {
  /// Le grand titre est sorti de l'écran : le petit titre apparaît dans la barre.
  bool _collapsed = false;

  bool get _big => widget.body == null && widget.bottom == null && widget.largeTitle;

  bool _onScroll(ScrollNotification n) {
    if (n.depth != 0 || n.metrics.axis != Axis.vertical) return false;
    final c = n.metrics.pixels > 44;
    if (c != _collapsed) setState(() => _collapsed = c);
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    String? path;
    try {
      path = GoRouterState.of(context).uri.path;
    } catch (_) {
      path = null; // hors du routeur (tests, feuilles) : pas de mémoire de défilement
    }
    Widget content = widget.body ??
        rememberTabScroll(context, path, (key) => ListView(
          key: key,
          // Avec un bouton flottant, la dernière ligne doit pouvoir défiler au-dessus de lui.
          padding: widget.fab == null ? widget.padding : widget.padding.add(const EdgeInsets.only(bottom: 84)),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            if (_big)
              SuEnter(
                child: Padding(
                  padding: const EdgeInsets.only(top: 4, bottom: 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.title, style: t.displayMedium),
                      if (widget.subtitle != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(widget.subtitle!, style: t.bodyLarge?.copyWith(color: SuColors.soft))),
                    ],
                  ),
                ),
              ),
            ...?widget.children,
          ],
        ));
    if (widget.onRefresh != null) content = SuRefresh(onRefresh: widget.onRefresh!, child: content);
    if (_big) content = NotificationListener<ScrollNotification>(onNotification: _onScroll, child: content);

    final canPop = context.canPop();
    final Widget? leading = widget.leading ??
        (canPop
            ? Padding(
                padding: const EdgeInsetsDirectional.only(start: 16),
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: CircleIconButton(icon: Icons.arrow_back_rounded, mirror: true, tooltip: MaterialLocalizations.of(context).backButtonTooltip, onTap: () => context.pop()),
                ),
              )
            : null);
    final compactTitle = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(widget.title, style: t.titleLarge, maxLines: 1, overflow: TextOverflow.ellipsis),
        if (widget.subtitle != null && !_big) Text(widget.subtitle!, style: t.labelSmall, maxLines: 1, overflow: TextOverflow.ellipsis),
      ],
    );
    final root = !canPop && widget.leading == null && widget.bottom == null && SuPage.rootHeader != null && path != null;
    return Scaffold(
      appBar: root ? SuPage.rootHeader!() : AppBar(
        toolbarHeight: 64,
        leading: leading,
        leadingWidth: leading == null ? null : 68,
        automaticallyImplyLeading: false,
        titleSpacing: leading == null ? 16 : 6,
        title: _big
            ? AnimatedOpacity(
                opacity: _collapsed ? 1 : 0,
                duration: SuMotion.of(context, SuMotion.base),
                child: AnimatedSlide(offset: Offset(0, _collapsed ? 0 : 0.35), duration: SuMotion.of(context, SuMotion.slow), curve: SuMotion.easeOut, child: compactTitle),
              )
            : compactTitle,
        actions: widget.actions == null ? null : [...widget.actions!, const SizedBox(width: 8)],
        bottom: widget.bottom,
        shape: _big && _collapsed ? const Border(bottom: BorderSide(color: SuColors.hairline)) : null,
      ),
      body: SafeArea(top: false, child: content),
      floatingActionButton: widget.fab,
    );
  }
}

/// Grille de 2 tuiles.
class TwoCols extends StatelessWidget {
  const TwoCols(this.children, {super.key, this.gap = 12});
  final List<Widget> children;
  final double gap;
  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (int i = 0; i < children.length; i += 2) {
      rows.add(Padding(
        padding: EdgeInsets.only(bottom: i + 2 < children.length ? gap : 0),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            // Tuiles en cascade (rangée par rangée, gauche puis droite).
            children: [
              Expanded(child: SuEnter(index: i + 2, child: children[i])),
              SizedBox(width: gap),
              Expanded(child: i + 1 < children.length ? SuEnter(index: i + 3, child: children[i + 1]) : const SizedBox()),
            ],
          ),
        ),
      ));
    }
    return Column(children: rows);
  }
}

/// Marque une liste « à plat » (CardList) : ses lignes s'alignent sur la marge de page.
class _FlatListScope extends InheritedWidget {
  const _FlatListScope({required super.child});
  static bool of(BuildContext c) => c.getInheritedWidgetOfExactType<_FlatListScope>() != null;
  @override
  bool updateShouldNotify(_FlatListScope old) => false;
}

/// Ligne de liste Wise : pastille 48, titre 16 gras, sous-titre ardoise, valeur alignée en fin,
/// chevron vert profond nu.
class ListRow extends StatelessWidget {
  const ListRow({super.key, this.leading, required this.title, this.subtitle, this.trailing, this.onTap, this.padding, this.chevron = false});
  final Widget? leading;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry? padding;
  final bool chevron;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final flat = _FlatListScope.of(context);
    return SuPressable(
      enabled: onTap != null,
      scale: 0.985,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: padding ?? (flat ? const EdgeInsets.symmetric(vertical: 11) : const EdgeInsets.symmetric(horizontal: 16, vertical: 12)),
          child: Row(
            children: [
              if (leading != null) ...[leading!, const SizedBox(width: 14)],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: t.titleMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
                    if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 3), child: Text(subtitle!, style: t.bodyMedium?.copyWith(fontSize: 14, color: SuColors.soft, height: 1.35), maxLines: 2, overflow: TextOverflow.ellipsis)),
                  ],
                ),
              ),
              if (trailing != null) ...[const SizedBox(width: 12), trailing!],
              if (chevron || onTap != null && trailing == null) const Padding(padding: EdgeInsetsDirectional.only(start: 8), child: ChevronEnd()),
            ],
          ),
        ),
      ),
    );
  }
}

/// Liste Wise : lignes posées à plat sur la toile (aucun cadre, aucun séparateur), alignées sur
/// la marge de la page, qui arrivent en cascade.
class CardList extends StatelessWidget {
  const CardList(this.children, {super.key});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) {
    // Lignes CLÉES (ValueKey de l'objet) : insertion / retrait animés quand la liste change
    // (données live, actualisation) ; premier rendu en cascade.
    return _FlatListScope(
      child: Material(
        type: MaterialType.transparency,
        child: SuLiveColumn(
          children: [
            for (int i = 0; i < children.length; i++) SuEnter(key: children[i].key is LocalKey ? children[i].key : null, index: i, offset: 0.12, child: children[i]),
          ],
        ),
      ),
    );
  }
}

/// Rangée de filtres Wise : pills à contour fin (texte vert profond), active = sauge pleine.
class FilterChips<T> extends StatelessWidget {
  const FilterChips({super.key, required this.value, required this.options, required this.labelOf, required this.onChanged});
  final T value;
  final List<T> options;
  final String Function(T) labelOf;
  final ValueChanged<T> onChanged;
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: options.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final o = options[i];
          final sel = o == value;
          return SuPressable(
            scale: 0.94,
            child: AnimatedContainer(
              duration: SuMotion.of(context, SuMotion.base),
              curve: SuMotion.easeOut,
              decoration: ShapeDecoration(
                color: sel ? SuColors.cta : SuColors.surface,
                shape: StadiumBorder(side: BorderSide(color: sel ? SuColors.cta : SuColors.hairlineStrong, width: 1.2)),
              ),
              child: Material(
                type: MaterialType.transparency,
                child: InkWell(
                  customBorder: const StadiumBorder(),
                  onTap: () {
                    if (!sel) Haptics.select();
                    onChanged(o);
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    child: Center(
                      child: Semantics(
                        selected: sel,
                        button: true,
                        child: Text(labelOf(o), style: TextStyle(color: sel ? SuColors.onCta : SuColors.link, fontWeight: FontWeight.w600, fontSize: 14.5)),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Chevron de fin de ligne (drill-in) — glyphe vert profond nu, miroir RTL automatique.
class ChevronEnd extends StatelessWidget {
  const ChevronEnd({super.key, this.color, this.size = 24});
  final Color? color;
  final double size;
  @override
  Widget build(BuildContext context) => Icon(Icons.chevron_right_rounded, size: size.clamp(20, 28), color: color ?? SuColors.link, textDirection: Directionality.of(context));
}

class ArrowEnd extends StatelessWidget {
  const ArrowEnd({super.key, this.color, this.size = 32});
  final Color? color;
  final double size;
  @override
  Widget build(BuildContext context) => ChevronEnd(color: color, size: size);
}
