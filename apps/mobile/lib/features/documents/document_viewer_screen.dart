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
    return Scaffold(
      backgroundColor: SuColors.surface,
      appBar: AppBar(
        backgroundColor: SuColors.bg,
        title: Text(widget.titre, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          if (_bytes != null) IconButton(tooltip: d.common.share, icon: const Icon(Icons.ios_share_rounded), onPressed: _partager),
        ],
      ),
      body: switch (_etat) {
        _Etat.chargement => const Center(child: CircularProgressIndicator(color: SuColors.blue600)),
        _Etat.erreur => Padding(padding: const EdgeInsets.all(16), child: ErrorState(error: md.viewerError, onRetry: () {
            setState(() => _etat = _Etat.chargement);
            _charger();
          })),
        _Etat.autre => Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                SuBanner(tone: BannerTone.info, body: md.viewerUnsupported),
                const SizedBox(height: 12),
                FilledButton.icon(onPressed: _partager, icon: const Icon(Icons.ios_share_rounded), label: Text(d.common.share)),
              ],
            ),
          ),
        _Etat.image => InteractiveViewer(
            minScale: 0.8,
            maxScale: 5,
            child: Center(child: Image.memory(_bytes!, fit: BoxFit.contain, gaplessPlayback: true)),
          ),
        _Etat.pdf => Column(
            children: [
              Expanded(
                child: PdfViewPinch(
                  controller: _pdf!,
                  padding: 12,
                  onPageChanged: (p) => setState(() => _page = p),
                  builders: PdfViewPinchBuilders<DefaultBuilderOptions>(
                    options: const DefaultBuilderOptions(),
                    documentLoaderBuilder: (_) => const Center(child: CircularProgressIndicator(color: SuColors.blue600)),
                    pageLoaderBuilder: (_) => const Center(child: CircularProgressIndicator(color: SuColors.blue600)),
                    errorBuilder: (_, __) => Center(child: Text(md.viewerError, style: t.bodySmall)),
                  ),
                ),
              ),
              if (_pages > 0)
                Container(
                  width: double.infinity,
                  color: SuColors.bg,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Text('$_page / $_pages', textAlign: TextAlign.center, textDirection: TextDirection.ltr, style: t.labelSmall),
                ),
            ],
          ),
      },
    );
  }
}
