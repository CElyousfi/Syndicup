import 'dart:io';

import 'package:dio/dio.dart';
import 'package:uuid/uuid.dart';

import '../config/app_config.dart';
import 'api_result.dart';

/// Jetons & contexte tenant fournis par la session (core/auth).
abstract class TokenSource {
  String? get accessToken;
  String? get refreshToken;
  String? get coproprieteId;

  /// Nouveaux jetons après un rafraîchissement silencieux.
  Future<void> onTokensRefreshed(Map<String, dynamic> tokens);

  /// Le refresh token est lui-même invalide : la session est terminée.
  Future<void> onSessionExpired();
}

typedef Parse<T> = T Function(dynamic json);

/// Client HTTP unique — tout passe par l'API (CLAUDE.md §1.4). Enveloppe `{data, meta}` /
/// `{error, meta}`, `Authorization: Bearer`, `X-Copropriete-Id` (choix explicite de la
/// copropriété active, revérifié côté serveur contre les claims du JWT), `X-Request-Id`
/// (corrélation client ↔ logs), `Idempotency-Key` (uuid) sur les écritures financières /
/// probantes — « Réessayer » est donc toujours sûr.
class ApiClient {
  ApiClient(this._tokens, {Dio? dio})
      : _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: AppConfig.apiBaseUrl,
                connectTimeout: const Duration(seconds: 15),
                receiveTimeout: const Duration(seconds: 30),
                sendTimeout: const Duration(seconds: 30),
                headers: {'Accept': 'application/json'},
                responseType: ResponseType.json,
                // Les codes d'erreur métier sont des réponses normales, pas des exceptions.
                validateStatus: (_) => true,
              ),
            );

  final Dio _dio;
  final TokenSource _tokens;
  static const _uuid = Uuid();

  String get baseUrl => _dio.options.baseUrl;

  Future<ApiResult<T>> get<T>(String path, {Map<String, Object?>? query, Parse<T>? parse, String? coproprieteId}) =>
      request<T>('GET', path, query: query, parse: parse, coproprieteId: coproprieteId);

  Future<ApiResult<T>> post<T>(String path, {Object? body, bool idempotent = false, String? idempotencyKey, Parse<T>? parse, bool auth = true, String? coproprieteId, String? accessToken}) =>
      request<T>('POST', path, body: body, idempotent: idempotent, idempotencyKey: idempotencyKey, parse: parse, auth: auth, coproprieteId: coproprieteId, accessToken: accessToken);

  Future<ApiResult<T>> patch<T>(String path, {Object? body, Parse<T>? parse, String? coproprieteId}) =>
      request<T>('PATCH', path, body: body, parse: parse, coproprieteId: coproprieteId);

  Future<ApiResult<T>> delete<T>(String path, {Object? body, Parse<T>? parse}) => request<T>('DELETE', path, body: body, parse: parse);

  Future<ApiResult<T>> request<T>(
    String method,
    String path, {
    Object? body,
    Map<String, Object?>? query,
    bool idempotent = false,
    String? idempotencyKey,
    Parse<T>? parse,
    bool auth = true,
    String? coproprieteId,
    String? accessToken,
    bool retried = false,
  }) async {
    final headers = <String, String>{'X-Request-Id': _uuid.v4()};
    if (body != null) headers['Content-Type'] = 'application/json';
    if (idempotent || idempotencyKey != null) headers['Idempotency-Key'] = idempotencyKey ?? _uuid.v4();

    if (auth) {
      final token = accessToken ?? _tokens.accessToken;
      if (token == null) {
        return ApiFail<T>(const ApiError(code: 'UNAUTHENTICATED', message: 'Session absente.'), 401);
      }
      headers['Authorization'] = 'Bearer $token';
      final copro = coproprieteId ?? _tokens.coproprieteId;
      if (copro != null && copro.isNotEmpty) headers['X-Copropriete-Id'] = copro;
    }

    final qp = <String, dynamic>{};
    query?.forEach((k, v) {
      if (v != null) qp[k] = v;
    });
    Response<dynamic> res;
    try {
      res = await _dio.request<dynamic>(
        path,
        data: body,
        queryParameters: qp.isEmpty ? null : qp,
        options: Options(method: method, headers: headers),
      );
    } on DioException catch (e) {
      final msg = e.type == DioExceptionType.connectionTimeout || e.type == DioExceptionType.receiveTimeout
          ? 'Délai dépassé — vérifiez votre connexion.'
          : 'API injoignable.';
      return ApiFail<T>(ApiError.network(msg), 0);
    } on SocketException {
      return ApiFail<T>(const ApiError.network(), 0);
    }

    final payload = res.data is Map<String, dynamic> ? res.data as Map<String, dynamic> : <String, dynamic>{};
    final status = res.statusCode ?? 0;

    if (status >= 400 || payload.containsKey('error')) {
      // Jeton expiré : un seul rafraîchissement silencieux puis rejeu de l'appel.
      if (status == 401 && auth && accessToken == null && !retried && _tokens.refreshToken != null) {
        final refreshed = await refreshSession();
        if (refreshed) {
          return request<T>(method, path,
              body: body, query: query, idempotent: idempotent, idempotencyKey: headers['Idempotency-Key'],
              parse: parse, auth: auth, coproprieteId: coproprieteId, retried: true);
        }
      }
      final err = payload['error'] is Map<String, dynamic>
          ? ApiError.fromJson(payload['error'] as Map<String, dynamic>)
          : ApiError(code: status == 0 ? 'NETWORK' : 'INTERNAL_ERROR', message: 'Réponse inattendue ($status).');
      final retryAfter = int.tryParse(res.headers.value('retry-after') ?? '');
      final requestId = (payload['meta'] as Map?)?['request_id'] as String? ?? res.headers.value('x-request-id');
      return ApiFail<T>(err, status, requestId: requestId, retryAfter: retryAfter);
    }

    final data = payload['data'];
    final meta = ApiMeta.fromJson(payload['meta'] as Map<String, dynamic>?);
    try {
      final parsed = parse != null ? parse(data) : data as T;
      return ApiOk<T>(parsed, meta, status);
    } catch (e) {
      return ApiFail<T>(ApiError(code: 'INTERNAL_ERROR', message: 'Réponse illisible : $e'), status, requestId: meta.requestId);
    }
  }

  /// POST /auth/refresh — rotation des jetons. `false` si le refresh token est mort.
  Future<bool> refreshSession() async {
    final rt = _tokens.refreshToken;
    if (rt == null) return false;
    final res = await post<Map<String, dynamic>>(
      '/auth/refresh',
      body: {'refresh_token': rt},
      auth: false,
      parse: (j) => (j as Map).cast<String, dynamic>(),
    );
    if (res is ApiOk<Map<String, dynamic>>) {
      await _tokens.onTokensRefreshed(res.data);
      return true;
    }
    if (res is ApiFail<Map<String, dynamic>> && res.status == 401) {
      await _tokens.onSessionExpired();
    }
    return false;
  }

  /// Téléchargement binaire authentifié (PDF rendus par l'API : quittance, PV, rapport de gestion,
  /// relevé de charges) — même en-têtes que `request`, corps brut. `null` en cas d'échec.
  Future<List<int>?> getBytes(String path, {Map<String, Object?>? query}) async {
    final token = _tokens.accessToken;
    if (token == null) return null;
    final headers = <String, String>{'X-Request-Id': _uuid.v4(), 'Authorization': 'Bearer $token'};
    final copro = _tokens.coproprieteId;
    if (copro != null && copro.isNotEmpty) headers['X-Copropriete-Id'] = copro;
    final qp = <String, dynamic>{};
    query?.forEach((k, v) {
      if (v != null) qp[k] = v;
    });
    try {
      final res = await _dio.get<List<int>>(path, queryParameters: qp.isEmpty ? null : qp, options: Options(headers: headers, responseType: ResponseType.bytes, validateStatus: (_) => true, receiveTimeout: const Duration(seconds: 60)));
      if ((res.statusCode ?? 500) >= 300) return null;
      return res.data;
    } catch (_) {
      return null;
    }
  }

  /// Téléversement direct vers une URL signée Supabase Storage (documents, photos d'incident,
  /// logo) — seule exception d'architecture autorisée (Master Spec 9.3, comme le web).
  Future<bool> uploadSigned(String uploadUrl, List<int> bytes, String contentType) async {
    try {
      final res = await Dio().put<dynamic>(
        uploadUrl,
        data: Stream.fromIterable([bytes]),
        options: Options(
          headers: {'Content-Type': contentType, 'x-upsert': 'true', 'Content-Length': bytes.length},
          validateStatus: (_) => true,
        ),
      );
      return (res.statusCode ?? 500) < 300;
    } catch (_) {
      return false;
    }
  }
}

/// `data` de liste → liste typée.
List<T> parseList<T>(dynamic json, T Function(Map<String, dynamic>) f) {
  if (json is! List) return const [];
  return json.whereType<Map>().map((e) => f(e.cast<String, dynamic>())).toList();
}

Map<String, dynamic> asMap(dynamic json) => (json as Map).cast<String, dynamic>();

/// Extrait `data` d'un ApiResult ou lève ApiException (lectures via FutureProvider).
T unwrap<T>(ApiResult<T> r) => switch (r) {
      ApiOk<T>(:final data) => data,
      ApiFail<T>(:final error, :final status, :final requestId) => throw ApiException(error, status, requestId: requestId),
    };
