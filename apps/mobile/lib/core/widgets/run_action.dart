import 'package:flutter/material.dart';

import '../api/api_result.dart';
import 'forms.dart';
import 'states.dart';

/// Confirmation demandée avant une action (confirmDialog).
@immutable
class ActionConfirm {
  const ActionConfirm({required this.title, required this.body, this.confirmLabel, this.danger = false, this.irreversible = false});
  final String title;
  final String body;
  final String? confirmLabel;
  final bool danger;
  final bool irreversible;
}

/// Actions d'écriture en cours, par clé d'intention (`'reservation-valider:$id'`).
///
///  - [_locked] : de l'appui jusqu'à la fin (confirmation comprise) — un second appui est ignoré ;
///  - [inFlight] : pendant la requête seulement — le déclencheur tourne / se grise (SuButton
///    `loading:`, icône désactivée), via [BusyBuilder].
class ActionBusy {
  ActionBusy._();
  static final Set<String> _locked = <String>{};
  static final ValueNotifier<Set<String>> inFlight = ValueNotifier<Set<String>>(const <String>{});

  static bool isLocked(String key) => _locked.contains(key);
  static bool isBusy(String key) => inFlight.value.contains(key);

  static bool _lock(String key) => _locked.add(key);
  static void _unlock(String key) {
    _locked.remove(key);
    _setFlight(key, false);
  }

  static void _setFlight(String key, bool on) {
    final next = {...inFlight.value};
    final changed = on ? next.add(key) : next.remove(key);
    if (changed) inFlight.value = Set.unmodifiable(next);
  }
}

/// Exécute une écriture déclenchée par un bouton, sans doublon :
///  - un second appui pendant l'action (ou sa confirmation) est ignoré (`null`) ;
///  - [confirm] : dialogue de confirmation d'abord (annulé → `null`) ;
///  - échec → toast d'erreur traduit (showApiError) ; succès → [onSuccess] puis toast
///    [successMsg] (avec « Annuler » si [undo] est fourni).
/// Le déclencheur s'abonne à l'état avec `BusyBuilder(busyKey, …)`.
Future<ApiResult<T>?> runAction<T>(
  BuildContext context,
  Future<ApiResult<T>> Function() action, {
  required String busyKey,
  ActionConfirm? confirm,
  String? successMsg,
  void Function(T data)? onSuccess,
  VoidCallback? undo,
  String? undoLabel,
  bool showError = true,
}) async {
  if (!ActionBusy._lock(busyKey)) return null;
  try {
    if (confirm != null) {
      final ok = await confirmDialog(context, title: confirm.title, body: confirm.body, confirmLabel: confirm.confirmLabel, danger: confirm.danger, irreversible: confirm.irreversible);
      if (!ok || !context.mounted) return null;
    }
    ActionBusy._setFlight(busyKey, true);
    final r = await action();
    if (!context.mounted) return r;
    switch (r) {
      case ApiOk<T>(:final data):
        onSuccess?.call(data);
        if (successMsg != null && context.mounted) showDone(context, successMsg, undoLabel: undoLabel, onUndo: undo);
      case ApiFail<T>():
        if (showError) showApiError(context, r);
    }
    return r;
  } finally {
    ActionBusy._unlock(busyKey);
  }
}

/// Exécute un bloc async sous une clé d'intention (re-entrée ignorée, état « en cours »), pour
/// les flux qui ne se résument pas à un seul appel (feuilles, téléversements). `false` si ignoré.
Future<bool> guardAction(String busyKey, Future<void> Function() body) async {
  if (!ActionBusy._lock(busyKey)) return false;
  ActionBusy._setFlight(busyKey, true);
  try {
    await body();
  } finally {
    ActionBusy._unlock(busyKey);
  }
  return true;
}

/// Reconstruit le déclencheur quand l'action [busyKey] commence ou finit.
class BusyBuilder extends StatelessWidget {
  const BusyBuilder(this.busyKey, {super.key, required this.builder});
  final String busyKey;
  final Widget Function(BuildContext context, bool busy) builder;

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<Set<String>>(
        valueListenable: ActionBusy.inFlight,
        builder: (context, keys, _) => builder(context, keys.contains(busyKey)),
      );
}
