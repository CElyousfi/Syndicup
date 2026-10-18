import 'package:flutter/material.dart';

import '../feel/feel.dart';
import '../format/format.dart';
import '../i18n/i18n.dart';
import '../i18n/mobile_dict.dart';
import '../theme/tokens.dart';
import 'alive.dart';

/// Champ de date : un sélecteur (calendrier dans la langue de l'appareil) à la place d'une saisie
/// libre « AAAA-MM-JJ ». La valeur reste un jour civil ISO (`2026-10-18`) dans [controller] — le
/// code d'envoi ne change pas — et s'affiche formatée (« 18 oct. 2026 », chiffres latins).
class SuDateField extends StatefulWidget {
  const SuDateField({
    super.key,
    required this.label,
    required this.controller,
    this.error,
    this.required = false,
    this.firstDate,
    this.lastDate,
    this.help,
    this.onChanged,
  });

  final String label;

  /// Jour ISO « YYYY-MM-DD » (vide = non choisi).
  final TextEditingController controller;
  final String? error;
  final bool required;
  final DateTime? firstDate;
  final DateTime? lastDate;
  final String? help;
  final ValueChanged<String>? onChanged;

  @override
  State<SuDateField> createState() => _SuDateFieldState();
}

class _SuDateFieldState extends State<SuDateField> {
  int _shake = 0;

  @override
  void didUpdateWidget(SuDateField old) {
    super.didUpdateWidget(old);
    if (widget.error != null && widget.error != old.error) {
      _shake++;
      Haptics.warning();
    }
  }

  DateTime? get _valeur => DateTime.tryParse(widget.controller.text.trim());

  Future<void> _choisir() async {
    final now = DateTime.now();
    final initial = _valeur ?? now;
    final first = widget.firstDate ?? DateTime(now.year - 10);
    final last = widget.lastDate ?? DateTime(now.year + 5, 12, 31);
    final d = await showDatePicker(
      context: context,
      initialDate: initial.isBefore(first) ? first : (initial.isAfter(last) ? last : initial),
      firstDate: first,
      lastDate: last,
      locale: context.locale,
      helpText: widget.label,
    );
    if (d == null || !mounted) return;
    final iso = jourIso(d);
    setState(() => widget.controller.text = iso);
    Haptics.select();
    widget.onChanged?.call(iso);
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final iso = widget.controller.text.trim();
    final shown = iso.length >= 10 ? formatJourAnnee(iso, context.locale) : null;
    return SuShake(
      trigger: _shake == 0 ? null : _shake,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Flexible(child: Text(widget.label, style: t.labelMedium?.copyWith(color: SuColors.ink))),
          if (widget.required) Text(' *', style: t.labelMedium?.copyWith(color: SuColors.danger)),
        ]),
        const SizedBox(height: 8),
        Semantics(
          button: true,
          label: widget.label,
          value: shown,
          child: SuTap(
            onTap: _choisir,
            ink: false,
            borderRadius: BorderRadius.circular(SuRadius.field),
            child: Material(
              color: SuColors.surface,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(SuRadius.field), side: BorderSide(color: widget.error != null ? SuColors.danger : SuColors.hairlineStrong)),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 17),
                child: Row(children: [
                  Expanded(child: Text(shown ?? context.mdict.ux.chooseDate, maxLines: 1, overflow: TextOverflow.ellipsis, style: t.bodyLarge?.copyWith(color: shown == null ? SuColors.faint : SuColors.ink))),
                  const Icon(Icons.calendar_today_rounded, size: 18, color: SuColors.link),
                ]),
              ),
            ),
          ),
        ),
        if (widget.error != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(widget.error!, style: t.bodySmall?.copyWith(color: SuColors.danger))),
        if (widget.help != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(widget.help!, style: t.bodySmall)),
      ]),
    );
  }
}
