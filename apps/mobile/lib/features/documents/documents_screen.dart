import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/refresh.dart';
import '../../core/api/api_result.dart';
import '../../core/api/models.dart';
import '../../core/api/providers.dart';
import '../../core/auth/app_state.dart';
import '../../core/auth/session.dart';
import '../../core/format/format.dart';
import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
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
      onRefresh: () => refreshing(ref, [documentsProvider]),
      staleKeys: const ['/documents'],
      actions: [if (ctx.isGestion) CircleIconButton(icon: Icons.upload_file_rounded, tooltip: d.documents.televerser, onTap: () => _upload(context))],
      children: [
        PhotoBanner('cour', title: ctx.copropriete?.nom),
        // Recherche Wise : pill greige pleine, loupe encre, sans liseré.
        SuSearchField(hint: d.common.search, controller: _search, pill: true, onChanged: (v) => setState(() => _filtre = v.toLowerCase())),
        const SizedBox(height: 16),
        AsyncView(docs, onRetry: () => ref.invalidate(documentsProvider), data: (list) {
          final types = list.map((x) => x.type).toSet().toList()..sort();
          final visible = list.where((x) => _filtre.isEmpty || x.nom.toLowerCase().contains(_filtre) || x.type.toLowerCase().contains(_filtre)).toList();
          if (visible.isEmpty) {
            return _filtre.isNotEmpty && list.isNotEmpty
                ? EmptyState(title: d.documents.aucunDocument, icon: Icons.search_rounded, illustration: 'empty-search')
                : EmptyState(title: d.documents.aucunDocument, hint: ctx.isGestion ? d.documents.aucunDocumentAide : null, icon: Icons.description_rounded, illustration: 'empty-documents');
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (types.length > 1) ...[
                Wrap(spacing: 6, children: [for (final ty in types) StatusBadge(libelleTypeDocument(context, ty), variant: BadgeVariant.outline, small: true)]),
                const SizedBox(height: 12),
              ],
              CardList([for (final doc in visible) DocumentRow(doc, key: ValueKey(doc.id), canDelete: ctx.isGestion)]),
              const SizedBox(height: 16),
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Padding(padding: EdgeInsetsDirectional.only(top: 1, end: 6), child: Icon(Icons.lock_rounded, size: 14, color: SuColors.faint)),
                Expanded(child: Text(d.documents.telechargement, style: t.labelSmall)),
              ]),
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
      leading: const IconCircle(Icons.picture_as_pdf_rounded, tone: Tone.lilac),
      title: doc.nom,
      subtitle: '${libelleTypeDocument(context, doc.type)} · ${formatDateCourte(doc.creeLe, context.locale)} · ${d.enums.visibiliteDocument[doc.visibilite] ?? humanizeCode(doc.visibilite)}',
      trailing: canDelete
          ? BusyBuilder(
              'document-supprimer:${doc.id}',
              builder: (_, busy) => busy
                  ? const Padding(padding: EdgeInsets.all(12), child: LoadingOrb(size: 9))
                  : SuIconButton(
                      icon: Icons.delete_outline_rounded,
                      color: SuColors.faint,
                      onPressed: () => runAction<dynamic>(
                        context,
                        () => ref.read(apiClientProvider).delete<dynamic>('/documents/${doc.id}'),
                        busyKey: 'document-supprimer:${doc.id}',
                        confirm: ActionConfirm(title: d.gestion.supprimer, body: d.gestion.documentSupprimerAide, danger: true, irreversible: true),
                        successMsg: d.gestion.supprime,
                        onSuccess: (_) => ref.invalidate(documentsProvider),
                      ),
                    ),
            )
          : null,
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
        CardList([for (final doc in documents.take(3)) DocumentRow(doc, key: ValueKey(doc.id))]),
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
  final _form = GlobalKey<FormState>();
  String _visibilite = 'PUBLIC_COPROPRIETE';

  /// Le fichier (50 Mo au plus) part en flux avec progression ; si l'enregistrement du document
  /// échoue ensuite, « Réessayer » ne le renvoie pas au stockage.
  late final UploadQueue _file = UploadQueue.forApi(ref.read(apiClientProvider), UploadTarget.documents, max: 1);
  bool _loading = false;
  ApiFail? _fail;

  @override
  void initState() {
    super.initState();
    _file.addListener(_redessiner);
  }

  void _redessiner() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _file
      ..removeListener(_redessiner)
      ..dispose();
    _nom.dispose();
    _type.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    final p = await choisirPiece(context, target: UploadTarget.documents);
    if (p == null || !mounted) return;
    _file.replace(p);
  }

  Future<void> _submit() async {
    if (_file.isEmpty) return;
    if (!(_form.currentState?.validate() ?? true)) return;
    setState(() {
      _loading = true;
      _fail = null;
    });
    final api = ref.read(apiClientProvider);
    final echec = await _file.sendAll();
    if (!mounted) return;
    if (echec != null) {
      setState(() {
        _loading = false;
        _fail = echec.code == UploadError.cancelled ? null : echec.toApiFail();
      });
      return;
    }
    final nomFichier = _file.slots.first.piece.nom;
    final res = await api.post<dynamic>('/documents', body: {'type': _type.text.trim(), 'nom': _nom.text.trim().isEmpty ? nomFichier : _nom.text.trim(), 'visibilite': _visibilite, 'storage_path': _file.paths.first});
    if (!mounted) return;
    if (res is ApiFail) {
      setState(() {
        _loading = false;
        _fail = res;
      });
      return;
    }
    widget.onDone();
    // Contexte racine capturé avant de fermer la feuille : l'écran de succès s'y pose.
    final racine = Navigator.of(context, rootNavigator: true);
    final titre = context.dict.documents.ajoute;
    Navigator.pop(context);
    if (racine.mounted) showSuccess(racine.context, title: titre, illustration: 'ok-general');
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final up = context.mup;
    final manque = [
      if (_file.isEmpty) up.missingFile,
      if (_type.text.trim().isEmpty) d.documents.type,
    ];
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_file.isEmpty) SuButton(label: d.documents.fichier, icon: Icons.attach_file_rounded, variant: SuButtonVariant.secondary, onPressed: _loading ? null : _pick),
          SuUploadList(queue: _file, enabled: !_loading),
          Padding(padding: const EdgeInsets.only(top: 6), child: Text(d.documents.fichierAide, style: Theme.of(context).textTheme.bodySmall)),
          const SizedBox(height: 14),
          SuField(label: d.documents.nom, controller: _nom, error: fieldError(_fail, 'nom')),
          const SizedBox(height: 12),
          SuField(label: d.documents.type, controller: _type, help: d.documents.typeHint, error: fieldError(_fail, 'type'), required: true, onChanged: (_) => setState(() {}), validator: SuValidators.required(context)),
          const SizedBox(height: 12),
          SuSelect<String>(label: d.documents.visibilite, value: _visibilite, options: const ['PUBLIC_COPROPRIETE', 'SYNDIC_ONLY', 'CONSEIL_SYNDICAL'], labelOf: (v) => d.enums.visibiliteDocument[v] ?? humanizeCode(v), onChanged: (v) => setState(() => _visibilite = v), help: d.documents.visibiliteAide[_visibilite]),
          const SizedBox(height: 16),
          FormError(_fail),
          if (_fail != null) const SizedBox(height: 12),
          SubmitButton(label: d.documents.televerser, loading: _loading, missing: manque, onPressed: manque.isNotEmpty || _file.busy ? null : _submit, fail: _fail),
        ],
      ),
    );
  }
}

/// Type de document lisible : code système traduit, sinon texte libre saisi (« REGLEMENT_X »
/// → « Reglement x »).
String libelleTypeDocument(BuildContext context, String code) {
  final connu = context.mdict.docTypes[code.toUpperCase()];
  if (connu != null) return connu;
  if (!RegExp(r'^[A-Z0-9_]+$').hasMatch(code)) return code;
  final t = code.replaceAll('_', ' ').toLowerCase();
  return t.isEmpty ? code : '${t[0].toUpperCase()}${t.substring(1)}';
}
