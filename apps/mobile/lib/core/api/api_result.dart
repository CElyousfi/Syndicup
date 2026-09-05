/// Enveloppes de l'API (Master Spec Partie 3.1) :
///   succès `{ data, meta: { request_id, total?, page?, has_more? } }`
///   erreur `{ error: { code, message, fields? }, meta: { request_id } }`
class ApiMeta {
  final String requestId;
  final int? total;
  final int? page;
  final bool? hasMore;
  const ApiMeta({required this.requestId, this.total, this.page, this.hasMore});

  factory ApiMeta.fromJson(Map<String, dynamic>? j) => ApiMeta(
        requestId: (j?['request_id'] ?? '') as String,
        total: (j?['total'] as num?)?.toInt(),
        page: (j?['page'] as num?)?.toInt(),
        hasMore: j?['has_more'] as bool?,
      );
}

class ApiError {
  final String code;
  final String message;
  final Map<String, String> fields;
  const ApiError({required this.code, required this.message, this.fields = const {}});

  factory ApiError.fromJson(Map<String, dynamic> j) => ApiError(
        code: (j['code'] ?? 'INTERNAL_ERROR') as String,
        message: (j['message'] ?? '') as String,
        fields: (j['fields'] as Map?)?.map((k, v) => MapEntry(k.toString(), v.toString())) ?? const {},
      );

  const ApiError.network([this.message = 'API injoignable.'])
      : code = 'NETWORK',
        fields = const {};

  /// 422 « gaté légalement » (paramètre légal non configuré — brief §6.3) : bannière
  /// d'information, jamais une erreur rouge. Même heuristique que apps/web/lib/forms.ts.
  bool get isLegalGate =>
      code == 'UNPROCESSABLE_ENTITY' &&
      RegExp(r'non configur|confirmation juridique|LEGAL_QUESTIONS', caseSensitive: false)
          .hasMatch(message);
}

sealed class ApiResult<T> {
  const ApiResult();
  bool get ok => this is ApiOk<T>;
  T? get dataOrNull => switch (this) { ApiOk<T>(:final data) => data, _ => null };
  ApiError? get errorOrNull => switch (this) { ApiFail<T>(:final error) => error, _ => null };
}

class ApiOk<T> extends ApiResult<T> {
  final T data;
  final ApiMeta meta;
  final int status;
  const ApiOk(this.data, this.meta, this.status);
}

class ApiFail<T> extends ApiResult<T> {
  final ApiError error;
  final int status;
  final String? requestId;
  final int? retryAfter;
  const ApiFail(this.error, this.status, {this.requestId, this.retryAfter});
}

/// Exception levée par les lectures (`FutureProvider`) — l'UI la rend en état d'erreur.
class ApiException implements Exception {
  final ApiError error;
  final int status;
  final String? requestId;
  const ApiException(this.error, this.status, {this.requestId});
  @override
  String toString() => 'ApiException(${error.code} $status): ${error.message}';
}
