/// Agrégats d'affichage en centimes EXACTS (BigInt) — jamais de float sur un montant
/// (CLAUDE.md §1.1). Aucune écriture : l'API reste seule à calculer une valeur métier.
BigInt versCentimes(String? montant) {
  if (montant == null || montant.isEmpty) return BigInt.zero;
  final m = RegExp(r'^(-?)(\d+)(?:\.(\d{1,2}))?$').firstMatch(montant.trim());
  if (m == null) return BigInt.zero;
  final signe = m.group(1)!;
  final entier = BigInt.parse(m.group(2)!);
  final dec = ((m.group(3) ?? '') + '00').substring(0, 2);
  final c = entier * BigInt.from(100) + BigInt.parse(dec);
  return signe == '-' ? -c : c;
}

/// 125050 → "1250.50" (format API, reformatée ensuite par formatMontant).
String versChaine(BigInt centimes) {
  final negatif = centimes < BigInt.zero;
  final abs = negatif ? -centimes : centimes;
  final entier = abs ~/ BigInt.from(100);
  final dec = (abs % BigInt.from(100)).toString().padLeft(2, '0');
  return '${negatif ? '-' : ''}$entier.$dec';
}

BigInt sommeCentimes(Iterable<String?> montants) =>
    montants.fold(BigInt.zero, (acc, m) => acc + versCentimes(m));

/// Ratio a/b en 0..1 pour les jauges (3 décimales suffisent à l'affichage).
double ratio(BigInt a, BigInt b) {
  if (b == BigInt.zero) return 0;
  return ((a * BigInt.from(1000)) ~/ b).toInt() / 1000;
}
