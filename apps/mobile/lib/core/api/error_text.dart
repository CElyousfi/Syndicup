import 'package:flutter/widgets.dart';

import '../i18n/i18n.dart';
import '../i18n/mobile_dict.dart';
import 'api_result.dart';

/// Ce que l'écran propose après une erreur.
enum ErrorAction {
  /// « Réessayer » (réseau, délai, 5xx) — sûr : les écritures portent une clé d'idempotence stable.
  retry,

  /// « Actualiser » : l'objet a changé côté serveur (statut, conflit).
  refresh,

  /// « Se reconnecter » : la session est terminée.
  reconnect,

  /// « Retour à la liste » : l'objet n'existe plus.
  backToList,

  /// Rien à proposer (accès réservé, fonctionnalité non activée, règle métier).
  none,
}

/// Erreur prête à afficher, dans la langue de l'utilisateur.
@immutable
class ErrorText {
  const ErrorText({required this.title, required this.body, required this.action, this.reference});
  final String title;
  final String body;
  final ErrorAction action;

  /// Référence courte pour le support (8 premiers caractères du request_id) — erreurs 5xx seulement.
  final String? reference;

  /// Une ligne pour un toast : le corps, suivi de la référence s'il y en a une.
  String get line => reference == null ? body : '$body · $reference';
}

/// Retire les références de spécification des messages serveur (« (Partie 5.5) », « (Doc A §8) »,
/// « Doc A §2.1 », « Master Spec 3.1 ») : elles parlent aux développeurs, pas aux résidents.
/// Même prudence que l'API (respond.ts) : « Partie » et « § » seuls sont du vocabulaire métier
/// (« § 4.2 du règlement », « art. 16 §2 ») et restent ; seules les formes préfixées partent,
/// et « (Partie n) » seule entre parenthèses.
String stripSpecRefs(String message) {
  var s = message;
  const prefixe = r'(?:Doc\s*A|Master\s*Spec|LEGAL_QUESTIONS(?:_BRIEF)?|BRIEF|CLAUDE\.md)';
  // Parenthèses qui citent une source préfixée (« (Doc A §2.1 : propriétaire MRE) »).
  s = s.replaceAll(RegExp(r'\s*\([^()]*' + prefixe + r'[^()]*\)'), '');
  s = s.replaceAll(RegExp(r'\s*\(\s*Partie\s*\d+(?:\.\d+)*\s*\)'), '');
  // Références préfixées nues (« — Master Spec Partie 2.4 », « Doc A §8.3 »).
  s = s.replaceAll(RegExp(r'\s*[—–]?\s*' + prefixe + r'(?:\s*(?:Partie|§)?\s*\d+(?:\.\d+)*)*'), '');
  s = s.replaceAll(RegExp(r'\s{2,}'), ' ');
  s = s.replaceAllMapped(RegExp(r'\s+([.,;:!?])'), (m) => m.group(1)!);
  return s.trim();
}

/// Codes « transport » produits par le client lui-même (jamais par l'API).
const clientErrorCodes = {'NETWORK', 'TIMEOUT', 'PARSE_ERROR', 'BAD_RESPONSE'};

/// Traduction d'une erreur de l'API dans la langue de l'appareil (FR / AR). Jamais le message
/// brut du serveur en arabe ; en français, le message serveur (sans références de spec) sert de
/// repli quand le code n'est pas connu du client.
ErrorText errorText(BuildContext context, ApiError error, int status, {int? retryAfter, String? requestId}) {
  final locale = Localizations.maybeLocaleOf(context) ?? const Locale('fr');
  return errorTextFor(locale, error, status, retryAfter: retryAfter, requestId: requestId);
}

/// Variante sans BuildContext (tests, isolate de notifications).
ErrorText errorTextFor(Locale locale, ApiError error, int status, {int? retryAfter, String? requestId}) {
  final ux = MobileDict.of(locale).ux;
  final arabic = locale.isAr;
  final code = error.code;
  final serveur = arabic ? '' : stripSpecRefs(error.message);
  String or(String generic) => serveur.isEmpty ? generic : serveur;
  final ref = (status >= 500 || code == 'INTERNAL_ERROR') && requestId != null && requestId.isNotEmpty
      ? fill(ux.errReference, {'id': requestId.length > 8 ? requestId.substring(0, 8) : requestId})
      : null;

  ErrorText t(String title, String body, ErrorAction action) => ErrorText(title: title, body: body, action: action, reference: ref);

  switch (code) {
    case 'NETWORK':
      return t(ux.errNetworkTitle, ux.errNetworkBody, ErrorAction.retry);
    case 'TIMEOUT':
      return t(ux.errTimeoutTitle, ux.errTimeoutBody, ErrorAction.retry);
    case 'PARSE_ERROR':
    case 'BAD_RESPONSE':
      return t(ux.errParseTitle, ux.errParseBody, ErrorAction.retry);
    case 'VALIDATION_ERROR':
      // Le détail est posé sous chaque champ (`fields`) ; « Payload invalide. » ne parle à personne.
      return t(ux.errValidationTitle, ux.errValidationBody, ErrorAction.none);
    case 'UNAUTHENTICATED':
      return t(ux.errUnauthTitle, ux.errUnauthBody, ErrorAction.reconnect);
    case 'FORBIDDEN':
      return t(ux.errForbiddenTitle, ux.errForbiddenBody, ErrorAction.none);
    case 'PAYMENT_REQUIRED':
      return t(ux.errForbiddenTitle, ux.accessSuspended, ErrorAction.none);
    case 'NOT_FOUND':
      return t(ux.errNotFoundTitle, ux.errNotFoundBody, ErrorAction.backToList);
    case 'CONFLICT':
      return t(ux.errConflictTitle, or(ux.errConflictBody), ErrorAction.refresh);
    case 'UNPROCESSABLE_ENTITY':
      return t(ux.errUnprocessableTitle, or(ux.errUnprocessableBody), ErrorAction.none);
    case 'RATE_LIMITED':
      final body = retryAfter != null && retryAfter > 0 ? fill(ux.errRateBody, {'min': ((retryAfter + 59) ~/ 60).clamp(1, 1440)}) : ux.errRateBodyGeneric;
      return t(ux.errRateTitle, body, ErrorAction.none);
    case 'NOT_IMPLEMENTED':
      return t(ux.errNotImplTitle, ux.errNotImplBody, ErrorAction.none);
    case 'SERVICE_UNAVAILABLE':
      return t(ux.errUnavailableTitle, ux.errUnavailableBody, ErrorAction.retry);
    case 'INTERNAL_ERROR':
      return t(ux.errInternalTitle, ux.errInternalBody, ErrorAction.retry);
  }

  // Codes métier (apps/api/lib/http/respond.ts).
  if (code.endsWith('_STATUT_INVALIDE')) return t(ux.errStaleTitle, ux.errStaleBody, ErrorAction.refresh);
  if (code.endsWith('_PARAMETRE_NON_CONFIGURE') || code.endsWith('_PARAMETRES_NON_CONFIGURES')) {
    return t(ux.errParamTitle, or(ux.errParamBody), ErrorAction.none);
  }
  final connu = ux.codes[code];
  if (connu != null) return t(status == 409 ? ux.errConflictTitle : ux.errUnprocessableTitle, connu, status == 409 ? ErrorAction.refresh : ErrorAction.none);

  // Code inconnu du client : on se rabat sur le statut HTTP.
  if (status == 402) return t(ux.errForbiddenTitle, ux.accessSuspended, ErrorAction.none);
  if (status == 403) return t(ux.errForbiddenTitle, ux.errForbiddenBody, ErrorAction.none);
  if (status == 404) return t(ux.errNotFoundTitle, ux.errNotFoundBody, ErrorAction.backToList);
  if (status == 409) return t(ux.errConflictTitle, or(ux.errConflictBody), ErrorAction.refresh);
  if (status == 503) return t(ux.errUnavailableTitle, ux.errUnavailableBody, ErrorAction.retry);
  if (status >= 500 || status == 0) return t(ux.errInternalTitle, ux.errInternalBody, ErrorAction.retry);
  return t(ux.errUnprocessableTitle, or(ux.errUnprocessableBody), ErrorAction.none);
}

/// Raccourcis pour les deux formes d'erreur de l'app.
extension ApiFailText on ApiFail<dynamic> {
  ErrorText text(BuildContext context) => errorText(context, error, status, retryAfter: retryAfter, requestId: requestId);
}

extension ApiExceptionText on ApiException {
  ErrorText text(BuildContext context) => errorText(context, error, status, requestId: requestId);
}

/// Erreur mémorisée par une file hors-ligne (« CODE: message ») → texte dans la langue de
/// l'utilisateur ; `null` si rien n'est mémorisé.
String? erreurFile(BuildContext context, String? stockee) {
  if (stockee == null || stockee.isEmpty) return null;
  final i = stockee.indexOf(':');
  final code = (i < 0 ? stockee : stockee.substring(0, i)).trim();
  final message = i < 0 ? '' : stockee.substring(i + 1).trim();
  if (!RegExp(r'^[A-Z][A-Z0-9_]*$').hasMatch(code)) return null;
  return errorText(context, ApiError(code: code, message: message), 422).body;
}
