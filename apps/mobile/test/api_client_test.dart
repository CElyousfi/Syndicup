import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/api/api_client.dart';
import 'package:syndicup/core/api/api_result.dart';

class _Tokens implements TokenSource {
  String? access = 'ancien';
  String? refresh = 'rt-1';
  int expirations = 0;
  @override
  String? get accessToken => access;
  @override
  String? get refreshToken => refresh;
  @override
  String? get coproprieteId => 'c1';
  @override
  Future<void> onTokensRefreshed(Map<String, dynamic> tokens) async {
    access = tokens['access_token'] as String;
    refresh = tokens['refresh_token'] as String;
  }

  @override
  Future<void> onSessionExpired() async {
    expirations++;
    access = null;
    refresh = null;
  }

  /// Trousseau simulé : jetons écrits par un autre isolate.
  String? stockeAccess, stockeRefresh;
  @override
  Future<bool> adoptStoredTokens(String spentRefreshToken) async {
    if (stockeRefresh == null || stockeRefresh == spentRefreshToken) return false;
    access = stockeAccess;
    refresh = stockeRefresh;
    return true;
  }
}

/// Serveur factice : `/auth/refresh` répond après un délai (pour que les 401 se chevauchent),
/// les lectures exigent le nouveau jeton.
class _Adapter implements HttpClientAdapter {
  _Adapter({this.refreshOk = true, this.refreshValide});
  final bool refreshOk;

  /// Seul refresh token accepté (null = tous).
  final String? refreshValide;
  int refreshCalls = 0;
  final idempotencyKeys = <String>[];

  ResponseBody _json(Object body, int status) => ResponseBody.fromString(jsonEncode(body), status, headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      });

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    final k = o.headers['Idempotency-Key'];
    if (k is String) idempotencyKeys.add(k);
    if (o.path == '/auth/refresh') {
      refreshCalls++;
      await Future<void>.delayed(const Duration(milliseconds: 30));
      final corps = o.data is String ? jsonDecode(o.data as String) : o.data;
      final envoye = (corps as Map)['refresh_token'];
      if (!refreshOk || (refreshValide != null && envoye != refreshValide)) return _json({'error': {'code': 'UNAUTHENTICATED', 'message': 'Refresh token invalide.'}}, 401);
      return _json({'data': {'access_token': 'nouveau', 'refresh_token': 'rt-2', 'expires_in': 3600}, 'meta': {'request_id': 'r'}}, 200);
    }
    if (o.path == '/illisible') return _json({'data': {'x': 1}, 'meta': {'request_id': 'r'}}, 200);
    if (o.headers['Authorization'] != 'Bearer nouveau') {
      return _json({'error': {'code': 'UNAUTHENTICATED', 'message': 'Jeton expiré.'}, 'meta': {'request_id': 'r'}}, 401);
    }
    return _json({'data': {'ok': true}, 'meta': {'request_id': 'r'}}, 200);
  }

  @override
  void close({bool force = false}) {}
}

ApiClient _client(_Tokens t, _Adapter a) {
  final dio = Dio(BaseOptions(baseUrl: 'http://test', validateStatus: (_) => true, responseType: ResponseType.json))..httpClientAdapter = a;
  return ApiClient(t, dio: dio);
}

void main() {
  test('401 en parallèle : UN seul rafraîchissement de jetons, tous les appels rejoués', () async {
    final t = _Tokens();
    final a = _Adapter();
    final api = _client(t, a);
    final res = await Future.wait([for (var i = 0; i < 5; i++) api.get<dynamic>('/lots')]);
    expect(a.refreshCalls, 1);
    expect(res.every((r) => r.ok), isTrue);
    expect(t.access, 'nouveau');
  });

  test('refresh refusé : session expirée signalée une fois, erreur UNAUTHENTICATED', () async {
    final t = _Tokens();
    final a = _Adapter(refreshOk: false);
    final api = _client(t, a);
    var signale = 0;
    api.onSessionExpired = () => signale++;
    final res = await Future.wait([api.get<dynamic>('/lots'), api.get<dynamic>('/ag')]);
    expect(a.refreshCalls, 1);
    expect(signale, 1);
    expect(t.expirations, 1);
    expect(res.every((r) => r is ApiFail && r.status == 401), isTrue);
  });

  test('rejeu après 401 : même Idempotency-Key', () async {
    final t = _Tokens();
    final a = _Adapter();
    final api = _client(t, a);
    final r = await api.post<dynamic>('/finances/paiements', body: {'montant': '10.00'}, idempotencyKey: '11111111-1111-4111-8111-111111111111');
    expect(r.ok, isTrue);
    expect(a.idempotencyKeys.where((k) => k == '11111111-1111-4111-8111-111111111111').length, 2);
  });

  test('réponse illisible : code PARSE_ERROR, aucun texte technique', () async {
    final t = _Tokens()..access = 'nouveau';
    final api = _client(t, _Adapter());
    final r = await api.get<List<String>>('/illisible', parse: (j) => (j as List).cast<String>());
    expect(r, isA<ApiFail<List<String>>>());
    final f = r as ApiFail<List<String>>;
    expect(f.error.code, 'PARSE_ERROR');
    expect(f.error.message, isEmpty);
  });

  test('refresh token déjà consommé par l\'isolate de notification : jetons du trousseau adoptés, pas de déconnexion', () async {
    final t = _Tokens()
      ..stockeAccess = 'isolate'
      ..stockeRefresh = 'rt-isolate';
    final a = _Adapter(refreshValide: 'rt-isolate');
    final api = _client(t, a);
    var signale = 0;
    api.onSessionExpired = () => signale++;
    final r = await api.get<dynamic>('/lots');
    expect(r.ok, isTrue);
    expect(signale, 0);
    expect(t.expirations, 0);
    expect(a.refreshCalls, 2);
  });
}
