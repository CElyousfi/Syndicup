import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../i18n/i18n.dart';
import '../i18n/mobile_dict.dart';
import '../push/push_service.dart';
import '../widgets/forms.dart';
import 'session.dart';

/// Délai maximal accordé au retrait du jeton push avant la déconnexion : hors ligne (ou serveur
/// muet), la déconnexion ne doit jamais rester suspendue au délai réseau de 15 s du client.
const logoutPushTimeout = Duration(seconds: 3);

/// Déconnexion demandée par l'utilisateur : confirmation d'abord (geste destructif, facile à
/// toucher par erreur dans un menu), puis retrait du jeton push borné dans le temps, puis fin de
/// session. `true` si l'utilisateur est déconnecté.
/// Le conteneur Riverpod est lu AVANT la confirmation : l'appelant (menu, feuille) peut être
/// démonté pendant le dialogue.
Future<bool> confirmerDeconnexion(BuildContext context) async {
  final container = ProviderScope.containerOf(context, listen: false);
  final up = context.mup;
  final ok = await confirmDialog(context, title: up.logoutTitle, body: up.logoutBody, confirmLabel: context.dict.common.logout, danger: true);
  if (!ok) return false;
  await deconnecter(container);
  return true;
}

/// Fin de session sans attente réseau bloquante (aussi utilisée après confirmation).
Future<void> deconnecter(ProviderContainer container) async {
  try {
    await PushService.instance.unregisterToken(container.read(apiClientProvider)).timeout(logoutPushTimeout);
  } on TimeoutException {
    // Le serveur oubliera l'appareil au prochain envoi refusé (jeton FCM invalide) : rien de
    // bloquant pour l'utilisateur.
    debugPrint('Déconnexion : retrait du jeton push abandonné après ${logoutPushTimeout.inSeconds} s (hors ligne ?)');
  } catch (e) {
    // Plugin push indisponible, etc. : la déconnexion locale doit aboutir quand même.
    debugPrint('Déconnexion : retrait du jeton push impossible ($e)');
  }
  await container.read(sessionProvider.notifier).signOut();
}
