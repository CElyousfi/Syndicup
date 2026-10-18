import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'api_client.dart';
import 'api_result.dart';

/// Envois de fichiers (pièces jointes, photos, documents) : URL signée par l'API puis PUT direct
/// vers Supabase Storage (seule exception d'architecture autorisée — Master Spec 9.3).
///
///  - **Contrôle avant tout appel** : type et taille sont vérifiés sur l'appareil contre la liste
///    blanche de l'endpoint (apps/api/lib/*/schemas.ts) et le plafond utilisé par le web, AVANT de
///    demander une URL signée : « Fichier trop lourd (max 15 Mo) » plutôt qu'un 413 opaque.
///  - **Flux** : le fichier part en flux (`openRead` + Content-Length), jamais lu en entier en
///    mémoire — une vidéo de 50 Mo ne fait pas tomber un téléphone d'entrée de gamme.
///  - **Résultat typé** : [UploadOk] (chemin de stockage) ou [UploadFailed] (TOO_LARGE, BAD_TYPE,
///    NETWORK, STORAGE, CANCELLED, ou l'erreur de l'API), traduit par errorText().
///  - **Pas de double envoi** : [UploadQueue] retient les chemins déjà envoyés d'un formulaire ;
///    « Réessayer » sur l'envoi final ne renvoie que les fichiers qui ont échoué.

/// Fichier choisi sur l'appareil, pas encore envoyé.
@immutable
class PieceLocale {
  const PieceLocale({required this.nom, required this.chemin, required this.contentType, this.taille});
  final String nom, chemin, contentType;

  /// Taille en octets (connue au choix du fichier ; lue sur le disque sinon).
  final int? taille;

  bool get estImage => contentType.startsWith('image/');
  bool get estVideo => contentType.startsWith('video/');
}

/// Famille de formats acceptés — porte le message « Format non accepté : … ».
enum UploadKind { images, imagesPdf, documents }

/// Endpoint `…/upload-url` et ses règles (miroir des schémas Zod de l'API et des plafonds du web).
@immutable
class UploadTarget {
  const UploadTarget({required this.path, required this.types, required this.maxMo, required this.kind, this.extra = const {}});

  /// Chemin de l'API qui délivre l'URL signée.
  final String path;

  /// Types MIME acceptés (en minuscules, sans paramètres).
  final Set<String> types;

  /// Plafond en Mo (1 Mo = 1024 × 1024 octets, comme le web : `15 * 1024 * 1024`).
  final int maxMo;
  final UploadKind kind;

  /// Champs supplémentaires du corps (`cle` d'une photo de résidence).
  final Map<String, Object?> extra;

  int get maxBytes => maxMo * 1024 * 1024;

  /// Images envoyées par l'appareil photo ou la galerie (schémas incidents/justificatifs/…).
  static const imageTypes = {'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'};
  static const imagePdfTypes = {...imageTypes, 'application/pdf'};

  /// apps/api/lib/documents/schemas.ts — DOCUMENT_CONTENT_TYPES.
  static const documentTypes = {
    ...imageTypes,
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',
    'application/rtf',
    'text/rtf',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
  };

  /// Photos d'un signalement : images seulement (incidents/schemas.ts), 15 Mo.
  static const incidents = UploadTarget(path: '/incidents/upload-url', types: imageTypes, maxMo: 15, kind: UploadKind.images);

  /// Documents de la copropriété : liste large (documents/schemas.ts), plafond du bucket 50 Mo.
  static const documents = UploadTarget(path: '/documents/upload-url', types: documentTypes, maxMo: 50, kind: UploadKind.documents);

  /// Preuve de paiement : image ou PDF, 15 Mo (web : finances/justificatifs/actions.ts).
  static const justificatifs = UploadTarget(path: '/finances/justificatifs/upload-url', types: imagePdfTypes, maxMo: 15, kind: UploadKind.imagesPdf);

  /// Justificatif d'une dépense : image ou PDF, 15 Mo (web : finances/depenses/actions.ts).
  static const depenses = UploadTarget(path: '/depenses/upload-url', types: imagePdfTypes, maxMo: 15, kind: UploadKind.imagesPdf);

  /// Photo d'avancement d'une tâche : image ou PDF, 15 Mo (web : taches/actions.ts).
  static const taches = UploadTarget(path: '/taches/upload-url', types: imagePdfTypes, maxMo: 15, kind: UploadKind.imagesPdf);

  /// Pièces jointes d'un séjour LCD : image ou PDF, 15 Mo (web : location-courte-duree/actions.ts).
  static const lcd = UploadTarget(path: '/lcd/sejours/upload-url', types: imagePdfTypes, maxMo: 15, kind: UploadKind.imagesPdf);

  /// Photo d'un emplacement de la résidence : JPEG / PNG / WebP, 5 Mo (web : parametres/actions.ts).
  static UploadTarget photoCopro(String coproprieteId, String cle) => UploadTarget(
        path: '/coproprietes/$coproprieteId/photos/upload-url',
        types: const {'image/jpeg', 'image/png', 'image/webp'},
        maxMo: 5,
        kind: UploadKind.images,
        extra: {'cle': cle},
      );

  /// Extensions proposées par le sélecteur de fichiers.
  List<String> get extensions => [
        for (final e in _extensions.entries)
          if (types.contains(e.value)) e.key,
      ];

  bool accepts(String contentType) => types.contains(normalizeContentType(contentType));
}

/// Extension → type MIME (sélecteur de fichiers, fichiers sans type déclaré).
const _extensions = <String, String>{
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'webp': 'image/webp',
  'heic': 'image/heic',
  'heif': 'image/heif',
  'gif': 'image/gif',
  'mp4': 'video/mp4',
  'mov': 'video/quicktime',
  'webm': 'video/webm',
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'ppt': 'application/vnd.ms-powerpoint',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'odt': 'application/vnd.oasis.opendocument.text',
  'ods': 'application/vnd.oasis.opendocument.spreadsheet',
  'odp': 'application/vnd.oasis.opendocument.presentation',
  'rtf': 'application/rtf',
  'txt': 'text/plain',
  'csv': 'text/csv',
  'zip': 'application/zip',
};

/// « application/PDF; charset=… » → « application/pdf » (même tolérance que l'API).
String normalizeContentType(String t) => t.split(';').first.trim().toLowerCase();

/// Type MIME d'un fichier : celui déclaré par le sélecteur s'il est précis, sinon l'extension,
/// sinon `application/octet-stream` (refusé par le contrôle : jamais deviné « image/jpeg »).
String contentTypeFor(String nom, {String? mime}) {
  final m = mime == null ? '' : normalizeContentType(mime);
  if (m.isNotEmpty && m != 'application/octet-stream') return m;
  final i = nom.lastIndexOf('.');
  final ext = i < 0 ? '' : nom.substring(i + 1).toLowerCase();
  return _extensions[ext] ?? 'application/octet-stream';
}

/// Codes d'échec d'un envoi (traduits par errorText : TOO_LARGE, BAD_TYPE, STORAGE, CANCELLED ;
/// NETWORK et les erreurs de l'API ont déjà leur texte).
enum UploadError { tooLarge, badType, network, storage, cancelled, api }

sealed class UploadResult {
  const UploadResult();
}

class UploadOk extends UploadResult {
  const UploadOk(this.storagePath, this.nom);
  final String storagePath;
  final String nom;

  /// Corps attendu par l'API pour une pièce unique (`justificatif`, `preuve`, `piece_jointe`).
  Map<String, String> get asPiece => {'storage_path': storagePath, 'nom': nom};
}

class UploadFailed extends UploadResult {
  const UploadFailed(this.code, {this.target, this.apiFail, this.status});
  final UploadError code;
  final UploadTarget? target;

  /// Refus de l'API à la demande d'URL signée (ex. 403, 422).
  final ApiFail<dynamic>? apiFail;

  /// Statut HTTP renvoyé par le stockage (STORAGE).
  final int? status;

  /// Forme commune aux formulaires (`_fail` → FormError, SubmitButton qui secoue, showApiError).
  ApiFail<dynamic> toApiFail() {
    final api = apiFail;
    if (api != null) return api;
    final t = target;
    return switch (code) {
      UploadError.tooLarge => ApiFail<dynamic>(ApiError(code: 'TOO_LARGE', message: '', fields: {'max_mo': '${t?.maxMo ?? 50}'}), 0),
      UploadError.badType => ApiFail<dynamic>(ApiError(code: 'BAD_TYPE', message: '', fields: {'kind': (t?.kind ?? UploadKind.imagesPdf).name}), 0),
      UploadError.network => const ApiFail<dynamic>(ApiError(code: 'NETWORK', message: '', fields: {'upload': '1'}), 0),
      UploadError.storage => ApiFail<dynamic>(const ApiError(code: 'STORAGE', message: ''), status ?? 0),
      UploadError.cancelled => const ApiFail<dynamic>(ApiError(code: 'CANCELLED', message: ''), 0),
      UploadError.api => const ApiFail<dynamic>(ApiError(code: 'INTERNAL_ERROR', message: ''), 500),
    };
  }
}

/// Contrôle sur l'appareil, avant toute requête : `null` si le fichier peut partir.
UploadFailed? precheckUpload(UploadTarget target, String contentType, int size) {
  if (!target.accepts(contentType)) return UploadFailed(UploadError.badType, target: target);
  if (size > target.maxBytes) return UploadFailed(UploadError.tooLarge, target: target);
  return null;
}

/// Progression (octets envoyés, total).
typedef UploadProgress = void Function(int sent, int total);

/// Demande d'URL signée (POST `target.path`) — injectable pour les tests.
typedef SignUpload = Future<ApiResult<Map<String, dynamic>>> Function(String path, Map<String, Object?> body);

/// PUT du fichier vers l'URL signée — injectable pour les tests.
typedef PutUpload = Future<UploadPutOutcome> Function(String url, PieceLocale piece, int size, {UploadProgress? onProgress, CancelToken? cancelToken});

/// Issue d'un PUT vers le stockage.
@immutable
class UploadPutOutcome {
  const UploadPutOutcome._(this.code, [this.status]);
  const UploadPutOutcome.ok() : this._(null);
  const UploadPutOutcome.network() : this._(UploadError.network);
  const UploadPutOutcome.cancelled() : this._(UploadError.cancelled);
  const UploadPutOutcome.storage(int status) : this._(UploadError.storage, status);

  /// `null` = envoyé.
  final UploadError? code;
  final int? status;
}

/// Envoi d'un fichier avec progression : contrôle, URL signée, PUT en flux.
Future<UploadResult> uploadWithProgress(ApiClient api, PieceLocale piece, UploadTarget target, {UploadProgress? onProgress, CancelToken? cancelToken}) async {
  int size;
  try {
    size = piece.taille ?? await File(piece.chemin).length();
  } on FileSystemException {
    // Fichier disparu du cache du sélecteur : rien n'est parti, l'utilisateur le rechoisit.
    return UploadFailed(UploadError.storage, target: target);
  }
  return uploadPiece(
    piece,
    target,
    size: size,
    sign: (path, body) => api.post<Map<String, dynamic>>(path, body: body, parse: asMap),
    put: api.putSignedFile,
    onProgress: onProgress,
    cancelToken: cancelToken,
  );
}

/// Cœur de l'envoi, sans dépendance au disque ni au réseau (testable).
Future<UploadResult> uploadPiece(
  PieceLocale piece,
  UploadTarget target, {
  required int size,
  required SignUpload sign,
  required PutUpload put,
  UploadProgress? onProgress,
  CancelToken? cancelToken,
}) async {
  final contentType = normalizeContentType(piece.contentType);
  final refus = precheckUpload(target, contentType, size);
  if (refus != null) return refus;
  if (cancelToken?.isCancelled ?? false) return UploadFailed(UploadError.cancelled, target: target);

  final prep = await sign(target.path, {...target.extra, 'nom_fichier': piece.nom, 'content_type': contentType});
  if (cancelToken?.isCancelled ?? false) return UploadFailed(UploadError.cancelled, target: target);
  switch (prep) {
    case ApiFail<Map<String, dynamic>>(:final error):
      if (error.code == 'NETWORK' || error.code == 'TIMEOUT') return UploadFailed(UploadError.network, target: target);
      return UploadFailed(UploadError.api, target: target, apiFail: prep);
    case ApiOk<Map<String, dynamic>>(:final data):
      final url = data['upload_url'];
      final chemin = data['storage_path'];
      if (url is! String || chemin is! String) {
        return UploadFailed(UploadError.api, target: target, apiFail: const ApiFail<dynamic>(ApiError(code: 'PARSE_ERROR', message: ''), 200));
      }
      final out = await put(url, piece.contentType == contentType ? piece : PieceLocale(nom: piece.nom, chemin: piece.chemin, contentType: contentType, taille: size), size, onProgress: onProgress, cancelToken: cancelToken);
      if (out.code == null) {
        onProgress?.call(size, size);
        return UploadOk(chemin, piece.nom);
      }
      return UploadFailed(out.code!, target: target, status: out.status);
  }
}

/// État d'un fichier dans un formulaire.
enum UploadStatus { waiting, uploading, done, failed }

/// Un fichier d'un formulaire et son envoi.
class UploadSlot {
  UploadSlot(this.piece);
  final PieceLocale piece;
  UploadStatus status = UploadStatus.waiting;

  /// 0 → 1 pendant l'envoi.
  double progress = 0;

  /// Chemin de stockage une fois envoyé — retenu : un nouvel essai ne le renvoie pas.
  String? storagePath;
  UploadFailed? failure;
  CancelToken? _cancel;

  /// Envoi en cours : un second appel (bouton « Renvoyer » puis « Envoyer ») attend le même.
  Future<UploadResult>? _pending;

  bool get done => status == UploadStatus.done && storagePath != null;
  bool get uploading => status == UploadStatus.uploading;
  bool get failed => status == UploadStatus.failed;

  /// Envoi en cours interrompu à la demande.
  void cancel() => _cancel?.cancel();
}

/// Envoi d'une pièce — signature commune de [uploadWithProgress] et des faux des tests.
typedef Uploader = Future<UploadResult> Function(PieceLocale piece, {UploadProgress? onProgress, CancelToken? cancelToken});

/// Fichiers d'un formulaire : ajout (contrôle immédiat), envoi avec progression par fichier,
/// mémoire des chemins déjà envoyés. Les écrans écoutent la file (`ListenableBuilder`) pour
/// redessiner les tuiles.
class UploadQueue extends ChangeNotifier {
  UploadQueue(this.target, this._uploader, {this.max = 10});

  /// File branchée sur l'API.
  factory UploadQueue.forApi(ApiClient api, UploadTarget target, {int max = 10}) =>
      UploadQueue(target, (p, {onProgress, cancelToken}) => uploadWithProgress(api, p, target, onProgress: onProgress, cancelToken: cancelToken), max: max);

  final UploadTarget target;
  final Uploader _uploader;
  final int max;
  final List<UploadSlot> _slots = [];
  bool _disposed = false;

  List<UploadSlot> get slots => List.unmodifiable(_slots);
  bool get isEmpty => _slots.isEmpty;
  bool get isNotEmpty => _slots.isNotEmpty;
  int get length => _slots.length;
  bool get isFull => _slots.length >= max;
  bool get busy => _slots.any((s) => s.uploading);
  bool get allDone => _slots.every((s) => s.done);

  /// Chemins de stockage, dans l'ordre des fichiers (tous envoyés).
  List<String> get paths => [for (final s in _slots) if (s.storagePath != null) s.storagePath!];

  /// Ajout d'un fichier : refus immédiat (type, taille) sans rien envoyer. `null` = ajouté.
  UploadFailed? add(PieceLocale piece) {
    if (isFull) return null;
    final size = piece.taille;
    final refus = size == null ? (target.accepts(piece.contentType) ? null : UploadFailed(UploadError.badType, target: target)) : precheckUpload(target, piece.contentType, size);
    if (refus != null) return refus;
    _slots.add(UploadSlot(piece));
    _notify();
    return null;
  }

  /// Remplace le contenu (formulaire à pièce unique).
  UploadFailed? replace(PieceLocale piece) {
    final size = piece.taille;
    final refus = size == null ? (target.accepts(piece.contentType) ? null : UploadFailed(UploadError.badType, target: target)) : precheckUpload(target, piece.contentType, size);
    if (refus != null) return refus;
    for (final s in _slots) {
      s.cancel();
    }
    _slots
      ..clear()
      ..add(UploadSlot(piece));
    _notify();
    return null;
  }

  void remove(UploadSlot slot) {
    slot.cancel();
    _slots.remove(slot);
    _notify();
  }

  /// L'écriture finale a échoué de façon AMBIGUË (réseau, délai, 5xx, 409 — IdemKey.isAmbiguous)
  /// sur un endpoint sans clé d'idempotence : le serveur a peut-être déjà créé une ligne avec ces
  /// chemins. Le prochain essai renvoie donc des fichiers neufs (nouveaux chemins) plutôt que de
  /// rattacher deux fois le même fichier. Après un refus certain (4xx), on garde les chemins.
  void forgetUploads() {
    for (final s in _slots) {
      s
        ..storagePath = null
        ..status = UploadStatus.waiting
        ..progress = 0
        ..failure = null;
    }
    _notify();
  }

  void clear() {
    for (final s in _slots) {
      s.cancel();
    }
    _slots.clear();
    _notify();
  }

  /// Envoi (ou renvoi) d'un seul fichier — bouton « Renvoyer » d'une tuile.
  Future<UploadResult> send(UploadSlot slot) {
    if (slot.done) return Future.value(UploadOk(slot.storagePath!, slot.piece.nom));
    final enCours = slot._pending;
    if (enCours != null) return enCours;
    final f = _send(slot);
    slot._pending = f;
    return f.whenComplete(() => slot._pending = null);
  }

  Future<UploadResult> _send(UploadSlot slot) async {
    final cancel = CancelToken();
    slot
      .._cancel = cancel
      ..status = UploadStatus.uploading
      ..progress = 0
      ..failure = null;
    _notify();
    final r = await _uploader(slot.piece, onProgress: (sent, total) {
      if (total <= 0) return;
      final p = (sent / total).clamp(0.0, 1.0);
      // Une tuile par point de pourcentage, pas une par paquet TCP.
      if ((p - slot.progress).abs() >= 0.01 || p >= 1) {
        slot.progress = p;
        _notify();
      }
    }, cancelToken: cancel);
    slot._cancel = null;
    switch (r) {
      case UploadOk(:final storagePath):
        slot
          ..status = UploadStatus.done
          ..progress = 1
          ..storagePath = storagePath;
      case UploadFailed():
        slot
          ..status = UploadStatus.failed
          ..failure = r;
    }
    _notify();
    return r;
  }

  /// Envoi final : seuls les fichiers pas encore envoyés partent (un à la fois, pour une
  /// progression lisible sur réseau mobile). Premier échec renvoyé ; `null` = tout est envoyé.
  Future<UploadFailed?> sendAll() async {
    for (final s in [..._slots]) {
      if (s.done || !_slots.contains(s)) continue;
      final r = await send(s);
      if (r is UploadFailed) return r;
    }
    return null;
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    for (final s in _slots) {
      s.cancel();
    }
    super.dispose();
  }
}
