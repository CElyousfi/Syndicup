import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/api/api_client.dart';
import 'package:syndicup/core/api/swr.dart';
import 'package:syndicup/core/auth/session.dart';

class _Tokens implements TokenSource {
  @override
  String? get accessToken => 'jeton';
  @override
  String? get refreshToken => null;
  @override
  String? get coproprieteId => 'c1';
  @override
  Future<void> onTokensRefreshed(Map<String, dynamic> tokens) async {}
  @override
  Future<void> onSessionExpired() async {}
  @override
  Future<bool> adoptStoredTokens(String spentRefreshToken) async => false;
}

/// Serveur injoignable (Wi-Fi sans internet) ou qui répond, au choix.
class _Adapter implements HttpClientAdapter {
  bool joignable = false;
  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    if (!joignable) throw DioException.connectionError(requestOptions: o, reason: 'injoignable');
    return ResponseBody.fromString('{"data":[{"id":"a1"}],"meta":{"request_id":"r"}}', 200, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}

final _annonces = FutureProvider.autoDispose<List<dynamic>>((ref) => swr(ref, '/annonces', coproprieteId: 'c1', disque: false, parse: (j) => j as List<dynamic>));

Future<void> _attendre(bool Function() fait) async {
  for (var i = 0; i < 50 && !fait(); i++) {
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
}

void main() {
  setUp(() => ReadCache.instance.clear());

  test('marquage direct : la plus ancienne date gagne, effacé par le serveur et à la déconnexion', () async {
    final c = ReadCache.instance;
    final t1 = DateTime(2026, 10, 18, 14, 2);
    c.markStale('/lots', t1);
    c.markStale('/lots', t1.add(const Duration(hours: 1)));
    expect(c.stale.value['/lots'], t1);
    c.clearStale('/lots');
    expect(c.stale.value.containsKey('/lots'), isFalse);
    c.markStale('/ag', t1);
    await c.clear();
    expect(c.stale.value, isEmpty);
  });

  test('copie servie, serveur injoignable → staleProvider porte la date de la copie ; serveur revenu → effacé', () async {
    final adapter = _Adapter();
    final api = ApiClient(_Tokens(), dio: Dio(BaseOptions(baseUrl: 'https://api.test', validateStatus: (_) => true))..httpClientAdapter = adapter);
    final container = ProviderContainer(overrides: [apiClientProvider.overrideWithValue(api)]);
    addTearDown(container.dispose);

    // Copie connue (écrite lors d'une visite précédente).
    await ReadCache.instance.write('c1|/annonces|{}', '[{"id":"ancienne"}]', disque: false);
    final copie = ReadCache.instance.savedAt('c1|/annonces|{}');
    expect(copie, isNotNull);

    final sub = container.listen(staleProvider('/annonces'), (_, __) {});
    addTearDown(sub.close);
    final keep = container.listen(_annonces, (_, __) {});
    addTearDown(keep.close);

    final data = await container.read(_annonces.future);
    expect(data.single['id'], 'ancienne'); // l'écran affiche la copie tout de suite
    await _attendre(() => container.read(staleProvider('/annonces')) != null);
    expect(container.read(staleProvider('/annonces')), copie);

    // Le serveur répond de nouveau : tirer-pour-actualiser → bandeau retiré.
    adapter.joignable = true;
    container.invalidate(_annonces);
    await container.read(_annonces.future);
    await _attendre(() => container.read(staleProvider('/annonces')) == null);
    expect(container.read(staleProvider('/annonces')), isNull);
  });

  test('aucune copie et serveur injoignable : erreur (pas de bandeau trompeur)', () async {
    final api = ApiClient(_Tokens(), dio: Dio(BaseOptions(baseUrl: 'https://api.test', validateStatus: (_) => true))..httpClientAdapter = _Adapter());
    final container = ProviderContainer(overrides: [apiClientProvider.overrideWithValue(api)]);
    addTearDown(container.dispose);
    final keep = container.listen(_annonces, (_, __) {});
    addTearDown(keep.close);
    await expectLater(container.read(_annonces.future), throwsA(anything));
    expect(container.read(staleProvider('/annonces')), isNull);
  });
}
