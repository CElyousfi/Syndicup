import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
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
import '../../offline/local_db/database.dart';
import '../../offline/sync_queue/taches_sync.dart';
import '../documents/document_viewer_screen.dart';
import '../lcd/lcd_sejour_screens.dart' show choisirPiece, PieceLocale;

const _filtres = ['OUVERTES', 'RETARD', 'A_FAIRE', 'EN_COURS', 'BLOQUEE', 'TERMINEE', 'TOUTES'];

/// Tâches (M22) — syndic / conseil : registre filtré ; gardien : « Mes tâches » (hors-ligne pour le statut).
class TachesScreen extends ConsumerStatefulWidget {
  const TachesScreen({super.key});
  @override
  ConsumerState<TachesScreen> createState() => _TachesScreenState();
}

class _TachesScreenState extends ConsumerState<TachesScreen> {
  String _filtre = 'OUVERTES';
  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final t = d.taches;
    final e = d.enumsTaches;
    final gardien = !(ctx.isGestion || ctx.isConseil);
    final liste = gardien ? ref.watch(mesTachesProvider) : ref.watch(tachesProvider(_filtre));
    final file = gardien ? (ref.watch(tachesQueueProvider).valueOrNull ?? const <TachesQueueData>[]) : const <TachesQueueData>[];
    return SuPage(
      title: gardien ? t.mesTaches : t.titre,
      subtitle: gardien ? t.mesTachesSubtitle : t.subtitle,
      onRefresh: () async {
        ref.invalidate(mesTachesProvider);
        ref.invalidate(tachesProvider);
      },
      children: [
        if (file.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 12), child: SuBanner(tone: BannerTone.info, body: '${context.mdict.pendingSend} (${file.length})', action: SuButton(variant: SuButtonVariant.ghost, onPressed: () => ref.read(tachesSyncProvider.notifier).flush(), label: d.common.retry))),
        if (!gardien) ...[
          FilterChips<String>(value: _filtre, options: _filtres, labelOf: (v) => switch (v) { 'OUVERTES' => t.ouvertes, 'RETARD' => t.enRetard, 'TOUTES' => t.toutes, _ => e.statut[v] ?? v }, onChanged: (v) => setState(() => _filtre = v)),
          const SizedBox(height: 16),
        ],
        SuFadeSwitch(value: _filtre, child: AsyncView(liste, onRetry: () => gardien ? ref.invalidate(mesTachesProvider) : ref.invalidate(tachesProvider(_filtre)), data: (rows) {
          final visibles = gardien && _filtre == 'OUVERTES' ? rows.where((x) => x.ouverte).toList() : rows;
          if (visibles.isEmpty) return EmptyState(title: gardien ? t.aucuneMienne : (_filtre == 'OUVERTES' ? t.aucune : t.aucuneFiltre), hint: ctx.isGestion && _filtre == 'OUVERTES' ? t.aucuneAide : null, icon: Icons.task_alt_rounded, illustration: gardien || _filtre == 'OUVERTES' ? 'empty-taches' : 'empty-search');
          return CardList([for (final x in visibles) TacheRow(x, key: ValueKey(x.id), file: file)]);
        })),
      ],
    );
  }
}

class TacheRow extends StatelessWidget {
  const TacheRow(this.x, {super.key, this.file = const []});
  final Tache x;
  final List<TachesQueueData> file;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final l = context.locale;
    final t = d.taches;
    final e = d.enumsTaches;
    final enFile = file.any((q) => q.tacheId == x.id && !q.definitif);
    return ListRow(
      leading: IconCircle(tacheIcone(x), tone: tacheTone(x)),
      title: x.titre,
      subtitle: '${x.dateEcheance != null ? formatJourAnnee(x.dateEcheance, l) : t.sansEcheance}${x.assignee != null ? ' · ${x.assignee!.affichage}' : ''}${x.checklist != null && x.checklist!.isNotEmpty ? ' · ${fill(t.checklistProgres, {'n': '${x.checklistFaits}', 'total': '${x.checklist!.length}'})}' : ''}${x.origine != 'MANUELLE' ? ' · ${e.origine[x.origine] ?? x.origine}' : ''}',
      trailing: enFile ? const Icon(Icons.cloud_upload_outlined, size: 18, color: SuColors.soft) : StatusBadge(x.enRetard ? t.enRetard : (e.statut[x.statut] ?? x.statut), variant: x.enRetard ? BadgeVariant.danger : (tacheVariant[x.statut] ?? BadgeVariant.neutral), small: true),
      chevron: true,
      onTap: () => context.push('/taches/${x.id}'),
    );
  }
}

IconData tacheIcone(Tache x) => x.statut == 'TERMINEE' ? Icons.check_circle_rounded : x.enRetard ? Icons.warning_amber_rounded : x.statut == 'BLOQUEE' ? Icons.block_rounded : x.statut == 'ANNULEE' ? Icons.cancel_rounded : Icons.task_alt_rounded;

Tone tacheTone(Tache x) => x.statut == 'TERMINEE' ? Tone.ok : x.enRetard ? Tone.danger : x.statut == 'ANNULEE' ? Tone.neutral : x.priorite == 'HAUTE' || x.priorite == 'CRITIQUE' ? Tone.warn : Tone.sage;

/// Fiche d'une tâche — checklist cochable, statut (avec photo), commentaires, journal, objet source.
class TacheDetailScreen extends ConsumerStatefulWidget {
  const TacheDetailScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<TacheDetailScreen> createState() => _TacheDetailScreenState();
}

class _TacheDetailScreenState extends ConsumerState<TacheDetailScreen> {
  final _commentaire = TextEditingController();
  bool _envoi = false;

  Future<void> _cocher(Tache x, ChecklistItem it, bool fait) async {
    final r = await ref.read(apiClientProvider).request<dynamic>('PATCH', '/taches/${x.id}/checklist', body: {'item_id': it.id, 'fait': fait});
    if (!mounted) return;
    if (r is ApiFail) { showToast(context, r.error.message, error: true); return; }
    ref.invalidate(tacheProvider(widget.id));
    ref.invalidate(mesTachesProvider);
  }

  Future<void> _changerStatut(Tache x, bool syndic) async {
    final d = context.dict;
    final res = await showFormSheet<({String statut, String? commentaire, PieceLocale? piece})>(context, title: d.taches.changerStatut, builder: (_) => _StatutSheet(tache: x, syndic: syndic));
    if (res == null || !mounted) return;
    final api = ref.read(apiClientProvider);
    if (res.piece != null) {
      // Une photo ne se met pas en file : envoi direct (réseau requis).
      final prep = await api.post<Map<String, dynamic>>('/taches/upload-url', body: {'nom_fichier': res.piece!.nom, 'content_type': res.piece!.contentType}, parse: asMap);
      if (prep is! ApiOk<Map<String, dynamic>>) { if (mounted) showToast(context, (prep as ApiFail).error.message, error: true); return; }
      final ok = await api.uploadSigned(prep.data['upload_url'] as String, await File(res.piece!.chemin).readAsBytes(), res.piece!.contentType);
      if (!ok) { if (mounted) showToast(context, d.common.errorTitle, error: true); return; }
      final r = await api.post<Tache>('/taches/${x.id}/statut', body: {'statut': res.statut, if (res.commentaire != null && res.commentaire!.isNotEmpty) 'commentaire': res.commentaire, 'piece_jointe': {'storage_path': prep.data['storage_path'], 'nom': res.piece!.nom}}, idempotent: true, parse: (j) => Tache.fromJson(asMap(j)));
      if (!mounted) return;
      if (r is ApiFail<Tache>) { showToast(context, r.error.message, error: true); return; }
      showToast(context, d.taches.statutChange);
    } else {
      final r = await ref.read(tachesSyncProvider.notifier).changerStatut(tacheId: x.id, statut: res.statut, commentaire: res.commentaire, libelle: x.titre);
      if (!mounted) return;
      if (r.refus != null) { showToast(context, r.refus!.error.message, error: true); return; }
      showToast(context, r.enFile ? context.mdict.pendingSend : (r.tache?.suivanteId != null ? '${d.taches.statutChange} ${d.taches.suivanteCreee}' : d.taches.statutChange));
    }
    ref.invalidate(tacheProvider(widget.id));
    ref.invalidate(mesTachesProvider);
    ref.invalidate(tachesProvider);
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final t = d.taches;
    final e = d.enumsTaches;
    final tt = Theme.of(context).textTheme;
    final tache = ref.watch(tacheProvider(widget.id));
    return SuPage(
      title: tache.valueOrNull?.titre ?? t.titre,
      onRefresh: () async => ref.invalidate(tacheProvider(widget.id)),
      children: [
        AsyncView(
          tache,
          onRetry: () => ref.invalidate(tacheProvider(widget.id)),
          data: (x) {
            final lien = x.resolutionAg != null ? (label: t.voirResolution, path: '/ag/${x.resolutionAg!['agId']}', texte: '${d.ag.resolutions} n° ${x.resolutionAg!['ordre']} — ${x.resolutionAg!['texte']}')
                : x.contratEcheance != null ? (label: t.voirContrat, path: '/contrats/${x.contratEcheance!['contratId']}', texte: '${x.contratEcheance!['contratLibelle']} · ${formatJourAnnee('${x.contratEcheance!['dateEcheance']}', l)}')
                : x.incident != null ? (label: t.voirIncident, path: '/incidents/${x.incident!['id']}', texte: d.enums.categorieIncident['${x.incident!['categorie']}'] ?? '${x.incident!['categorie']}')
                : x.rapportGestion != null ? (label: t.voirRapport, path: '/rapports', texte: '${d.rapports.gestionTitre} ${x.rapportGestion!['exercice']}')
                : null;
            final nbFaits = x.checklistFaits;
            final nbEtapes = x.checklist?.length ?? 0;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Bloc résumé Wise : grande pastille, statut en gros, origine, priorité, description.
                SuEnter(
                  child: SuCard(
                    padding: const EdgeInsets.all(20),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        IconCircle(tacheIcone(x), tone: tacheTone(x), size: 64),
                        const Spacer(),
                        if (x.enRetard) StatusBadge(t.enRetard, variant: BadgeVariant.danger, pulse: true),
                      ]),
                      const SizedBox(height: 18),
                      Text(e.statut[x.statut] ?? x.statut, style: tt.displaySmall),
                      const SizedBox(height: 4),
                      Text('${e.origine[x.origine] ?? x.origine}${x.creePar != null ? ' · ${x.creePar!.affichage}' : x.origine != 'MANUELLE' ? ' · ${t.creeeParSysteme}' : ''} · ${formatDateHeure(x.creeLe, l)}', style: tt.bodyMedium?.copyWith(color: SuColors.soft)),
                      const SizedBox(height: 14),
                      Wrap(spacing: 6, runSpacing: 6, children: [
                        StatusBadge(e.priorite[x.priorite] ?? x.priorite, variant: prioriteVariant[x.priorite] ?? BadgeVariant.neutral),
                      ]),
                      if (nbEtapes > 0) ...[
                        const SizedBox(height: 16),
                        Gauge(nbFaits / nbEtapes, height: 6),
                      ],
                      if (x.description != null && x.description!.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Text(x.description!, style: tt.bodyLarge?.copyWith(color: SuColors.ink, height: 1.5)),
                      ],
                    ]),
                  ),
                ),
                if (x.peutMettreAJour && (x.ouverte || ctx.isGestion) && x.statut != 'ANNULEE') Padding(padding: const EdgeInsets.only(top: 16), child: SubmitButton(label: t.changerStatut, icon: Icons.published_with_changes_rounded, onPressed: () => _changerStatut(x, ctx.isGestion))),
                SectionHeader(d.common.details),
                SuCard(padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8), child: Column(children: [
                  KeyValueRow(t.assignee, x.assignee?.affichage ?? t.nonAssignee),
                  KeyValueRow(t.echeance, x.dateEcheance != null ? formatJourAnnee(x.dateEcheance, l) : t.sansEcheance),
                  if (x.termineeLe != null) KeyValueRow(e.statut['TERMINEE'] ?? 'TERMINEE', formatDateHeure(x.termineeLe, l)),
                  KeyValueRow(t.recurrence, x.recurrenceFrequence != null ? (e.frequence[x.recurrenceFrequence!] ?? x.recurrenceFrequence!) : t.aucuneRecurrence),
                ])),
                if (x.checklist != null && x.checklist!.isNotEmpty) ...[
                  SectionHeader(t.checklist, subtitle: fill(t.checklistProgres, {'n': '$nbFaits', 'total': '$nbEtapes'})),
                  SuCard(padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4), child: Column(children: [
                    for (final it in x.checklist!)
                      Padding(
                        key: ValueKey(it.id),
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        child: SuCheckbox(value: it.fait, onChanged: x.peutMettreAJour && x.ouverte ? (v) => _cocher(x, it, v) : null, label: it.libelle, labelStyle: it.fait ? tt.bodyLarge?.copyWith(decoration: TextDecoration.lineThrough, color: SuColors.soft) : tt.bodyLarge?.copyWith(color: SuColors.ink)),
                      ),
                  ])),
                ],
                if (lien != null) ...[
                  SectionHeader(t.lieA),
                  CardList([ListRow(leading: const IconCircle(Icons.link_rounded, tone: Tone.lilac), title: lien.texte, subtitle: lien.label, onTap: () => context.push(lien.path))]),
                ],
                if (x.piecesJointes.isNotEmpty) ...[
                  SectionHeader(t.piecesJointes),
                  CardList([for (final p in x.piecesJointes) ListRow(leading: const IconCircle(Icons.attach_file_rounded, tone: Tone.neutral), title: '${p['nom']}', chevron: true, onTap: () => ouvrirVisionneuse(context, titre: '${p['nom']}', url: '${p['url']}'))]),
                ],
                SectionHeader('${t.commentaires}${x.commentaires.isNotEmpty ? ' · ${x.commentaires.length}' : ''}'),
                if (x.commentaires.isEmpty) Text(t.aucunCommentaire, style: tt.bodyMedium?.copyWith(color: SuColors.soft)),
                // Fil de commentaires Wise : avatar, nom gras, heure ardoise, bulle greige.
                for (int k = 0; k < x.commentaires.length; k++)
                  SuEnter(index: k, offset: 0.12, child: _Commentaire(auteur: IdentiteCourte.fromJson(_asMap(x.commentaires[k]['auteur'])).affichage, quand: formatDateHeure('${x.commentaires[k]['creeLe']}', l), texte: '${x.commentaires[k]['contenu']}')),
                const SizedBox(height: 14),
                SuField(label: t.votreCommentaire, controller: _commentaire, maxLines: 3, maxLength: 4000),
                const SizedBox(height: 8),
                SubmitButton(label: t.commenter, secondary: true, loading: _envoi, onPressed: () async {
                  if (_commentaire.text.trim().isEmpty) return;
                  setState(() => _envoi = true);
                  final r = await ref.read(apiClientProvider).post<dynamic>('/taches/${x.id}/commentaires', body: {'contenu': _commentaire.text.trim()});
                  if (!context.mounted) return;
                  setState(() => _envoi = false);
                  if (r is ApiFail) { showToast(context, r.error.message, error: true); return; }
                  _commentaire.clear();
                  showToast(context, t.commentaireEnvoye);
                  ref.invalidate(tacheProvider(widget.id));
                }),
                if (x.journal.isNotEmpty) ...[
                  // Journal = fil d'activité Wise (plus récent en haut).
                  SectionHeader(t.journal),
                  CardList([
                    for (final j in x.journal.reversed.take(10))
                      ListRow(
                        leading: const IconCircle(Icons.history_rounded, tone: Tone.neutral),
                        title: '${j['type']}${(j['details'] is Map && (j['details'] as Map)['vers'] != null) ? ' → ${e.statut['${(j['details'] as Map)['vers']}'] ?? (j['details'] as Map)['vers']}' : ''}',
                        subtitle: formatDateHeure('${j['horodatage']}', l),
                      ),
                  ]),
                ],
              ],
            );
          },
        ),
      ],
    );
  }
}

/// Commentaire Wise : avatar initiales, auteur gras + heure, bulle greige.
class _Commentaire extends StatelessWidget {
  const _Commentaire({required this.auteur, required this.quand, required this.texte});
  final String auteur, quand, texte;
  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Avatar(auteur, size: 40),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(auteur, style: tt.titleSmall, maxLines: 1, overflow: TextOverflow.ellipsis)),
              const SizedBox(width: 8),
              Text(quand, style: tt.bodySmall?.copyWith(color: SuColors.soft)),
            ]),
            Container(
              margin: const EdgeInsets.only(top: 6),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(color: SuColors.tile, borderRadius: const BorderRadiusDirectional.only(topEnd: Radius.circular(18), bottomStart: Radius.circular(18), bottomEnd: Radius.circular(18), topStart: Radius.circular(6)).resolve(Directionality.of(context))),
              child: Text(texte, style: tt.bodyMedium?.copyWith(color: SuColors.ink, height: 1.45)),
            ),
          ]),
        ),
      ]),
    );
  }
}

Map<String, dynamic> _asMap(dynamic v) => v is Map ? v.cast<String, dynamic>() : const {};

/// Feuille « changer le statut » — statut cible, commentaire, photo optionnelle (envoi direct).
class _StatutSheet extends StatefulWidget {
  const _StatutSheet({required this.tache, required this.syndic});
  final Tache tache;
  final bool syndic;
  @override
  State<_StatutSheet> createState() => _StatutSheetState();
}

class _StatutSheetState extends State<_StatutSheet> {
  late String _statut;
  final _commentaire = TextEditingController();
  PieceLocale? _piece;
  @override
  void initState() {
    super.initState();
    final cibles = _cibles();
    _statut = widget.tache.statut == 'EN_COURS' && cibles.contains('TERMINEE') ? 'TERMINEE' : cibles.first;
  }
  List<String> _cibles() => ['A_FAIRE', 'EN_COURS', 'BLOQUEE', 'TERMINEE', 'ANNULEE'].where((s) => s != widget.tache.statut && (widget.syndic || s != 'ANNULEE')).toList();
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = d.taches;
    final e = d.enumsTaches;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SuSelect<String>(label: t.nouveauStatut, value: _statut, options: _cibles(), labelOf: (v) => e.statut[v] ?? v, onChanged: (v) => setState(() => _statut = v)),
      const SizedBox(height: 12),
      SuField(label: t.commentaireStatut, controller: _commentaire, maxLines: 3, maxLength: 4000, optionalLabel: d.common.optional),
      const SizedBox(height: 8),
      Row(children: [
        Expanded(child: Text(_piece?.nom ?? t.photo, style: Theme.of(context).textTheme.bodyMedium, overflow: TextOverflow.ellipsis)),
        SuButton(variant: SuButtonVariant.ghost, onPressed: () async { final p = await choisirPiece(context); if (p != null) setState(() => _piece = p); }, icon: Icons.add_a_photo_outlined, label: d.common.add),
        if (_piece != null) SuIconButton(onPressed: () => setState(() => _piece = null), icon: Icons.close_rounded, iconSize: 18),
      ]),
      if (widget.tache.recurrenceFrequence != null && _statut == 'TERMINEE') Padding(padding: const EdgeInsets.only(top: 4), child: Text(t.recurrenceAide, style: Theme.of(context).textTheme.bodySmall)),
      const SizedBox(height: 12),
      SubmitButton(label: t.changerStatut, danger: _statut == 'ANNULEE', onPressed: () => Navigator.pop(context, (statut: _statut, commentaire: _commentaire.text.trim().isEmpty ? null : _commentaire.text.trim(), piece: _piece))),
    ]);
  }
}

/// Ligne « exécution » d'une résolution adoptée (fiche AG) — visible de tout membre voyant l'AG.
class ExecutionResolutionLigne extends ConsumerWidget {
  const ExecutionResolutionLigne({super.key, required this.agId, required this.resolution});
  final String agId;
  final AgResolution resolution;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final l = context.locale;
    final t = d.taches;
    final e = d.enumsTaches;
    final ctx = ref.watch(appContextProvider);
    final ex = ref.watch(executionResolutionProvider((agId: agId, resolutionId: resolution.id))).valueOrNull;
    if (ex == null || (!ex.necessiteExecution && ex.taches.isEmpty)) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Pas d'espacement de lettres ni de capitales forcées : le libellé peut être en arabe.
        Text(t.execution, style: Theme.of(context).textTheme.labelMedium?.copyWith(color: SuColors.soft)),
        if (ex.taches.isEmpty) Text(t.aucuneTacheExecution, style: Theme.of(context).textTheme.bodySmall),
        for (final tk in ex.taches)
          SuTap(
            key: ValueKey('${tk['tache_id']}'),
            onTap: ctx.isGestion || ctx.isConseil ? () => context.push('/taches/${tk['tache_id']}') : null,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(children: [
                Expanded(child: Text('${tk['titre']}', style: Theme.of(context).textTheme.bodyMedium, maxLines: 2, overflow: TextOverflow.ellipsis)),
                const SizedBox(width: 8),
                StatusBadge(tk['en_retard'] == true ? t.enRetard : (e.statut['${tk['statut']}'] ?? '${tk['statut']}'), variant: tk['en_retard'] == true ? BadgeVariant.danger : (tacheVariant['${tk['statut']}'] ?? BadgeVariant.neutral), small: true),
                if (tk['date_echeance'] != null) Padding(padding: const EdgeInsetsDirectional.only(start: 6), child: Text(formatJourAnnee('${tk['date_echeance']}', l), style: Theme.of(context).textTheme.bodySmall)),
              ]),
            ),
          ),
      ]),
    );
  }
}
