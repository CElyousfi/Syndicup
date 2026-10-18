import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/api/api_result.dart';
import 'package:syndicup/core/api/error_text.dart';
import 'package:syndicup/core/api/upload.dart';
import 'package:syndicup/core/i18n/mobile_dict.dart';

const _mo = 1024 * 1024;

PieceLocale _piece(String nom, String type, int taille) => PieceLocale(nom: nom, chemin: '/tmp/$nom', contentType: type, taille: taille);

ApiResult<Map<String, dynamic>> _signed(String chemin) => ApiOk<Map<String, dynamic>>({'upload_url': 'https://storage.test/$chemin?token=t', 'storage_path': chemin}, const ApiMeta(requestId: 'r'), 200);

void main() {
  group('contrôle avant envoi (type, taille) — aucune requête', () {
    test('incidents : images seulement, 15 Mo', () {
      expect(precheckUpload(UploadTarget.incidents, 'image/jpeg', 3 * _mo), isNull);
      expect(precheckUpload(UploadTarget.incidents, 'image/heic', 3 * _mo), isNull);
      expect(precheckUpload(UploadTarget.incidents, 'application/pdf', 1000)?.code, UploadError.badType);
      expect(precheckUpload(UploadTarget.incidents, 'image/jpeg', 15 * _mo + 1)?.code, UploadError.tooLarge);
      expect(precheckUpload(UploadTarget.incidents, 'image/jpeg', 15 * _mo), isNull);
    });

    test('justificatifs / dépenses / tâches / LCD : PDF ou photo, 15 Mo', () {
      for (final t in [UploadTarget.justificatifs, UploadTarget.depenses, UploadTarget.taches, UploadTarget.lcd]) {
        expect(precheckUpload(t, 'application/pdf', 2 * _mo), isNull, reason: t.path);
        expect(precheckUpload(t, 'image/png', 2 * _mo), isNull, reason: t.path);
        expect(precheckUpload(t, 'application/msword', 2 * _mo)?.code, UploadError.badType, reason: t.path);
        expect(precheckUpload(t, 'video/mp4', 2 * _mo)?.code, UploadError.badType, reason: t.path);
        expect(precheckUpload(t, 'application/pdf', 16 * _mo)?.code, UploadError.tooLarge, reason: t.path);
      }
    });

    test('documents : liste large de l\'API (bureautique, vidéo, ZIP…), plafond du bucket 50 Mo', () {
      final t = UploadTarget.documents;
      for (final type in [
        'application/pdf',
        'image/gif',
        'video/mp4',
        'video/quicktime',
        'video/webm',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.oasis.opendocument.text',
        'application/rtf',
        'text/plain',
        'text/csv',
        'application/zip',
      ]) {
        expect(precheckUpload(t, type, 10 * _mo), isNull, reason: type);
      }
      expect(precheckUpload(t, 'APPLICATION/PDF; charset=binary', 10 * _mo), isNull);
      expect(precheckUpload(t, 'text/html', 1000)?.code, UploadError.badType);
      expect(precheckUpload(t, 'image/svg+xml', 1000)?.code, UploadError.badType);
      expect(precheckUpload(t, 'application/octet-stream', 1000)?.code, UploadError.badType);
      expect(precheckUpload(t, 'video/mp4', 60 * _mo)?.code, UploadError.tooLarge);
    });

    test('photo de résidence : JPEG / PNG / WebP, 5 Mo, emplacement transmis', () {
      final t = UploadTarget.photoCopro('c1', 'accueil');
      expect(t.path, '/coproprietes/c1/photos/upload-url');
      expect(t.extra['cle'], 'accueil');
      expect(precheckUpload(t, 'image/webp', 4 * _mo), isNull);
      expect(precheckUpload(t, 'image/heic', 1000)?.code, UploadError.badType);
      expect(precheckUpload(t, 'image/jpeg', 6 * _mo)?.code, UploadError.tooLarge);
    });

    test('type déduit de l\'extension, jamais deviné « image/jpeg »', () {
      expect(contentTypeFor('reçu.PDF'), 'application/pdf');
      expect(contentTypeFor('pv.docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(contentTypeFor('IMG_0001.HEIC'), 'image/heic');
      expect(contentTypeFor('photo', mime: 'image/png'), 'image/png');
      expect(contentTypeFor('script.exe'), 'application/octet-stream');
      expect(contentTypeFor('x.bin', mime: 'application/octet-stream'), 'application/octet-stream');
      expect(UploadTarget.justificatifs.extensions, containsAll(['pdf', 'jpg', 'png', 'heic']));
      expect(UploadTarget.justificatifs.extensions, isNot(contains('docx')));
    });

    test('refus local : aucune URL signée demandée', () async {
      var signatures = 0;
      final r = await uploadPiece(
        _piece('video.mp4', 'video/mp4', 60 * _mo),
        UploadTarget.documents,
        size: 60 * _mo,
        sign: (_, __) async {
          signatures++;
          return _signed('x');
        },
        put: (_, __, ___, {onProgress, cancelToken}) async => const UploadPutOutcome.ok(),
      );
      expect(r, isA<UploadFailed>());
      expect((r as UploadFailed).code, UploadError.tooLarge);
      expect(signatures, 0);
    });
  });

  group('messages localisés (errorText)', () {
    test('trop lourd : plafond de l\'endpoint dans le message', () {
      final f = const UploadFailed(UploadError.tooLarge, target: UploadTarget.justificatifs).toApiFail();
      expect(errorTextFor(const Locale('fr'), f.error, f.status).body, 'Fichier trop lourd (max 15 Mo).');
      expect(errorTextFor(const Locale('ar'), f.error, f.status).body, contains('15'));
    });

    test('format refusé : liste adaptée à l\'endpoint', () {
      String body(UploadTarget t, Locale l) {
        final f = UploadFailed(UploadError.badType, target: t).toApiFail();
        return errorTextFor(l, f.error, f.status).body;
      }

      expect(body(UploadTarget.justificatifs, const Locale('fr')), 'Format non accepté : PDF ou photo.');
      expect(body(UploadTarget.incidents, const Locale('fr')), MobileUp.fr.badTypeImages);
      expect(body(UploadTarget.documents, const Locale('ar')), MobileUp.ar.badTypeDocuments);
    });

    test('coupure pendant l\'envoi : message rassurant, action Réessayer', () {
      final f = const UploadFailed(UploadError.network).toApiFail();
      final x = errorTextFor(const Locale('fr'), f.error, f.status);
      expect(x.body, MobileUp.fr.network);
      expect(x.action, ErrorAction.retry);
      final s = const UploadFailed(UploadError.storage, status: 413).toApiFail();
      expect(errorTextFor(const Locale('ar'), s.error, s.status).body, MobileUp.ar.storage);
    });
  });

  group('UploadQueue — pas de double envoi', () {
    test('un nouvel essai ne renvoie que le fichier en échec', () async {
      final envois = <String>[];
      var echouer = {'b.jpg'};
      final q = UploadQueue(UploadTarget.incidents, (p, {onProgress, cancelToken}) async {
        envois.add(p.nom);
        onProgress?.call(50, 100);
        if (echouer.contains(p.nom)) return const UploadFailed(UploadError.network);
        return UploadOk('copro/incidents/${p.nom}', p.nom);
      }, max: 5);
      expect(q.add(_piece('a.jpg', 'image/jpeg', 1000)), isNull);
      expect(q.add(_piece('b.jpg', 'image/jpeg', 1000)), isNull);
      expect(q.add(_piece('c.jpg', 'image/jpeg', 1000)), isNull);

      final premier = await q.sendAll();
      expect(premier?.code, UploadError.network);
      expect(envois, ['a.jpg', 'b.jpg']);
      expect(q.slots[0].done, isTrue);
      expect(q.slots[1].failed, isTrue);
      expect(q.slots[2].status, UploadStatus.waiting);

      echouer = {};
      expect(await q.sendAll(), isNull);
      // a.jpg n'est PAS reparti.
      expect(envois, ['a.jpg', 'b.jpg', 'b.jpg', 'c.jpg']);
      expect(q.paths, ['copro/incidents/a.jpg', 'copro/incidents/b.jpg', 'copro/incidents/c.jpg']);
      expect(q.allDone, isTrue);

      // Rejeu complet (ex. l'API a refusé le signalement) : plus rien ne part.
      expect(await q.sendAll(), isNull);
      expect(envois.length, 4);
    });

    test('ajout refusé (type / taille) sans rien envoyer ; file pleine', () {
      final q = UploadQueue(UploadTarget.incidents, (p, {onProgress, cancelToken}) async => UploadOk(p.nom, p.nom), max: 1);
      expect(q.add(_piece('doc.pdf', 'application/pdf', 1000))?.code, UploadError.badType);
      expect(q.add(_piece('big.jpg', 'image/jpeg', 20 * _mo))?.code, UploadError.tooLarge);
      expect(q.isEmpty, isTrue);
      expect(q.add(_piece('ok.jpg', 'image/jpeg', 1000)), isNull);
      expect(q.isFull, isTrue);
      expect(q.add(_piece('ok2.jpg', 'image/jpeg', 1000)), isNull);
      expect(q.length, 1);
    });

    test('renvoi d\'un seul fichier ; annulation pendant l\'envoi', () async {
      final q = UploadQueue(UploadTarget.lcd, (p, {onProgress, cancelToken}) async {
        if (p.nom == 'annule.pdf') {
          cancelToken?.cancel();
          return const UploadFailed(UploadError.cancelled);
        }
        return UploadOk('lcd/${p.nom}', p.nom);
      });
      q.add(_piece('annule.pdf', 'application/pdf', 1000));
      final r = await q.sendAll();
      expect(r?.code, UploadError.cancelled);
      expect(q.slots.single.failed, isTrue);
      q.remove(q.slots.single);
      q.add(_piece('ok.pdf', 'application/pdf', 1000));
      final s = await q.send(q.slots.single);
      expect(s, isA<UploadOk>());
      expect(q.paths, ['lcd/ok.pdf']);
    });

    test('progression remontée à la tuile, puis 100 % une fois envoyé', () async {
      final vus = <double>[];
      final q = UploadQueue(UploadTarget.depenses, (p, {onProgress, cancelToken}) async {
        onProgress?.call(25, 100);
        onProgress?.call(75, 100);
        return UploadOk('d/${p.nom}', p.nom);
      });
      q.add(_piece('recu.pdf', 'application/pdf', 1000));
      q.addListener(() => vus.add(q.slots.single.progress));
      await q.sendAll();
      expect(vus, containsAllInOrder([0.25, 0.75, 1.0]));
    });

    test('uploadPiece : PUT avec le type normalisé, chemin rendu par l\'API', () async {
      String? typeEnvoye;
      Map<String, Object?>? corps;
      final r = await uploadPiece(
        _piece('pv.pdf', 'Application/PDF', 2000),
        UploadTarget.documents,
        size: 2000,
        sign: (path, body) async {
          corps = body;
          return _signed('copro/documents/pv.pdf');
        },
        put: (url, p, size, {onProgress, cancelToken}) async {
          typeEnvoye = p.contentType;
          expect(size, 2000);
          return const UploadPutOutcome.ok();
        },
        cancelToken: CancelToken(),
      );
      expect(r, isA<UploadOk>());
      expect((r as UploadOk).storagePath, 'copro/documents/pv.pdf');
      expect(r.asPiece, {'storage_path': 'copro/documents/pv.pdf', 'nom': 'pv.pdf'});
      expect(typeEnvoye, 'application/pdf');
      expect(corps, {'nom_fichier': 'pv.pdf', 'content_type': 'application/pdf'});
    });

    test('uploadPiece : refus du stockage → STORAGE, refus de l\'API → erreur de l\'API', () async {
      final storage = await uploadPiece(
        _piece('a.jpg', 'image/jpeg', 10),
        UploadTarget.incidents,
        size: 10,
        sign: (_, __) async => _signed('a'),
        put: (_, __, ___, {onProgress, cancelToken}) async => const UploadPutOutcome.storage(403),
      );
      expect((storage as UploadFailed).code, UploadError.storage);
      expect(storage.status, 403);

      final api = await uploadPiece(
        _piece('a.jpg', 'image/jpeg', 10),
        UploadTarget.incidents,
        size: 10,
        sign: (_, __) async => const ApiFail<Map<String, dynamic>>(ApiError(code: 'FORBIDDEN', message: ''), 403),
        put: (_, __, ___, {onProgress, cancelToken}) async => const UploadPutOutcome.ok(),
      );
      expect((api as UploadFailed).code, UploadError.api);
      expect(api.toApiFail().error.code, 'FORBIDDEN');

      final reseau = await uploadPiece(
        _piece('a.jpg', 'image/jpeg', 10),
        UploadTarget.incidents,
        size: 10,
        sign: (_, __) async => const ApiFail<Map<String, dynamic>>(ApiError.network(), 0),
        put: (_, __, ___, {onProgress, cancelToken}) async => const UploadPutOutcome.ok(),
      );
      expect((reseau as UploadFailed).code, UploadError.network);
    });
  });
}
