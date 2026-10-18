import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Tirer-pour-actualiser HONNÊTE : invalide les lectures puis attend qu'elles aient réellement
/// répondu (données ou erreur) — la coche de fin de SuRefresh ne ment plus.
///
///  - Fournisseur asynchrone concret (`FutureProvider`, `.autoDispose`, instance de famille
///    `lotProvider(id)`, `StreamProvider`) : on écoute jusqu'à ce qu'il ne soit plus en
///    chargement. L'écoute le garde en vie pendant l'attente (autoDispose sans écran).
///  - Famille entière (`contratsProvider`) ou fournisseur synchrone : invalidé seulement — on ne
///    connaît pas les instances à attendre ; celles affichées se rechargent d'elles-mêmes.
///  - Jamais bloquant : au-delà de [timeout], on rend la main (le contenu suivra en direct).
Future<void> refreshing(WidgetRef ref, List<ProviderOrFamily> providers, {Duration timeout = const Duration(seconds: 20)}) async {
  for (final p in providers) {
    ref.invalidate(p);
  }
  final subs = <ProviderSubscription<AsyncValue<Object?>>>[];
  final waits = <Future<void>>[];
  // `Object` : la promotion de type vers ProviderListenable (interface distincte) est alors sûre.
  for (final Object p in providers) {
    if (p is! ProviderListenable<AsyncValue<Object?>>) continue;
    final done = Completer<void>();
    subs.add(ref.listenManual<AsyncValue<Object?>>(
      p,
      (_, next) {
        if (!next.isLoading && !done.isCompleted) done.complete();
      },
      fireImmediately: true,
    ));
    waits.add(done.future);
  }
  try {
    if (waits.isEmpty) return;
    await Future.wait(waits).timeout(timeout, onTimeout: () => const <void>[]);
  } finally {
    // Écoutes fermées dans tous les cas (y compris délai dépassé) : rien ne fuit.
    for (final s in subs) {
      s.close();
    }
  }
}
