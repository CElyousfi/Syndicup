import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// Formatage d'affichage — AUCUN calcul monétaire ici (CLAUDE.md §1.1). Port de
/// apps/web/lib/format.ts pour un rendu identique sur les deux clients.

const String _nbsp = ' ';

/// "1250.5" | "1250" | "1250.00" → "1 250,00".
String formatMontant(String? value) {
  if (value == null || value.isEmpty) return '—';
  final negative = value.startsWith('-');
  final abs = negative ? value.substring(1) : value;
  final parts = abs.split('.');
  final intRaw = parts.isNotEmpty && parts[0].isNotEmpty ? parts[0] : '0';
  final decPart = parts.length > 1 ? parts[1] : '';
  final intPart = intRaw.replaceFirst(RegExp(r'^0+(?=\d)'), '');
  final grouped = _group(intPart);
  final dec = ('${decPart}00').substring(0, 2);
  return '${negative ? '−' : ''}$grouped,$dec';
}

String _group(String digits) {
  final buf = StringBuffer();
  for (int i = 0; i < digits.length; i++) {
    final left = digits.length - i;
    buf.write(digits[i]);
    if (left > 1 && left % 3 == 1) buf.write(_nbsp);
  }
  return buf.toString();
}

String formatMAD(String? value, Locale locale) {
  if (value == null || value.isEmpty) return '—';
  final m = formatMontant(value);
  return locale.languageCode == 'ar' ? '$m د.م.' : '$m MAD';
}

/// Entier "1000" → "1 000" (tantièmes, compteurs).
String formatEntier(Object? value) {
  if (value == null || value.toString().isEmpty) return '—';
  final s = value.toString().split('.').first;
  return _group(s);
}

/// Ratio 0.5 → "50 %".
String formatPourcent(double? r) {
  if (r == null) return '—';
  final v = (r * 1000).round() / 10;
  final s = v == v.roundToDouble() ? v.toInt().toString() : v.toString();
  return '$s$_nbsp%';
}

String _intlLocale(Locale l) => l.languageCode == 'ar' ? 'ar' : 'fr';

/// intl rend les chiffres arabes-indiens en `ar` ; le produit garde les chiffres latins
/// (parité web `numberingSystem: latn`).
String latn(String s) {
  const from = '٠١٢٣٤٥٦٧٨٩';
  final b = StringBuffer();
  for (final r in s.runes) {
    final ch = String.fromCharCode(r);
    final i = from.indexOf(ch);
    b.write(i >= 0 ? i.toString() : ch);
  }
  return b.toString();
}

DateTime? _parse(String? iso) {
  if (iso == null || iso.isEmpty) return null;
  return DateTime.tryParse(iso)?.toLocal();
}

String formatDate(String? iso, Locale locale) {
  final d = _parse(iso);
  if (d == null) return '—';
  return latn(DateFormat.yMMMMd(_intlLocale(locale)).format(d));
}

String formatDateCourte(String? iso, Locale locale) {
  final d = _parse(iso);
  if (d == null) return '—';
  return latn(DateFormat('dd/MM/yyyy', _intlLocale(locale)).format(d));
}

String formatDateHeure(String? iso, Locale locale) {
  final d = _parse(iso);
  if (d == null) return '—';
  final l = _intlLocale(locale);
  return latn('${DateFormat.MMMd(l).format(d)} ${DateFormat.y(l).format(d)} · ${DateFormat.Hm(l).format(d)}');
}

String formatHeure(String? iso, Locale locale) {
  final d = _parse(iso);
  if (d == null) return '—';
  return latn(DateFormat.Hm(_intlLocale(locale)).format(d));
}

/// Période "2026-01" → "janvier 2026".
String formatPeriode(String periode, Locale locale) {
  final p = periode.split('-');
  if (p.length < 2) return periode;
  final y = int.tryParse(p[0]);
  final m = int.tryParse(p[1]);
  if (y == null || m == null) return periode;
  return latn(DateFormat.yMMMM(_intlLocale(locale)).format(DateTime(y, m, 1)));
}

/// Jour de semaine long + date + heure ("vendredi 26 septembre 2026 · 18:30").
String formatDateLongue(String? iso, Locale locale) {
  final d = _parse(iso);
  if (d == null) return '—';
  final l = _intlLocale(locale);
  return latn('${DateFormat.yMMMMEEEEd(l).format(d)} · ${DateFormat.Hm(l).format(d)}');
}

/// Téléphone +212612345678 → +212 6 12 34 56 78.
String formatTelephone(String? tel) {
  if (tel == null || tel.isEmpty) return '—';
  final m = RegExp(r'^\+?212(\d)(\d{2})(\d{2})(\d{2})(\d{2})$').firstMatch(tel);
  if (m != null) return '+212 ${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}';
  return tel;
}

String? nomComplet(String? prenom, String? nom) {
  final s = [prenom, nom].where((x) => x != null && x.isNotEmpty).join(' ');
  return s.isEmpty ? null : s;
}

/// Jours calendaires entre aujourd'hui et une date ISO — négatif si passée.
int joursRestants(String iso) {
  final cible = DateTime.parse(iso).toLocal();
  final now = DateTime.now();
  final a = DateTime(cible.year, cible.month, cible.day);
  final b = DateTime(now.year, now.month, now.day);
  return a.difference(b).inDays;
}

bool estAujourdhui(String iso) {
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return false;
  final n = DateTime.now();
  return d.year == n.year && d.month == n.month && d.day == n.day;
}

/// Téléphone marocain saisi librement (06…, +2126…, 002126…) → +2126XXXXXXXX.
String? normaliserTelephone(String brut) {
  var t = brut.replaceAll(RegExp(r'[^\d+]'), '');
  if (t.startsWith('00212')) {
    t = '+212${t.substring(5)}';
  } else if (t.startsWith('212')) {
    t = '+$t';
  } else if (t.startsWith('0') && t.length == 10) {
    t = '+212${t.substring(1)}';
  }
  if (RegExp(r'^\+2126\d{8}$').hasMatch(t) || RegExp(r'^\+2127\d{8}$').hasMatch(t)) return t;
  return null;
}
