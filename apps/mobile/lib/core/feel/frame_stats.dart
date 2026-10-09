import 'dart:ui' show FrameTiming;

import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';

/// Mesure de fluidité (QA de la couche Alive) — inactive sauf build avec
/// `--dart-define=FRAME_STATS=true` (profil). Toutes les 2 s, écrit dans logcat la synthèse des
/// images rendues : temps UI (build) et raster, p50 / p90 / p99, part d'images > 16,7 ms.
/// À lire avec `adb logcat -s flutter | grep FRAME_STATS`.
const bool frameStatsEnabled = bool.fromEnvironment('FRAME_STATS');

void installFrameStats() {
  if (!frameStatsEnabled) return;
  final build = <double>[];
  final raster = <double>[];
  final total = <double>[];
  SchedulerBinding.instance.addTimingsCallback((List<FrameTiming> timings) {
    for (final t in timings) {
      build.add(t.buildDuration.inMicroseconds / 1000);
      raster.add(t.rasterDuration.inMicroseconds / 1000);
      total.add(t.totalSpan.inMicroseconds / 1000);
    }
    if (total.length < 30) return;
    double p(List<double> l, double q) => (l.toList()..sort())[(q * (l.length - 1)).round()];
    final slow = total.where((x) => x > 16.7).length / total.length * 100;
    debugPrint('FRAME_STATS n=${total.length} build p50=${p(build, .5).toStringAsFixed(1)} p90=${p(build, .9).toStringAsFixed(1)} p99=${p(build, .99).toStringAsFixed(1)} | raster p50=${p(raster, .5).toStringAsFixed(1)} p90=${p(raster, .9).toStringAsFixed(1)} p99=${p(raster, .99).toStringAsFixed(1)} | >16.7ms=${slow.toStringAsFixed(1)}%');
    build.clear();
    raster.clear();
    total.clear();
  });
}
