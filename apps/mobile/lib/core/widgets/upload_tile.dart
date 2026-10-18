import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api/error_text.dart';
import '../api/upload.dart';
import '../i18n/i18n.dart';
import '../i18n/mobile_dict.dart';
import '../theme/tokens.dart';
import 'alive.dart';
import 'cards.dart';
import 'page.dart';
import 'states.dart';

/// Taille lisible : « 2,4 Mo », « 830 Ko » (chiffres latins, virgule décimale).
String formatTaille(BuildContext context, int octets) {
  final up = context.mup;
  if (octets >= 1024 * 1024) {
    final mo = (octets * 10 ~/ (1024 * 1024)) / 10;
    final s = mo == mo.roundToDouble() ? mo.toInt().toString() : mo.toStringAsFixed(1).replaceAll('.', ',');
    return fill(up.sizeMo, {'n': s});
  }
  return fill(up.sizeKo, {'n': ((octets + 1023) ~/ 1024).clamp(1, 1023)});
}

/// Texte d'un échec d'envoi, dans la langue de l'utilisateur.
String uploadErrorLine(BuildContext context, UploadFailed f) => f.toApiFail().text(context).body;

/// Sélection d'une pièce : appareil photo, galerie (photo, ou vidéo si l'endpoint l'accepte) ou
/// fichier (extensions de l'endpoint). Le type et la taille sont contrôlés tout de suite : un
/// fichier refusé ne rejoint jamais le formulaire (toast « Fichier trop lourd (max 15 Mo) »).
Future<PieceLocale?> choisirPiece(BuildContext context, {UploadTarget target = UploadTarget.lcd}) async {
  final d = context.dict;
  final up = context.mup;
  final videos = target.types.any((t) => t.startsWith('video/'));
  final fichiers = target.kind != UploadKind.images;
  final choix = await showSuSheet<String>(
    context,
    isScrollControlled: false,
    useSafeArea: false,
    builder: (ctx) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: CardList([
              ListRow(leading: const IconCircle(Icons.photo_camera_rounded), title: d.lcd.prendrePhoto, onTap: () => Navigator.pop(ctx, 'camera')),
              ListRow(leading: const IconCircle(Icons.photo_library_rounded), title: videos ? up.photoVideo : d.incidents.choisirGalerie, onTap: () => Navigator.pop(ctx, 'galerie')),
              if (fichiers) ListRow(leading: const IconCircle(Icons.attach_file_rounded), title: videos ? up.fichier : d.lcd.choisirFichier, onTap: () => Navigator.pop(ctx, 'fichier')),
            ]),
          ),
        ],
      ),
    ),
  );
  if (choix == null) return null;
  PieceLocale? p;
  if (choix == 'fichier') {
    final r = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: target.extensions, withData: false);
    final f = r?.files.single;
    if (f == null || f.path == null) return null;
    p = PieceLocale(nom: f.name, chemin: f.path!, contentType: contentTypeFor(f.name), taille: f.size > 0 ? f.size : null);
  } else {
    final picker = ImagePicker();
    final x = choix == 'galerie' && videos
        ? await picker.pickMedia(imageQuality: 82, maxWidth: 2000)
        : await picker.pickImage(source: choix == 'camera' ? ImageSource.camera : ImageSource.gallery, imageQuality: 82, maxWidth: 2000);
    if (x == null) return null;
    p = PieceLocale(nom: x.name, chemin: x.path, contentType: contentTypeFor(x.name, mime: x.mimeType));
  }
  return pieceControlee(context, p, target);
}

/// Complète la taille (lue sur le disque) et applique le contrôle de l'endpoint ; refus → toast,
/// `null`. Pour les sélecteurs propres à un écran (photos d'un signalement, photo de résidence).
Future<PieceLocale?> pieceControlee(BuildContext context, PieceLocale p, UploadTarget target) async {
  var piece = p;
  if (piece.taille == null) {
    try {
      piece = PieceLocale(nom: p.nom, chemin: p.chemin, contentType: p.contentType, taille: await File(p.chemin).length());
    } on FileSystemException {
      // Taille illisible : le contrôle de type s'applique, la taille sera relue à l'envoi.
    }
  }
  final refus = precheckUpload(target, piece.contentType, piece.taille ?? 0);
  if (refus != null) {
    if (context.mounted) showToast(context, uploadErrorLine(context, refus), error: true);
    return null;
  }
  return piece;
}

/// Ligne d'un fichier de formulaire : nom, taille, anneau de progression pendant l'envoi,
/// coche une fois envoyé, « Renvoyer » sur un échec (seul ce fichier repart), annulation.
class SuUploadTile extends StatelessWidget {
  const SuUploadTile(this.slot, {super.key, required this.queue, this.removable = true, this.onRetry});
  final UploadSlot slot;
  final UploadQueue queue;

  /// « Renvoyer » : par défaut, renvoie ce seul fichier ; un écran peut enchaîner la suite.
  final void Function(UploadSlot slot)? onRetry;

  /// Bouton « Retirer » (désactivé pendant l'envoi du formulaire).
  final bool removable;

  @override
  Widget build(BuildContext context) {
    final up = context.mup;
    final t = Theme.of(context).textTheme;
    final p = slot.piece;
    final taille = p.taille == null ? null : formatTaille(context, p.taille!);
    final statut = switch (slot.status) {
      UploadStatus.waiting => up.waiting,
      UploadStatus.uploading => fill(up.uploading, {'pct': (slot.progress * 100).round()}),
      UploadStatus.done => up.done,
      UploadStatus.failed => slot.failure == null ? up.failed : uploadErrorLine(context, slot.failure!),
    };
    final icone = p.estImage ? Icons.image_rounded : (p.estVideo ? Icons.movie_rounded : Icons.description_rounded);
    final Widget leading = switch (slot.status) {
      UploadStatus.uploading => SuRing(slot.progress, size: 40, stroke: 4, color: SuColors.link, child: Icon(icone, size: 18, color: SuColors.link)),
      UploadStatus.done => const IconCircle(Icons.check_rounded, tone: Tone.ok, size: 40, iconSize: 20),
      UploadStatus.failed => const IconCircle(Icons.error_outline_rounded, tone: Tone.danger, size: 40, iconSize: 20),
      UploadStatus.waiting => IconCircle(icone, tone: Tone.neutral, size: 40, iconSize: 20),
    };
    return Semantics(
      liveRegion: slot.failed,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            leading,
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Nom de fichier : toujours de gauche à droite (extensions, chiffres).
                  Text(p.nom, style: t.titleSmall, maxLines: 1, overflow: TextOverflow.ellipsis, textDirection: TextDirection.ltr),
                  const SizedBox(height: 2),
                  Text(
                    taille == null ? statut : '$taille · $statut',
                    style: t.bodySmall?.copyWith(color: slot.failed ? SuColors.danger : SuColors.soft),
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (slot.uploading) SuIconButton(icon: Icons.close_rounded, tooltip: up.cancel, iconSize: 20, onPressed: slot.cancel),
            if (slot.failed) SuIconButton(icon: Icons.refresh_rounded, tooltip: up.retryOne, iconSize: 22, onPressed: () {
                final retry = onRetry;
                if (retry != null) {
                  retry(slot);
                } else {
                  queue.send(slot);
                }
              }),
            if (!slot.uploading && removable) SuIconButton(icon: Icons.delete_outline_rounded, tooltip: up.remove, iconSize: 20, onPressed: () => queue.remove(slot)),
          ],
        ),
      ),
    );
  }
}

/// Liste des fichiers d'une file (redessinée à chaque progression) + bouton d'ajout.
class SuUploadList extends StatelessWidget {
  const SuUploadList({super.key, required this.queue, this.addLabel, this.onAdd, this.enabled = true, this.onRetry});
  final UploadQueue queue;
  final void Function(UploadSlot slot)? onRetry;
  final String? addLabel;

  /// Ajout d'un fichier (sélecteur) ; masqué quand la file est pleine.
  final VoidCallback? onAdd;
  final bool enabled;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: queue,
        builder: (context, _) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final s in queue.slots) SuUploadTile(s, key: ObjectKey(s), queue: queue, removable: enabled, onRetry: onRetry),
            if (onAdd != null && !queue.isFull && addLabel != null)
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: SuButton(label: addLabel!, icon: Icons.add_a_photo_rounded, variant: SuButtonVariant.ghost, size: SuButtonSize.sm, onPressed: enabled ? onAdd : null),
              ),
          ],
        ),
      );
}
