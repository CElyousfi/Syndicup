import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../api/api_result.dart';
import '../auth/session.dart';
import '../config/app_config.dart';

/// Porte de mise à jour, deux niveaux (GET /v1/app/version) — oct. 2026.
///   - `bloquer`  : version < minimale → écran plein, l'app ne s'ouvre pas.
///   - `proposer` : version < dernière → bandeau refermable (une fois par lancement).
///   - `ok` / erreur réseau → rien (ne jamais bloquer un utilisateur parce que l'API est injoignable).
enum UpdateStatut { bloquer, proposer, ok }

class UpdateVerdict {
  const UpdateVerdict({required this.statut, this.storeUrl, this.derniere, required this.versionClient});
  final UpdateStatut statut;
  final String? storeUrl;
  final String? derniere;
  final String versionClient;
  static const none = UpdateVerdict(statut: UpdateStatut.ok, versionClient: AppConfig.appVersion);
}

Future<String> currentAppVersion() async {
  try {
    return (await PackageInfo.fromPlatform()).version;
  } catch (_) {
    return AppConfig.appVersion;
  }
}

final updateVerdictProvider = FutureProvider<UpdateVerdict>((ref) async {
  final version = await currentAppVersion();
  final plateforme = Platform.isIOS ? 'ios' : 'android';
  final res = await ref.read(apiClientProvider).get<Map<String, dynamic>>(
        '/app/version',
        query: {'plateforme': plateforme, 'version': version},
        auth: false,
        parse: (j) => (j as Map).cast<String, dynamic>(),
      );
  if (res is! ApiOk<Map<String, dynamic>>) return UpdateVerdict(statut: UpdateStatut.ok, versionClient: version);
  final d = res.data;
  final statut = switch (d['statut']) {
    'bloquer' => UpdateStatut.bloquer,
    'proposer' => UpdateStatut.proposer,
    _ => UpdateStatut.ok,
  };
  return UpdateVerdict(
    statut: statut,
    storeUrl: d['url_store'] as String?,
    derniere: d['derniere'] as String?,
    versionClient: version,
  );
});

/// Bandeau « mise à jour disponible » fermé pour ce lancement.
final updateBannerDismissedProvider = StateProvider<bool>((_) => false);
