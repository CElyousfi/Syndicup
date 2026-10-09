import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';

import 'flags.dart';
import 'lite.dart';
import 'sensations.dart';

/// Sons SÉMANTIQUES — une seule famille douce (bois/verre), < 400 ms, < 30 Ko, préchargés.
/// Jamais sur un tap ordinaire : uniquement aux moments qui comptent (voir docs/ALIVE_GUIDE.md).
enum SuSound { confirm, success, sent, notify, error, signature }

class Sounds {
  Sounds._();
  static final Sounds instance = Sounds._();

  /// iOS : catégorie « ambient » → respecte le bouton silencieux et se mélange à la musique
  /// (jamais d'interruption d'un appel ou d'un morceau). Android : usage « sonification »,
  /// aucune prise de focus audio (la musique de l'utilisateur continue, sans baisse de volume).
  static final AudioContext _context = AudioContext(
    iOS: AudioContextIOS(category: AVAudioSessionCategory.ambient, options: const {}),
    android: const AudioContextAndroid(
      contentType: AndroidContentType.sonification,
      usageType: AndroidUsageType.assistanceSonification,
      audioFocus: AndroidAudioFocus.none,
    ),
  );

  final Map<SuSound, AudioPool> _pools = {};
  Future<void>? _loading;

  /// Journal de test : le dernier son demandé et réellement joué.
  @visibleForTesting
  static SuSound? lastPlayed;

  static bool get enabled => ClientFlags.instance.alive && Sensations.instance.prefs.value.sounds;

  /// Préchargement (au démarrage, sans bloquer) : chaque son tient dans un petit pool.
  Future<void> preload() => _loading ??= _doPreload();

  Future<void> _doPreload() async {
    for (final s in SuSound.values) {
      try {
        _pools[s] = await AudioPool.create(
          source: AssetSource('sounds/${s.name}.wav'),
          maxPlayers: 2,
          audioContext: _context,
          playerMode: PlayerMode.lowLatency,
        );
      } catch (e) {
        debugPrint('Sounds.preload(${s.name}): $e');
      }
    }
  }

  /// Joue [s] si l'utilisateur a gardé les sons. Le volume est volontairement bas.
  static Future<void> play(SuSound s, {bool ignorePrefs = false}) async {
    if (!ignorePrefs && !enabled) return;
    lastPlayed = s;
    final i = instance;
    if (i._pools[s] == null) await i.preload();
    try {
      await i._pools[s]?.start(volume: LiteMode.instance.active.value ? 0.45 : 0.55);
    } catch (e) {
      debugPrint('Sounds.play(${s.name}): $e');
    }
  }
}
