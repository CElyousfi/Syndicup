import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/api_result.dart';
import '../i18n/i18n.dart';
import '../theme/tokens.dart';
import 'states.dart';

/// Champ de formulaire libellé (label + aide + erreur serveur `fields[name]`).
class SuField extends StatelessWidget {
  const SuField({
    super.key,
    required this.label,
    this.controller,
    this.hint,
    this.help,
    this.error,
    this.keyboardType,
    this.inputFormatters,
    this.obscureText = false,
    this.maxLines = 1,
    this.maxLength,
    this.required = false,
    this.optionalLabel,
    this.textDirection,
    this.mono = false,
    this.autofocus = false,
    this.validator,
    this.onChanged,
    this.suffix,
    this.prefix,
    this.enabled = true,
    this.textInputAction,
    this.onSubmitted,
    this.autofillHints,
  });
  final String label;
  final TextEditingController? controller;
  final String? hint, help, error, optionalLabel;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final bool obscureText, required, mono, autofocus, enabled;
  final int maxLines;
  final int? maxLength;
  final TextDirection? textDirection;
  final String? Function(String?)? validator;
  final ValueChanged<String>? onChanged;
  final Widget? suffix, prefix;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted;
  final Iterable<String>? autofillHints;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(label, style: t.labelMedium?.copyWith(color: SuColors.ink)),
            if (required) Text(' *', style: t.labelMedium?.copyWith(color: SuColors.danger)),
            if (!required && optionalLabel != null) Text('  ·  $optionalLabel', style: t.labelSmall),
          ],
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          inputFormatters: inputFormatters,
          obscureText: obscureText,
          maxLines: maxLines,
          maxLength: maxLength,
          autofocus: autofocus,
          enabled: enabled,
          validator: validator,
          onChanged: onChanged,
          textDirection: textDirection,
          textInputAction: textInputAction,
          onFieldSubmitted: onSubmitted,
          autofillHints: autofillHints,
          style: t.bodyLarge?.copyWith(color: SuColors.ink, fontFamily: mono ? 'GeistMono' : null),
          decoration: InputDecoration(hintText: hint, hintTextDirection: textDirection, errorText: error, suffixIcon: suffix, prefixIcon: prefix),
        ),
        if (help != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(help!, style: t.bodySmall)),
      ],
    );
  }
}

/// Sélecteur en feuille du bas (remplace `<select>`).
class SuSelect<T> extends StatelessWidget {
  const SuSelect({super.key, required this.label, required this.value, required this.options, required this.labelOf, required this.onChanged, this.help, this.error, this.required = false, this.placeholder, this.enabled = true});
  final String label;
  final T? value;
  final List<T> options;
  final String Function(T) labelOf;
  final ValueChanged<T> onChanged;
  final String? help, error, placeholder;
  final bool required, enabled;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [Text(label, style: t.labelMedium?.copyWith(color: SuColors.ink)), if (required) Text(' *', style: t.labelMedium?.copyWith(color: SuColors.danger))]),
        const SizedBox(height: 6),
        Material(
          color: enabled ? SuColors.surface : SuColors.ground,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(SuRadius.field), side: BorderSide(color: error != null ? SuColors.danger : SuColors.hairline)),
          child: InkWell(
            borderRadius: BorderRadius.circular(SuRadius.field),
            onTap: !enabled
                ? null
                : () async {
                    final picked = await showModalBottomSheet<T>(
                      context: context,
                      isScrollControlled: true,
                      builder: (ctx) => SafeArea(
                        child: ConstrainedBox(
                          constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(ctx).height * 0.7),
                          child: ListView(
                            shrinkWrap: true,
                            padding: const EdgeInsets.fromLTRB(8, 0, 8, 12),
                            children: [
                              Padding(padding: const EdgeInsets.fromLTRB(12, 4, 12, 8), child: Text(label, style: t.titleMedium)),
                              for (final o in options)
                                ListTile(
                                  title: Text(labelOf(o), style: t.bodyLarge?.copyWith(color: SuColors.ink)),
                                  trailing: o == value ? const Icon(Icons.check_rounded, color: SuColors.action) : null,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  onTap: () => Navigator.of(ctx).pop(o),
                                ),
                            ],
                          ),
                        ),
                      ),
                    );
                    if (picked != null) onChanged(picked);
                  },
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
              child: Row(
                children: [
                  Expanded(child: Text(value == null ? (placeholder ?? '—') : labelOf(value as T), style: t.bodyLarge?.copyWith(color: value == null ? SuColors.faint : SuColors.ink), maxLines: 1, overflow: TextOverflow.ellipsis)),
                  const Icon(Icons.expand_more_rounded, color: SuColors.soft),
                ],
              ),
            ),
          ),
        ),
        if (error != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(error!, style: t.bodySmall?.copyWith(color: SuColors.danger))),
        if (help != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(help!, style: t.bodySmall)),
      ],
    );
  }
}

/// Choix segmenté (deux/trois options exclusives).
class Segmented<T> extends StatelessWidget {
  const Segmented({super.key, required this.value, required this.options, required this.labelOf, required this.onChanged});
  final T value;
  final List<T> options;
  final String Function(T) labelOf;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: SuColors.canvas, borderRadius: BorderRadius.circular(SuRadius.field)),
      child: Row(
        children: [
          for (final o in options)
            Expanded(
              child: GestureDetector(
                onTap: () => onChanged(o),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: o == value ? SuColors.surface : Colors.transparent, borderRadius: BorderRadius.circular(11), boxShadow: o == value ? [const BoxShadow(color: Color(0x14000000), blurRadius: 4, offset: Offset(0, 1))] : null),
                  child: Text(labelOf(o), style: t.labelMedium?.copyWith(color: o == value ? SuColors.ink : SuColors.soft), maxLines: 1, overflow: TextOverflow.ellipsis),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Case à cocher avec aide.
class SuCheckbox extends StatelessWidget {
  const SuCheckbox({super.key, required this.value, required this.onChanged, required this.label, this.help});
  final bool value;
  final ValueChanged<bool> onChanged;
  final String label;
  final String? help;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => onChanged(!value),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(width: 28, height: 28, child: Checkbox(value: value, onChanged: (v) => onChanged(v ?? false), activeColor: SuColors.action, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)))),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: t.bodyMedium?.copyWith(color: SuColors.ink, fontWeight: FontWeight.w500)),
                  if (help != null) Text(help!, style: t.bodySmall),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Erreur de formulaire renvoyée par l'API : 422 métier affiché tel quel, état gaté légal en
/// bannière, VALIDATION_ERROR sous chaque champ (via `fieldError`).
class FormError extends StatelessWidget {
  const FormError(this.fail, {super.key, this.onSettings});
  final ApiFail? fail;
  final VoidCallback? onSettings;
  @override
  Widget build(BuildContext context) {
    final f = fail;
    if (f == null) return const SizedBox.shrink();
    final d = context.dict;
    if (f.error.isLegalGate) return LegalGateBanner(message: f.error.message, onSettings: onSettings);
    final String msg;
    if (f.error.code == 'NETWORK') {
      msg = f.error.message;
    } else if (f.error.code == 'RATE_LIMITED') {
      msg = f.retryAfter != null ? fill(d.auth.rateLimited, {'s': f.retryAfter!}) : d.auth.rateLimitedGeneric;
    } else if (f.error.code == 'FORBIDDEN') {
      msg = d.common.forbidden;
    } else if (f.status >= 500) {
      msg = d.common.errorBody;
    } else {
      msg = f.error.message;
    }
    return SuBanner(tone: f.error.code == 'CONFLICT' ? BannerTone.warn : BannerTone.danger, body: msg);
  }
}

String? fieldError(ApiFail? f, String name) => f?.error.fields[name];

/// Bouton principal avec état de chargement.
class SubmitButton extends StatelessWidget {
  const SubmitButton({super.key, required this.label, required this.onPressed, this.loading = false, this.icon, this.danger = false, this.secondary = false});
  final String label;
  final VoidCallback? onPressed;
  final bool loading, danger, secondary;
  final IconData? icon;
  @override
  Widget build(BuildContext context) {
    final child = loading
        ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
        : Row(mainAxisSize: MainAxisSize.min, children: [if (icon != null) ...[Icon(icon, size: 20), const SizedBox(width: 8)], Flexible(child: Text(label, overflow: TextOverflow.ellipsis))]);
    if (secondary) {
      return OutlinedButton(onPressed: loading ? null : onPressed, child: loading ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4)) : child);
    }
    return FilledButton(
      onPressed: loading ? null : onPressed,
      style: danger ? FilledButton.styleFrom(backgroundColor: SuColors.danger) : null,
      child: child,
    );
  }
}

/// Feuille du bas de formulaire (poignée, zone sûre, clavier).
Future<T?> showFormSheet<T>(BuildContext context, {required String title, required Widget Function(BuildContext ctx) builder}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(title, style: Theme.of(ctx).textTheme.headlineSmall),
            const SizedBox(height: 16),
            builder(ctx),
          ],
        ),
      ),
    ),
  );
}

/// ConfirmDialog — obligatoire sur toute action irréversible (Master Spec 14.3).
Future<bool> confirmDialog(BuildContext context, {required String title, required String body, String? confirmLabel, bool danger = false, bool irreversible = false}) async {
  final d = context.dict;
  final r = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(body),
          if (irreversible) Padding(padding: const EdgeInsets.only(top: 10), child: Text(d.common.irreversible, style: Theme.of(ctx).textTheme.bodySmall?.copyWith(color: SuColors.danger, fontWeight: FontWeight.w600))),
        ],
      ),
      actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(d.common.cancel)),
        FilledButton(
          onPressed: () => Navigator.pop(ctx, true),
          style: FilledButton.styleFrom(minimumSize: const Size(0, 44), backgroundColor: danger ? SuColors.danger : SuColors.action),
          child: Text(confirmLabel ?? d.common.confirm),
        ),
      ],
    ),
  );
  return r ?? false;
}

/// Formateur : montant décimal "1234.56" (point, 2 décimales max).
final List<TextInputFormatter> montantFormatters = [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')), _DecimalNormalizer()];

class _DecimalNormalizer extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final s = newValue.text.replaceAll(',', '.');
    final m = RegExp(r'^\d{0,12}(\.\d{0,2})?$').hasMatch(s);
    if (!m) return oldValue;
    return newValue.copyWith(text: s, selection: TextSelection.collapsed(offset: s.length));
  }
}
