import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pdfx/pdfx.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_result.dart';
import '../../core/auth/session.dart';
import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/widgets.dart';

/// Visionneuse intégrée — tout document (GED, PV d'AG, quittance) s'ouvre DANS l'application,
/// jamais dans le navigateur ni une visionneuse externe : PDF page par page (pdfx), image
/// zoomable, sinon partage du fichier. L'URL signée (15 min) est demandée au clic, jamais stockée.
Future<void> ouvrirVisionneuse(BuildContext context, {required String titre, required String url}) =>
    context.push('/visionneuse', extra: {'titre': titre, 'url': url});

/// Ouvre un PDF RENDU PAR L'API (quittance, PV, rapport de gestion, relevé de charges) : octets
/// téléchargés avec la session (jamais d'URL publique), puis visionneuse intégrée. M18.
Future<void> ouvrirPdfApi(BuildContext context, WidgetRef ref, {required String endpoint, Map<String, Object?>? query, required String titre, String? messageErreur}) async {
  final bytes = await ref.read(apiClientProvider).getBytes(endpoint, query: query);
  if (!context.mounted) return;
  if (bytes == null) {
    showToast(context, messageErreur ?? context.mdict.viewerError, error: true);
    return;
  }
  await context.push('/visionneuse', extra: {'titre': titre, 'bytes': Uint8List.fromList(bytes)});
}

/// Demande l'URL signée d'un endpoint `{ url }` puis ouvre la visionneuse ; toast d'erreur sinon.
Future<void> ouvrirFichierApi(BuildContext context, WidgetRef ref, {required String endpoint, required String titre, String? messageErreur}) async {
  final r = await ref.read(apiClientProvider).get<Map<String, dynamic>>(endpoint, parse: asMap);
  if (!context.mounted) return;
  final url = r.dataOrNull?['url'] as String?;
  if (url == null) {
    showToast(context, messageErreur ?? (r is ApiFail<Map<String, dynamic>> ? r.error.message : context.mdict.viewerError), error: true);
    return;
  }
  await ouvrirVisionneuse(context, titre: titre, url: url);
}

class DocumentViewerScreen extends StatefulWidget {
  const DocumentViewerScreen({super.key, required this.titre, this.url, this.bytes}) : assert(url != null || bytes != null);
  final String titre;
  final String? url;
  /// Octets déjà téléchargés (PDF rendu par l'API) — aucun téléchargement supplémentaire.
  final Uint8List? bytes;

  @override
  State<DocumentViewerScreen> createState() => _DocumentViewerScreenState();
}

enum _Etat { chargement, pdf, image, autre, erreur }

class _DocumentViewerScreenState extends State<DocumentViewerScreen> {
  _Etat _etat = _Etat.chargement;
  Uint8List? _bytes;
  String _contentType = 'application/octet-stream';
  PdfControllerPinch? _pdf;
  int _page = 1, _pages = 0;

  @override
  void initState() {
    super.initState();
    _charger();
  }

  @override
  void dispose() {
    _pdf?.dispose();
    super.dispose();
  }

  Future<void> _charger() async {
    try {
      final Uint8List bytes;
      var header = '';
      if (widget.bytes != null) {
        bytes = widget.bytes!;
      } else {
        final res = await Dio().get<List<int>>(widget.url!, options: Options(responseType: ResponseType.bytes, validateStatus: (_) => true, receiveTimeout: const Duration(seconds: 60)));
        final data = res.data;
        if ((res.statusCode ?? 500) >= 300 || data == null) throw Exception('HTTP ${res.statusCode}');
        bytes = Uint8List.fromList(data);
        header = (res.headers.value('content-type') ?? '').toLowerCase();
      }
      final estPdf = header.contains('pdf') || (bytes.length > 4 && bytes[0] == 0x25 && bytes[1] == 0x50 && bytes[2] == 0x44 && bytes[3] == 0x46);
      final estImage = header.startsWith('image/') || _magicImage(bytes);
      if (!mounted) return;
      _bytes = bytes;
      _contentType = estPdf ? 'application/pdf' : (header.isNotEmpty ? header.split(';').first : 'application/octet-stream');
      if (estPdf) {
        final doc = PdfDocument.openData(bytes);
        _pdf = PdfControllerPinch(document: doc);
        _pages = (await doc).pagesCount;
        if (!mounted) return;
        setState(() => _etat = _Etat.pdf);
      } else if (estImage) {
        setState(() => _etat = _Etat.image);
      } else {
        setState(() => _etat = _Etat.autre);
      }
    } catch (_) {
      if (mounted) setState(() => _etat = _Etat.erreur);
    }
  }

  static bool _magicImage(Uint8List b) {
    if (b.length < 4) return false;
    if (b[0] == 0xFF && b[1] == 0xD8) return true; // JPEG
    if (b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47) return true; // PNG
    if (b[0] == 0x52 && b[1] == 0x49 && b[2] == 0x46 && b[3] == 0x46) return true; // WebP (RIFF)
    return false;
  }

  Future<void> _partager() async {
    final bytes = _bytes;
    if (bytes == null) return;
    final ext = _contentType == 'application/pdf' ? 'pdf' : _contentType.startsWith('image/') ? _contentType.split('/').last.replaceAll('jpeg', 'jpg') : 'bin';
    final nom = '${widget.titre.replaceAll(RegExp(r'[^\w\-]+'), '_')}.$ext';
    await Share.shareXFiles([XFile.fromData(bytes, name: nom, mimeType: _contentType)], subject: widget.titre);
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final md = context.mdict;
    final t = Theme.of(context).textTheme;
    // Visionneuse de relevé Wise : pages blanches posées sur la toile greige, fermeture et
    // partage en boutons ronds blancs, compteur de pages en pill encre flottante.
    return Scaffold(
      backgroundColor: SuColors.tile,
      appBar: AppBar(
        backgroundColor: SuColors.tile,
        automaticallyImplyLeading: false,
        leadingWidth: 68,
        leading: Padding(
          padding: const EdgeInsetsDirectional.only(start: 16),
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            child: CircleIconButton(icon: Icons.close_rounded, color: SuColors.surface, tooltip: MaterialLocalizations.of(context).closeButtonTooltip, onTap: () => Navigator.of(context).maybePop()),
          ),
        ),
        titleSpacing: 6,
        title: Text(widget.titre, maxLines: 1, overflow: TextOverflow.ellipsis, style: t.titleLarge),
        actions: [
          if (_bytes != null) CircleIconButton(tooltip: d.common.share, icon: Icons.ios_share_rounded, color: SuColors.surface, onTap: _partager),
          const SizedBox(width: 16),
        ],
      ),
      body: SafeArea(
        top: false,
        child: switch (_etat) {
          _Etat.chargement => const _PageSkeleton(),
          _Etat.erreur => Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: ErrorState(error: md.viewerError, onRetry: () {
                  setState(() => _etat = _Etat.chargement);
                  _charger();
                }),
              ),
            ),
          _Etat.autre => Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: SuCard(
                  color: SuColors.surface,
                  padding: const EdgeInsets.fromLTRB(22, 28, 22, 22),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Center(child: IconCircle(Icons.insert_drive_file_rounded, tone: Tone.lilac, size: 72)),
                      const SizedBox(height: 16),
                      Text(widget.titre, style: t.headlineSmall, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 8),
                      Text(md.viewerUnsupported, style: t.bodyMedium?.copyWith(color: SuColors.soft), textAlign: TextAlign.center),
                      const SizedBox(height: 22),
                      SuButton(label: d.common.share, icon: Icons.ios_share_rounded, onPressed: _partager),
                    ],
                  ),
                ),
              ),
            ),
          _Etat.image => InteractiveViewer(
              minScale: 0.8,
              maxScale: 5,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                  child: ClipRRect(borderRadius: BorderRadius.circular(16), child: SuImage.memory(_bytes!, fit: BoxFit.contain)),
                ),
              ),
            ),
          _Etat.pdf => Stack(
              children: [
                Positioned.fill(
                  child: PdfViewPinch(
                    controller: _pdf!,
                    padding: 16,
                    // Page blanche plate, sans l'ombre portée par défaut.
                    backgroundDecoration: const BoxDecoration(color: SuColors.surface),
                    onPageChanged: (p) => setState(() => _page = p),
                    builders: PdfViewPinchBuilders<DefaultBuilderOptions>(
                      options: const DefaultBuilderOptions(),
                      documentLoaderBuilder: (_) => const _PageSkeleton(),
                      pageLoaderBuilder: (_) => const _PageSkeleton(),
                      errorBuilder: (_, __) => Center(child: Text(md.viewerError, style: t.bodySmall)),
                    ),
                  ),
                ),
                if (_pages > 0)
                  PositionedDirectional(
                    start: 0,
                    end: 0,
                    bottom: 16,
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                        decoration: BoxDecoration(color: SuColors.ink, borderRadius: BorderRadius.circular(SuRadius.pill)),
                        child: Text('$_page / $_pages', textDirection: TextDirection.ltr, style: t.labelMedium?.copyWith(color: Colors.white, fontFeatures: const [FontFeature.tabularFigures()])),
                      ),
                    ),
                  ),
              ],
            ),
        },
      ),
    );
  }
}

/// Squelette en forme de page (A4) : feuille blanche arrondie posée sur la toile, lignes de
/// texte en reflet (même shimmer que LoadingList) — jamais d'indicateur plein écran.
class _PageSkeleton extends StatelessWidget {
  const _PageSkeleton();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      final maxW = (c.maxWidth.isFinite ? c.maxWidth : 400.0) - 32;
      final maxH = (c.maxHeight.isFinite ? c.maxHeight : maxW * 1.414 + 32) - 32;
      var w = maxW;
      var h = w * 1.414;
      if (h > maxH) {
        h = maxH;
        w = h / 1.414;
      }
      if (w <= 0 || h <= 0) return const SizedBox.shrink();
      // Lignes de 14 px + 10 px d'interligne, dans la marge intérieure de la page.
      final lines = ((h - 48 - 34) / 24).floor().clamp(0, 40);
      return Center(
        child: Container(
          width: w,
          height: h,
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(color: SuColors.surface, borderRadius: BorderRadius.circular(16)),
          clipBehavior: Clip.hardEdge,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              FractionallySizedBox(widthFactor: 0.6, child: LoadingList(count: 1, height: 24)),
              if (lines > 0) LoadingList(count: lines, height: 14),
            ],
          ),
        ),
      );
    });
  }
}
