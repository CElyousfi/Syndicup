import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_result.dart';
import '../../core/api/models.dart';
import '../../core/api/providers.dart';
import '../../core/auth/app_state.dart';
import '../../core/auth/session.dart';
import '../../core/format/format.dart';
import '../../core/i18n/i18n.dart';
import '../../core/theme/tokens.dart';
import '../../core/util/status.dart';
import '../../core/widgets/widgets.dart';
import 'document_viewer_screen.dart';

/// I1 — documents filtrés par visibilité côté serveur ; téléchargement = URL signée 15 min
/// générée AU CLIC, jamais stockée.
class DocumentsScreen extends ConsumerStatefulWidget {
  const DocumentsScreen({super.key});
  @override
  ConsumerState<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends ConsumerState<DocumentsScreen> {
  String _filtre = '';
  final _search = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final docs = ref.watch(documentsProvider);
    final t = Theme.of(context).textTheme;
    return SuPage(
      title: d.documents.titre,
      subtitle: d.documents.subtitle,
      onRefresh: () async => ref.invalidate(documentsProvider),
      actions: [if (ctx.isGestion) IconButton(icon: const Icon(Icons.upload_file_rounded), tooltip: d.documents.televerser, onPressed: () => _upload(context))],
      children: [
        PhotoBanner('cour', title: ctx.copropriete?.nom),
        TextField(controller: _search, onChanged: (v) => setState(() => _filtre = v.toLowerCase()), decoration: InputDecoration(hintText: d.common.search, prefixIcon: const Icon(Icons.search_rounded))),
        const SizedBox(height: 12),
        AsyncView(docs, onRetry: () => ref.invalidate(documentsProvider), data: (list) {
          final types = list.map((x) => x.type).toSet().toList()..sort();
          final visible = list.where((x) => _filtre.isEmpty || x.nom.toLowerCase().contains(_filtre) || x.type.toLowerCase().contains(_filtre)).toList();
          if (visible.isEmpty) return EmptyState(title: d.documents.aucunDocument, hint: ctx.isGestion ? d.documents.aucunDocumentAide : null, icon: Icons.description_rounded);
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (types.length > 1) ...[
                Wrap(spacing: 6, children: [for (final ty in types) StatusBadge(ty, variant: BadgeVariant.outline, small: true)]),
                const SizedBox(height: 12),
              ],
              CardList([for (final doc in visible) DocumentRow(doc, canDelete: ctx.isGestion)]),
              const SizedBox(height: 12),
              Text(d.documents.telechargement, style: t.labelSmall),
            ],
          );
        }),
      ],
    );
  }

  Future<void> _upload(BuildContext context) async {
    await showFormSheet<void>(context, title: context.dict.documents.televerser, builder: (ctx) => _UploadForm(onDone: () => ref.invalidate(documentsProvider)));
  }
}

/// Ouvre un document DANS l'application (visionneuse intégrée) via son URL signée demandée au clic.
Future<void> ouvrirDocument(BuildContext context, WidgetRef ref, String id, {String? titre}) =>
    ouvrirFichierApi(context, ref, endpoint: '/documents/$id/download-url', titre: titre ?? context.dict.documents.titre);

class DocumentRow extends ConsumerWidget {
  const DocumentRow(this.doc, {super.key, this.canDelete = false});
  final DocumentCopro doc;
  final bool canDelete;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    return ListRow(
      leading: const IconCircle(Icons.picture_as_pdf_rounded, tone: Tone.lilac, size: 40),
      title: doc.nom,
      subtitle: '${doc.type} · ${formatDateCourte(doc.creeLe, context.locale)} · ${d.enums.visibiliteDocument[doc.visibilite] ?? doc.visibilite}',
      trailing: canDelete
          ? IconButton(
              icon: const Icon(Icons.delete_outline_rounded, color: SuColors.faint),
              onPressed: () async {
                final ok = await confirmDialog(context, title: d.gestion.supprimer, body: d.gestion.documentSupprimerAide, danger: true, irreversible: true);
                if (!ok) return;
                final r = await ref.read(apiClientProvider).delete<dynamic>('/documents/${doc.id}');
                if (!context.mounted) return;
                if (r is ApiFail) {
                  showToast(context, r.error.message, error: true);
                } else {
                  ref.invalidate(documentsProvider);
                  showToast(context, d.gestion.supprime);
                }
              },
            )
          : const CircleArrow(size: 32),
      onTap: () => ouvrirDocument(context, ref, doc.id, titre: doc.nom),
    );
  }
}

/// Carte « Documents » des tableaux de bord.
class DocumentsCard extends ConsumerWidget {
  const DocumentsCard({super.key, required this.documents});
  final List<DocumentCopro> documents;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    if (documents.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(d.documents.titre, actionLabel: d.common.seeAll, onAction: () => context.push('/documents')),
        CardList([for (final doc in documents.take(3)) DocumentRow(doc)]),
      ],
    );
  }
}

class _UploadForm extends ConsumerStatefulWidget {
  const _UploadForm({required this.onDone});
  final VoidCallback onDone;
  @override
  ConsumerState<_UploadForm> createState() => _UploadFormState();
}

class _UploadFormState extends ConsumerState<_UploadForm> {
  final _nom = TextEditingController();
  final _type = TextEditingController(text: 'PV');
  String _visibilite = 'PUBLIC_COPROPRIETE';
  XFile? _file;
  bool _loading = false;
  ApiFail? _fail;

  Future<void> _pick() async {
    final f = await ImagePicker().pickMedia();
    if (f != null) setState(() => _file = f);
  }

  Future<void> _submit() async {
    final f = _file;
    if (f == null) return;
    setState(() {
      _loading = true;
      _fail = null;
    });
    final api = ref.read(apiClientProvider);
    final contentType = f.mimeType ?? (f.path.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    final prep = await api.post<Map<String, dynamic>>('/documents/upload-url', body: {'nom_fichier': f.name, 'content_type': contentType}, parse: asMap);
    if (prep is ApiFail<Map<String, dynamic>>) {
      setState(() {
        _loading = false;
        _fail = prep;
      });
      return;
    }
    final p = (prep as ApiOk<Map<String, dynamic>>).data;
    final ok = await api.uploadSigned(p['upload_url'] as String, await File(f.path).readAsBytes(), contentType);
    if (!ok) {
      setState(() {
        _loading = false;
        _fail = const ApiFail(ApiError(code: 'INTERNAL_ERROR', message: 'Téléversement refusé par le stockage.'), 500);
      });
      return;
    }
    final res = await api.post<dynamic>('/documents', body: {'type': _type.text.trim(), 'nom': _nom.text.trim().isEmpty ? f.name : _nom.text.trim(), 'visibilite': _visibilite, 'storage_path': p['storage_path']});
    if (!mounted) return;
    if (res is ApiFail) {
      setState(() {
        _loading = false;
        _fail = res;
      });
      return;
    }
    widget.onDone();
    Navigator.pop(context);
    showToast(context, context.dict.documents.ajoute);
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        OutlinedButton.icon(onPressed: _pick, icon: const Icon(Icons.attach_file_rounded), label: Text(_file?.name ?? d.documents.fichier)),
        Padding(padding: const EdgeInsets.only(top: 6), child: Text(d.documents.fichierAide, style: Theme.of(context).textTheme.bodySmall)),
        const SizedBox(height: 14),
        SuField(label: d.documents.nom, controller: _nom, error: fieldError(_fail, 'nom')),
        const SizedBox(height: 12),
        SuField(label: d.documents.type, controller: _type, help: d.documents.typeHint, error: fieldError(_fail, 'type'), required: true),
        const SizedBox(height: 12),
        SuSelect<String>(label: d.documents.visibilite, value: _visibilite, options: const ['PUBLIC_COPROPRIETE', 'SYNDIC_ONLY', 'CONSEIL_SYNDICAL'], labelOf: (v) => d.enums.visibiliteDocument[v] ?? v, onChanged: (v) => setState(() => _visibilite = v), help: d.documents.visibiliteAide[_visibilite]),
        const SizedBox(height: 16),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(label: d.documents.televerser, loading: _loading, onPressed: _file == null ? null : _submit),
      ],
    );
  }
}
