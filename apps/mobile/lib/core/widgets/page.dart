import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/tokens.dart';

/// Page standard : barre de titre compacte (retour), corps défilant avec pull-to-refresh.
class SuPage extends StatelessWidget {
  const SuPage({super.key, required this.title, this.subtitle, this.children, this.body, this.actions, this.onRefresh, this.fab, this.padding = const EdgeInsets.fromLTRB(16, 4, 16, 32), this.leading, this.bottom, this.largeTitle = false});
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
  final bool largeTitle;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    Widget content = body ??
        ListView(
          padding: padding,
          children: [
            if (largeTitle) ...[
              const SizedBox(height: 8),
              Text(title, style: t.displaySmall),
              if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(subtitle!, style: t.bodyMedium)),
              const SizedBox(height: 8),
            ],
            ...?children,
          ],
        );
    if (onRefresh != null) content = RefreshIndicator(onRefresh: onRefresh!, color: SuColors.action, child: content);
    return Scaffold(
      appBar: AppBar(
        leading: leading ?? (context.canPop() ? IconButton(icon: const Icon(Icons.arrow_back_rounded), onPressed: () => context.pop()) : null),
        title: largeTitle
            ? null
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(title, style: t.titleLarge, maxLines: 1, overflow: TextOverflow.ellipsis),
                  if (subtitle != null) Text(subtitle!, style: t.labelSmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
        actions: actions,
        bottom: bottom,
      ),
      body: SafeArea(top: false, child: content),
      floatingActionButton: fab,
    );
  }
}

/// Grille de 2 tuiles.
class TwoCols extends StatelessWidget {
  const TwoCols(this.children, {super.key, this.gap = 10});
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
            children: [
              Expanded(child: children[i]),
              SizedBox(width: gap),
              Expanded(child: i + 1 < children.length ? children[i + 1] : const SizedBox()),
            ],
          ),
        ),
      ));
    }
    return Column(children: rows);
  }
}

/// Élément de liste (ligne de carte) : icône, titre, sous-titre, badge/valeur, chevron.
class ListRow extends StatelessWidget {
  const ListRow({super.key, this.leading, required this.title, this.subtitle, this.trailing, this.onTap, this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 12), this.chevron = false});
  final Widget? leading;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final bool chevron;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: padding,
        child: Row(
          children: [
            if (leading != null) ...[leading!, const SizedBox(width: 12)],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: t.titleSmall, maxLines: 2, overflow: TextOverflow.ellipsis),
                  if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(subtitle!, style: t.bodySmall, maxLines: 2, overflow: TextOverflow.ellipsis)),
                ],
              ),
            ),
            if (trailing != null) ...[const SizedBox(width: 10), trailing!],
            if (chevron || onTap != null && trailing == null) const Padding(padding: EdgeInsetsDirectional.only(start: 6), child: Icon(Icons.chevron_right_rounded, color: SuColors.faint)),
          ],
        ),
      ),
    );
  }
}

/// Liste de lignes dans une carte, séparées par un hairline.
class CardList extends StatelessWidget {
  const CardList(this.children, {super.key});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) {
    return Material(
      color: SuColors.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(SuRadius.card), side: const BorderSide(color: SuColors.hairline)),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (int i = 0; i < children.length; i++) ...[
            if (i > 0) const Divider(height: 1),
            children[i],
          ],
        ],
      ),
    );
  }
}

/// Rangée de filtres (chips défilants).
class FilterChips<T> extends StatelessWidget {
  const FilterChips({super.key, required this.value, required this.options, required this.labelOf, required this.onChanged});
  final T value;
  final List<T> options;
  final String Function(T) labelOf;
  final ValueChanged<T> onChanged;
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: options.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final o = options[i];
          final sel = o == value;
          return ChoiceChip(
            label: Text(labelOf(o)),
            selected: sel,
            labelStyle: TextStyle(color: sel ? Colors.white : SuColors.body, fontWeight: FontWeight.w600, fontSize: 13),
            onSelected: (_) => onChanged(o),
          );
        },
      ),
    );
  }
}

/// Chevron de fin de ligne (drill-in) — pastille greige, chevron encre, miroir RTL automatique.
class ChevronEnd extends StatelessWidget {
  const ChevronEnd({super.key, this.color, this.size = 36});
  final Color? color;
  final double size;
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(color: SuColors.ground, shape: BoxShape.circle),
        child: Icon(Icons.chevron_right_rounded, size: size * 0.55, color: color ?? SuColors.ink, textDirection: Directionality.of(context)),
      );
}

class ArrowEnd extends StatelessWidget {
  const ArrowEnd({super.key, this.color, this.size = 32});
  final Color? color;
  final double size;
  @override
  Widget build(BuildContext context) => ChevronEnd(color: color, size: size);
}
