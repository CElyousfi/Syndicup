import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Préférences « Sensations » de l'utilisateur, gardées sur l'appareil (décision D2) :
/// animations complètes / réduites, vibrations, sons. Tout est activé par défaut.
@immutable
class SensationsPrefs {
  const SensationsPrefs({this.reducedMotion = false, this.haptics = true, this.sounds = true});
  final bool reducedMotion;
  final bool haptics;
  final bool sounds;

  SensationsPrefs copyWith({bool? reducedMotion, bool? haptics, bool? sounds}) =>
      SensationsPrefs(reducedMotion: reducedMotion ?? this.reducedMotion, haptics: haptics ?? this.haptics, sounds: sounds ?? this.sounds);

  @override
  bool operator ==(Object other) => other is SensationsPrefs && other.reducedMotion == reducedMotion && other.haptics == haptics && other.sounds == sounds;

  @override
  int get hashCode => Object.hash(reducedMotion, haptics, sounds);
}

class Sensations {
  Sensations._();
  static final Sensations instance = Sensations._();

  static const _kReduced = 'sensations.reducedMotion';
  static const _kHaptics = 'sensations.haptics';
  static const _kSounds = 'sensations.sounds';

  final ValueNotifier<SensationsPrefs> prefs = ValueNotifier(const SensationsPrefs());
  SharedPreferences? _store;

  void load(SharedPreferences store) {
    _store = store;
    prefs.value = SensationsPrefs(
      reducedMotion: store.getBool(_kReduced) ?? false,
      haptics: store.getBool(_kHaptics) ?? true,
      sounds: store.getBool(_kSounds) ?? true,
    );
  }

  Future<void> update(SensationsPrefs next) async {
    prefs.value = next;
    await _store?.setBool(_kReduced, next.reducedMotion);
    await _store?.setBool(_kHaptics, next.haptics);
    await _store?.setBool(_kSounds, next.sounds);
  }
}
