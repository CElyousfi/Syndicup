import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'deeplinks/deeplinks.dart';
import 'home_widgets/home_widgets.dart';
import 'live/live_activities.dart';
import 'push/push_service.dart';

/// Démarrage à froid (M26-F) : seul l'indispensable précède le premier rendu (préférences,
/// session, formats de date, drapeaux « alive ») ; Firebase / notifications, widgets, activités en
/// direct et liens système s'initialisent **après la première image**. La coque attend [pret]
/// avant de consommer un chemin d'ouverture (notification, widget, raccourci), pour n'en perdre aucun.
class Bootstrap {
  Bootstrap._();
  static final _pret = Completer<void>();
  static Future<void> get pret => _pret.future;

  static void differe(SharedPreferences prefs) {
    if (_pret.isCompleted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        await PushService.instance.init(locale: Locale(prefs.getString('locale') ?? 'fr'));
        await HomeWidgets.instance.init();
        await LiveActivities.instance.init();
        await DeepLinks.instance.init();
      } finally {
        if (!_pret.isCompleted) _pret.complete();
      }
    });
  }
}
