import 'dart:async';
import 'dart:io' show Platform;

import 'package:battery_plus/battery_plus.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';

/// Mode « lite » automatique : appareil Android peu doté (isLowRamDevice ou ≤ 3 Go de RAM)
/// ou économiseur de batterie actif. On garde les retours tactiles et les compteurs ; on
/// coupe l'ambiance (dérive du héros, parallaxe, révélation au défilement, motifs en boucle).
class LiteMode {
  LiteMode._();
  static final LiteMode instance = LiteMode._();

  final ValueNotifier<bool> active = ValueNotifier(false);
  bool _weakDevice = false;
  bool _batterySaver = false;
  StreamSubscription<BatteryState>? _sub;

  /// 3 Go : en dessous, les Android d'entrée de gamme peinent déjà sur le flou et les ombres.
  static const int _ramThresholdMb = 3 * 1024;

  Future<void> init() async {
    try {
      if (!kIsWeb && Platform.isAndroid) {
        final info = await DeviceInfoPlugin().androidInfo;
        _weakDevice = info.isLowRamDevice || (info.physicalRamSize > 0 && info.physicalRamSize <= _ramThresholdMb);
      }
    } catch (e) {
      debugPrint('LiteMode device: $e');
    }
    await refreshBattery();
    try {
      _sub = Battery().onBatteryStateChanged.listen((_) => refreshBattery());
    } catch (e) {
      debugPrint('LiteMode battery stream: $e');
    }
    _apply();
  }

  /// Relu aussi au retour au premier plan (l'économiseur n'émet pas toujours d'événement).
  Future<void> refreshBattery() async {
    try {
      _batterySaver = await Battery().isInBatterySaveMode;
    } catch (_) {
      _batterySaver = false; // plateforme sans l'information : pas de mode lite pour ce motif
    }
    _apply();
  }

  void _apply() => active.value = _weakDevice || _batterySaver;

  @visibleForTesting
  void debugSet(bool v) => active.value = v;

  void dispose() => _sub?.cancel();
}
