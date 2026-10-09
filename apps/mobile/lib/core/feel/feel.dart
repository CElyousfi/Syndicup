import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'flags.dart';
import 'lite.dart';
import 'sensations.dart';
import 'sounds.dart';

export 'flags.dart';
export 'haptics.dart';
export 'lite.dart';
export 'sensations.dart';
export 'sounds.dart';

/// Couche « Alive » — point d'entrée unique (docs/ALIVE_GUIDE.md).
///
/// `Feel.alive`   : drapeau serveur alive_v1 (dernière valeur connue, défaut ON) ;
/// `Feel.ambient` : effets d'ambiance autorisés (alive, pas de mode lite, animations non réduites).
class Feel {
  Feel._();

  /// Démarrage : valeurs locales synchrones, puis réseau/appareil sans bloquer le premier écran.
  static Future<void> init(SharedPreferences prefs) async {
    ClientFlags.instance.load(prefs);
    Sensations.instance.load(prefs);
    // Rien de tout cela ne retarde runApp : drapeau serveur, appareil et sons arrivent ensuite.
    ClientFlags.instance.refresh();
    LiteMode.instance.init();
    Sounds.instance.preload();
  }

  /// Retour au premier plan : drapeau (≤ 1/min) et économiseur de batterie relus.
  static void onResume() {
    ClientFlags.instance.refresh();
    LiteMode.instance.refreshBattery();
  }

  static bool get alive => ClientFlags.instance.alive;

  static bool get lite => LiteMode.instance.active.value;

  /// Mouvement « alive » permis dans ce contexte : drapeau ON et animations non réduites
  /// (préférence système OU réglage Sensations, déjà fusionnés dans MediaQuery par app.dart).
  static bool motion(BuildContext context) => alive && !(MediaQuery.maybeDisableAnimationsOf(context) ?? false);

  /// Effets d'ambiance (dérive, parallaxe, révélation au défilement) : en plus, pas de mode lite.
  static bool ambient(BuildContext context) => motion(context) && !lite;

  /// Notifie à chaque changement de drapeau, de préférences ou de mode lite.
  static final Listenable changes = Listenable.merge([ClientFlags.instance.values, Sensations.instance.prefs, LiteMode.instance.active]);
}
