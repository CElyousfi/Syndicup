import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

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
import '../shell/app_shell.dart';

IconData iconCategorie(String c) => switch (c) {
      'PLOMBERIE' => Icons.water_drop_rounded,
      'ELECTRICITE' => Icons.bolt_rounded,
      'ASCENSEUR' => Icons.elevator_rounded,
      'NETTOYAGE' => Icons.cleaning_services_rounded,
      'SECURITE' => Icons.shield_rounded,
      'STRUCTURE' => Icons.foundation_rounded,
      'JARDINS_ESPACES_VERTS' => Icons.park_rounded,
      'NUISANCES' => Icons.volume_up_rounded,
      'PARKING' => Icons.local_parking_rounded,
      'EQUIPEMENTS_COLLECTIFS' => Icons.settings_input_component_rounded,
      _ => Icons.description_rounded,
    };

// ── F1 Liste ──────────────────────────────────────────────────────────────────
class IncidentsScreen extends ConsumerStatefulWidget {
  const IncidentsScreen({super.key});
  @override
  ConsumerState<IncidentsScreen> createState() => _IncidentsScreenState();
}

class _IncidentsScreenState extends ConsumerState<IncidentsScreen> {
  String _statut = 'OUVERTS';
  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final incidents = ref.watch(incidentsProvider);
    final titre = ctx.isPrestataire ? d.incidents.mesTickets : ctx.isResident ? d.incidents.mesSignalements : d.incidents.titre;
    final racine = !context.canPop();
    return Scaffold(
      appBar: racine ? ShellHeader(title: titre) : AppBar(title: Text(titre)),
      floatingActionButton: ctx.isPrestataire ? null : FloatingActionButton.extended(onPressed: () => context.push('/incidents/nouveau'), backgroundColor: SuColors.ink, foregroundColor: Colors.white, icon: const Icon(Icons.add_rounded), label: Text(d.incidents.signaler)),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(incidentsProvider),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
          children: [
            FilterChips<String>(value: _statut, options: const ['OUVERTS', 'TOUS', 'OUVERT', 'EN_COURS', 'RESOLU', 'FERME'], labelOf: (v) => v == 'OUVERTS' ? d.dash.incidentsOuverts : v == 'TOUS' ? d.common.all : d.enums.statutIncident[v] ?? v, onChanged: (v) => setState(() => _statut = v)),
            const SizedBox(height: 12),
            AsyncView(incidents, onRetry: () => ref.invalidate(incidentsProvider), data: (list) {
              final visible = list.where((i) => _statut == 'TOUS' || (_statut == 'OUVERTS' ? i.ouvert : i.statut == _statut)).toList()..sort((a, b) => b.creeLe.compareTo(a.creeLe));
              if (visible.isEmpty) return EmptyState(title: d.incidents.aucunIncident, hint: d.incidents.aucunIncidentAide, icon: Icons.build_rounded, actionLabel: ctx.isPrestataire ? null : d.incidents.signaler, onAction: () => context.push('/incidents/nouveau'));
              return CardList([
                for (final i in visible)
                  ListRow(
                    leading: IconCircle(iconCategorie(i.categorie), tone: i.slaDepasse ? Tone.danger : Tone.tosca, size: 40),
                    title: i.sousCategorie,
                    subtitle: '${d.enums.categorieIncident[i.categorie] ?? i.categorie} · ${d.enums.partie[i.partie] ?? i.partie} · ${formatDateHeure(i.creeLe, context.locale)}',
                    trailing: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        StatusBadge(d.enums.urgence[i.urgence] ?? i.urgence, variant: urgenceVariant[i.urgence] ?? BadgeVariant.neutral, small: true),
                        const SizedBox(height: 4),
                        i.slaDepasse ? StatusBadge(d.incidents.slaDepasse, variant: BadgeVariant.danger, small: true, pulse: true) : StatusBadge(d.enums.statutIncident[i.statut] ?? i.statut, variant: incidentVariant[i.statut] ?? BadgeVariant.neutral, small: true),
                      ],
                    ),
                    onTap: () => context.push('/incidents/${i.id}'),
                  ),
              ]);
            }),
          ],
        ),
      ),
    );
  }
}

// ── F2 Signalement guidé ──────────────────────────────────────────────────────
class IncidentFormScreen extends ConsumerStatefulWidget {
  const IncidentFormScreen({super.key, this.sejourId});
  /// Séjour LCD à lier (deep-link depuis la fiche séjour — M15).
  final String? sejourId;
  @override
  ConsumerState<IncidentFormScreen> createState() => _IncidentFormScreenState();
}

class _IncidentFormScreenState extends ConsumerState<IncidentFormScreen> {
  String? _categorie;
  String _partie = 'COMMUNE';
  String _urgence = 'NORMALE';
  String? _lot;
  String? _sejour;
  final _sous = TextEditingController();
  final _desc = TextEditingController();
  final List<XFile> _photos = [];
  bool _loading = false;
  ApiFail? _fail;

  @override
  void initState() {
    super.initState();
    _sejour = widget.sejourId;
  }

  Future<void> _pick(ImageSource src) async {
    if (_photos.length >= 5) return;
    final f = await ImagePicker().pickImage(source: src, imageQuality: 78, maxWidth: 1600);
    if (f != null) setState(() => _photos.add(f));
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    final mesLots = ctx.isResident ? lots.where((x) => x.concerne(ctx.profil.id)).toList() : lots;
    // Séjours LCD en cours (M15) : sélecteur affiché seulement s'il y en a (ou si un séjour est pré-lié).
    final sejoursEnCours = ref.watch(lcdSejoursEnCoursProvider).valueOrNull ?? const <LcdSejour>[];
    final sejourOptions = [...sejoursEnCours, if (_sejour != null && !sejoursEnCours.any((s) => s.id == _sejour)) null];
    return SuPage(
      title: d.incidents.signaler,
      children: [
        Text('1 · ${d.incidents.categorie}', style: t.titleSmall),
        const SizedBox(height: 8),
        GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          childAspectRatio: 1.05,
          children: [
            for (final c in d.enums.categorieIncident.keys)
              Material(
                color: _categorie == c ? SuColors.actionTint : SuColors.surface,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: _categorie == c ? SuColors.action : SuColors.hairline, width: _categorie == c ? 1.5 : 1)),
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => setState(() => _categorie = c),
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(iconCategorie(c), color: _categorie == c ? SuColors.action : SuColors.body, size: 26), const SizedBox(height: 6), Text(d.enums.categorieIncident[c]!, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: t.labelSmall?.copyWith(color: SuColors.ink))]),
                  ),
                ),
              ),
          ],
        ),
        if (fieldError(_fail, 'categorie') != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(fieldError(_fail, 'categorie')!, style: t.bodySmall?.copyWith(color: SuColors.danger))),
        const SizedBox(height: 14),
        SuField(label: d.incidents.sousCategorie, controller: _sous, hint: d.incidents.sousCategorieHint, required: true, error: fieldError(_fail, 'sous_categorie')),
        const SizedBox(height: 18),
        Text('2 · ${d.incidents.partie}', style: t.titleSmall),
        const SizedBox(height: 8),
        Segmented<String>(value: _partie, options: const ['COMMUNE', 'PRIVATIVE'], labelOf: (v) => d.enums.partie[v] ?? v, onChanged: (v) => setState(() => _partie = v)),
        const SizedBox(height: 6),
        Text(d.incidents.partieAide, style: t.bodySmall),
        const SizedBox(height: 18),
        Text('3 · ${d.incidents.urgence}', style: t.titleSmall),
        const SizedBox(height: 8),
        for (final u in const ['NORMALE', 'URGENTE', 'URGENCE_MAXIMALE'])
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Material(
              color: _urgence == u ? (u == 'URGENCE_MAXIMALE' ? SuColors.dangerTint : SuColors.actionTint) : SuColors.surface,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: _urgence == u ? (u == 'URGENCE_MAXIMALE' ? SuColors.danger : SuColors.action) : SuColors.hairline)),
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () => setState(() => _urgence = u),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  child: Row(children: [Expanded(child: Text(d.enums.urgence[u]!, style: t.titleSmall)), Text(d.enums.urgenceSla[u] ?? '', style: t.labelSmall)]),
                ),
              ),
            ),
          ),
        if (_urgence == 'URGENCE_MAXIMALE') SuBanner(tone: BannerTone.danger, body: d.incidents.urgenceMaxAide),
        const SizedBox(height: 18),
        SuField(label: d.incidents.description, controller: _desc, hint: d.incidents.descriptionHint, maxLines: 4, optionalLabel: d.common.optional, error: fieldError(_fail, 'description')),
        const SizedBox(height: 14),
        if (mesLots.isNotEmpty) ...[
          SuSelect<String?>(label: d.incidents.lotConcerne, value: _lot, options: [null, ...mesLots.map((x) => x.id)], labelOf: (v) => v == null ? d.common.none : mesLots.firstWhere((x) => x.id == v).numero, onChanged: (v) => setState(() => _lot = v), help: d.incidents.lotConcerneAide),
          const SizedBox(height: 14),
        ],
        if (sejoursEnCours.isNotEmpty || _sejour != null) ...[
          SuSelect<String?>(
            label: d.incidents.lierSejour,
            value: _sejour,
            options: [null, ...sejourOptions.map((s) => s?.id ?? _sejour)],
            labelOf: (v) => v == null ? d.common.none : sejoursEnCours.where((s) => s.id == v).map((s) => '${s.voyageurPrincipalNom} → ${s.lotNumero}').firstOrNull ?? '${d.incidents.sejourLie} ${v.substring(0, 8)}',
            onChanged: (v) => setState(() {
              _sejour = v;
              final s = sejoursEnCours.where((x) => x.id == v).firstOrNull;
              if (s != null && mesLots.any((x) => x.id == s.lotId)) _lot = s.lotId;
            }),
            help: d.incidents.lierSejourAide,
            error: fieldError(_fail, 'sejour_id'),
          ),
          const SizedBox(height: 14),
        ],
        Text(d.incidents.photos, style: t.labelMedium?.copyWith(color: SuColors.ink)),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final p in _photos)
              Stack(
                children: [
                  ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.file(File(p.path), width: 84, height: 84, fit: BoxFit.cover)),
                  PositionedDirectional(end: 0, top: 0, child: GestureDetector(onTap: () => setState(() => _photos.remove(p)), child: Container(decoration: const BoxDecoration(color: SuColors.ink, shape: BoxShape.circle), padding: const EdgeInsets.all(3), child: const Icon(Icons.close_rounded, color: Colors.white, size: 14)))),
                ],
              ),
            if (_photos.length < 5) ...[
              _PhotoBtn(icon: Icons.photo_camera_rounded, label: d.incidents.prendrePhoto, onTap: () => _pick(ImageSource.camera)),
              _PhotoBtn(icon: Icons.photo_library_rounded, label: d.incidents.choisirGalerie, onTap: () => _pick(ImageSource.gallery)),
            ],
          ],
        ),
        Padding(padding: const EdgeInsets.only(top: 6), child: Text(d.incidents.photosAide, style: t.bodySmall)),
        const SizedBox(height: 20),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(label: d.common.send, loading: _loading, onPressed: _categorie == null ? null : _submit),
      ],
    );
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _fail = null;
    });
    final api = ref.read(apiClientProvider);
    final chemins = <String>[];
    for (final p in _photos) {
      final ct = p.mimeType ?? 'image/jpeg';
      final prep = await api.post<Map<String, dynamic>>('/incidents/upload-url', body: {'nom_fichier': p.name, 'content_type': ct}, parse: asMap);
      if (prep is ApiFail<Map<String, dynamic>>) {
        setState(() {
          _loading = false;
          _fail = prep;
        });
        return;
      }
      final pd = (prep as ApiOk<Map<String, dynamic>>).data;
      final ok = await api.uploadSigned(pd['upload_url'] as String, await File(p.path).readAsBytes(), ct);
      if (!ok) {
        setState(() {
          _loading = false;
          _fail = const ApiFail(ApiError(code: 'INTERNAL_ERROR', message: 'Téléversement de la photo refusé par le stockage.'), 500);
        });
        return;
      }
      chemins.add(pd['storage_path'] as String);
    }
    final r = await api.post<Incident>('/incidents', body: {
      'lot_id': _lot,
      'categorie': _categorie,
      'sous_categorie': _sous.text.trim(),
      'description': _desc.text.trim().isEmpty ? null : _desc.text.trim(),
      'partie': _partie,
      'urgence': _urgence,
      if (_sejour != null) 'sejour_id': _sejour,
      if (chemins.isNotEmpty) 'photos': chemins,
    }, parse: (j) => Incident.fromJson(asMap(j)));
    if (!mounted) return;
    switch (r) {
      case ApiOk<Incident>(:final data):
        ref.invalidate(incidentsProvider);
        showToast(context, _urgence == 'URGENCE_MAXIMALE' ? context.dict.incidents.signaleUrgent : context.dict.incidents.signale);
        context.pushReplacement('/incidents/${data.id}');
      case ApiFail<Incident>():
        setState(() {
          _loading = false;
          _fail = r;
        });
    }
  }
}

class _PhotoBtn extends StatelessWidget {
  const _PhotoBtn({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
        color: SuColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: SuColors.hairlineStrong)),
        child: InkWell(borderRadius: BorderRadius.circular(12), onTap: onTap, child: SizedBox(width: 84, height: 84, child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(icon, color: SuColors.body), const SizedBox(height: 4), Text(label, style: Theme.of(context).textTheme.labelSmall, textAlign: TextAlign.center, maxLines: 2)]))),
      );
}

// ── F3 Détail ─────────────────────────────────────────────────────────────────
class IncidentDetailScreen extends ConsumerWidget {
  const IncidentDetailScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final inc = ref.watch(incidentProvider(id));
    final photos = ref.watch(incidentPhotosProvider(id));
    final prestataires = ref.watch(prestatairesProvider).valueOrNull ?? const <Prestataire>[];
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    return SuPage(
      title: inc.valueOrNull?.sousCategorie ?? d.incidents.titre,
      subtitle: inc.valueOrNull == null ? null : d.enums.categorieIncident[inc.valueOrNull!.categorie],
      onRefresh: () async {
        ref.invalidate(incidentProvider(id));
        ref.invalidate(incidentPhotosProvider(id));
      },
      children: [
        AsyncView(inc, onRetry: () => ref.invalidate(incidentProvider(id)), data: (i) {
          final prest = prestataires.where((p) => p.id == i.assigneAId).firstOrNull;
          final logs = [...i.journal]..sort((a, b) => b.horodatage.compareTo(a.horodatage));
          final peutChanger = ctx.isGestion || ctx.isGardien || (ctx.isPrestataire && i.assigneAId != null);
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SuCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(spacing: 6, runSpacing: 6, children: [
                      StatusBadge(d.enums.statutIncident[i.statut] ?? i.statut, variant: incidentVariant[i.statut] ?? BadgeVariant.neutral),
                      StatusBadge(d.enums.urgence[i.urgence] ?? i.urgence, variant: urgenceVariant[i.urgence] ?? BadgeVariant.neutral),
                      StatusBadge(d.enums.partie[i.partie] ?? i.partie, variant: BadgeVariant.outline),
                      if (i.lotId != null) StatusBadge('${d.invitations.lot} ${lots.where((x) => x.id == i.lotId).map((x) => x.numero).firstOrNull ?? ''}', variant: BadgeVariant.neutral),
                    ]),
                    const SizedBox(height: 12),
                    if (i.slaDeadline != null)
                      Row(children: [
                        Icon(Icons.timer_outlined, size: 18, color: i.slaDepasse ? SuColors.danger : SuColors.soft),
                        const SizedBox(width: 6),
                        Expanded(child: Text('${d.incidents.sla} · ${formatDateHeure(i.slaDeadline, l)}', style: t.bodySmall?.copyWith(color: i.slaDepasse ? SuColors.danger : null, fontWeight: i.slaDepasse ? FontWeight.w700 : null))),
                        if (i.slaDepasse) ...[const SizedBox(width: 8), StatusBadge(d.incidents.slaDepasse, variant: BadgeVariant.danger, small: true, pulse: true)],
                      ]),
                    if (i.description != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(i.description!, style: t.bodyMedium?.copyWith(color: SuColors.ink))),
                    const SizedBox(height: 10),
                    Text('${d.incidents.creePar} ${nomComplet(i.createur?.prenom, i.createur?.nom) ?? '—'} · ${formatDateHeure(i.creeLe, l)}', style: t.labelSmall),
                    if (i.createur?.telephone != null && (ctx.isGestion || ctx.isPrestataire || ctx.isGardien)) TextButton.icon(style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 36)), onPressed: () => launchUrl(Uri.parse('tel:${i.createur!.telephone}')), icon: const Icon(Icons.call_rounded, size: 16), label: Text(formatTelephone(i.createur!.telephone))),
                  ],
                ),
              ),
              if ((photos.valueOrNull ?? const []).isNotEmpty) ...[
                SectionHeader(d.incidents.photos),
                SizedBox(
                  height: 120,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: photos.valueOrNull!.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, k) => GestureDetector(
                      onTap: () => showDialog<void>(context: context, builder: (_) => Dialog(backgroundColor: Colors.black, insetPadding: const EdgeInsets.all(8), child: InteractiveViewer(child: Image.network(photos.valueOrNull![k].url)))),
                      child: ClipRRect(borderRadius: BorderRadius.circular(14), child: Image.network(photos.valueOrNull![k].url, width: 150, height: 120, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(width: 150, color: SuColors.ground))),
                    ),
                  ),
                ),
              ],
              SectionHeader(d.incidents.assigneA),
              SuCard(
                child: Row(
                  children: [
                    IconCircle(Icons.engineering_rounded, tone: prest == null ? Tone.neutral : Tone.tosca, size: 40),
                    const SizedBox(width: 12),
                    Expanded(child: prest == null ? Text(d.incidents.nonAssigne, style: t.bodySmall) : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(prest.nom, style: t.titleSmall), Text('${prest.specialite} · ${prest.contact}', style: t.bodySmall)])),
                    if (prest != null && RegExp(r'^\+?\d{8,}$').hasMatch(prest.contact.replaceAll(' ', ''))) IconButton(onPressed: () => launchUrl(Uri.parse('tel:${prest.contact.replaceAll(' ', '')}')), icon: const Icon(Icons.call_rounded, color: SuColors.action)),
                    if (ctx.isGestion && i.ouvert) TextButton(onPressed: () => _assigner(context, ref, i, prestataires), child: Text(d.incidents.assigner)),
                  ],
                ),
              ),
              if (peutChanger && i.statut != 'FERME') ...[
                const SizedBox(height: 12),
                FilledButton.icon(onPressed: () => _changerStatut(context, ref, i), icon: const Icon(Icons.swap_vert_rounded), label: Text(d.incidents.changerStatut)),
              ],
              SectionHeader(d.incidents.journal),
              if (logs.isEmpty)
                SuCard(child: Text(d.incidents.journalVide, style: t.bodySmall))
              else
                SuCard(
                  child: Column(
                    children: [
                      for (int k = 0; k < logs.length; k++)
                        _TimelineItem(
                          log: logs[k],
                          last: k == logs.length - 1,
                          title: logs[k].statutAvant == null ? d.incidents.signale : '${d.incidents.statut} → ${d.enums.statutIncident[logs[k].statutApres] ?? logs[k].statutApres}',
                          who: '${nomComplet(logs[k].acteur?.prenom, logs[k].acteur?.nom) ?? '—'} · ${formatDateHeure(logs[k].horodatage, l)}',
                        ),
                    ],
                  ),
                ),
              const SizedBox(height: 6),
              Text(d.incidents.journal, style: t.labelSmall, textAlign: TextAlign.center),
            ],
          );
        }),
      ],
    );
  }

  Future<void> _changerStatut(BuildContext context, WidgetRef ref, Incident i) async {
    await showFormSheet<void>(context, title: context.dict.incidents.changerStatut, builder: (_) => _StatutForm(incident: i));
  }

  Future<void> _assigner(BuildContext context, WidgetRef ref, Incident i, List<Prestataire> prestataires) async {
    final d = context.dict;
    final actifs = prestataires.where((p) => p.actif).toList();
    if (actifs.isEmpty) {
      showToast(context, d.incidents.aucunPrestataire, error: true);
      return;
    }
    final picked = await showModalBottomSheet<Prestataire>(
      context: context,
      builder: (sheet) => SafeArea(child: ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(8, 0, 8, 12), children: [Padding(padding: const EdgeInsets.all(12), child: Text(d.incidents.assignerAide, style: Theme.of(context).textTheme.bodySmall)), for (final p in actifs) ListTile(leading: const IconCircle(Icons.engineering_rounded, tone: Tone.tosca, size: 36), title: Text(p.nom), subtitle: Text(p.specialite), onTap: () => Navigator.pop(sheet, p))])),
    );
    if (picked == null || !context.mounted) return;
    final r = await ref.read(apiClientProvider).post<dynamic>('/incidents/${i.id}/assign', body: {'prestataire_id': picked.id});
    if (!context.mounted) return;
    if (r is ApiFail) {
      showToast(context, r.error.message, error: true);
    } else {
      ref.invalidate(incidentProvider(i.id));
      ref.invalidate(incidentsProvider);
      showToast(context, d.common.updated);
    }
  }
}

class _TimelineItem extends StatelessWidget {
  const _TimelineItem({required this.log, required this.last, required this.title, required this.who});
  final IncidentLog log;
  final bool last;
  final String title, who;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Column(children: [Container(width: 12, height: 12, margin: const EdgeInsets.only(top: 4), decoration: BoxDecoration(color: incidentColor(log.statutApres), shape: BoxShape.circle)), if (!last) Expanded(child: Container(width: 2, color: SuColors.hairline))]),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: last ? 0 : 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: t.titleSmall), if (log.commentaire != null) Text(log.commentaire!, style: t.bodyMedium), Text(who, style: t.labelSmall)]),
            ),
          ),
        ],
      ),
    );
  }
}

Color incidentColor(String statut) => switch (statut) {
      'OUVERT' => SuColors.danger,
      'EN_COURS' => SuColors.warn,
      'RESOLU' => SuColors.ok,
      _ => SuColors.faint,
    };

class _StatutForm extends ConsumerStatefulWidget {
  const _StatutForm({required this.incident});
  final Incident incident;
  @override
  ConsumerState<_StatutForm> createState() => _StatutFormState();
}

class _StatutFormState extends ConsumerState<_StatutForm> {
  late String _statut = switch (widget.incident.statut) { 'OUVERT' => 'EN_COURS', 'EN_COURS' => 'RESOLU', _ => 'FERME' };
  final _commentaire = TextEditingController();
  bool _loading = false;
  ApiFail? _fail;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SuSelect<String>(label: d.incidents.statut, value: _statut, options: const ['OUVERT', 'EN_COURS', 'RESOLU', 'FERME'], labelOf: (v) => d.enums.statutIncident[v] ?? v, onChanged: (v) => setState(() => _statut = v)),
        const SizedBox(height: 12),
        SuField(label: d.incidents.commentaire, controller: _commentaire, hint: d.incidents.commentaireHint, maxLines: 3, error: fieldError(_fail, 'commentaire')),
        const SizedBox(height: 16),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: d.common.save,
          loading: _loading,
          onPressed: () async {
            setState(() {
              _loading = true;
              _fail = null;
            });
            final r = await ref.read(apiClientProvider).patch<dynamic>('/incidents/${widget.incident.id}/statut', body: {'statut': _statut, 'commentaire': _commentaire.text.trim().isEmpty ? null : _commentaire.text.trim()});
            if (!mounted) return;
            if (r is ApiFail) {
              setState(() {
                _loading = false;
                _fail = r;
              });
              return;
            }
            ref.invalidate(incidentProvider(widget.incident.id));
            ref.invalidate(incidentsProvider);
            Navigator.pop(context);
            showToast(context, d.incidents.statutChange);
          },
        ),
      ],
    );
  }
}

// ── F4 Prestataires ───────────────────────────────────────────────────────────
class PrestatairesScreen extends ConsumerWidget {
  const PrestatairesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final list = ref.watch(prestatairesProvider);
    return SuPage(
      title: d.incidents.prestataires,
      subtitle: d.incidents.prestatairesSubtitle,
      onRefresh: () async => ref.invalidate(prestatairesProvider),
      fab: ctx.isGestion ? FloatingActionButton.extended(onPressed: () => showFormSheet<void>(context, title: d.incidents.nouveauPrestataire, builder: (_) => const _PrestataireForm()), backgroundColor: SuColors.ink, foregroundColor: Colors.white, icon: const Icon(Icons.add_rounded), label: Text(d.incidents.nouveauPrestataire)) : null,
      children: [
        AsyncView(list, onRetry: () => ref.invalidate(prestatairesProvider), data: (ps) {
          if (ps.isEmpty) return EmptyState(title: d.incidents.aucunPrestataire, hint: ctx.isGestion ? d.incidents.aucunPrestataireAide : null, icon: Icons.engineering_rounded);
          return CardList([
            for (final p in ps)
              ListRow(
                leading: IconCircle(Icons.engineering_rounded, tone: p.actif ? Tone.tosca : Tone.neutral, size: 40),
                title: p.nom,
                subtitle: '${p.specialite} · ${p.contact}',
                trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                  StatusBadge(p.actif ? d.incidents.actif : d.incidents.inactif, variant: p.actif ? BadgeVariant.ok : BadgeVariant.outline, small: true),
                  if (ctx.isGestion) IconButton(icon: const Icon(Icons.power_settings_new_rounded, color: SuColors.faint), onPressed: () async {
                    final r = await ref.read(apiClientProvider).patch<dynamic>('/prestataires/${p.id}', body: {'actif': !p.actif});
                    if (!context.mounted) return;
                    if (r is ApiFail) showToast(context, r.error.message, error: true); else ref.invalidate(prestatairesProvider);
                  }),
                ]),
              ),
          ]);
        }),
      ],
    );
  }
}

class _PrestataireForm extends ConsumerStatefulWidget {
  const _PrestataireForm();
  @override
  ConsumerState<_PrestataireForm> createState() => _PrestataireFormState();
}

class _PrestataireFormState extends ConsumerState<_PrestataireForm> {
  final _nom = TextEditingController(), _spec = TextEditingController(), _contact = TextEditingController(), _user = TextEditingController();
  bool _loading = false;
  ApiFail? _fail;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SuField(label: d.incidents.nom, controller: _nom, required: true, error: fieldError(_fail, 'nom')),
        const SizedBox(height: 12),
        SuField(label: d.incidents.specialite, controller: _spec, required: true, error: fieldError(_fail, 'specialite')),
        const SizedBox(height: 12),
        SuField(label: d.incidents.contact, controller: _contact, required: true, keyboardType: TextInputType.phone, textDirection: TextDirection.ltr, error: fieldError(_fail, 'contact')),
        const SizedBox(height: 12),
        SuField(label: d.lots.utilisateur, controller: _user, help: d.lots.utilisateurIdAide, optionalLabel: d.common.optional, mono: true, textDirection: TextDirection.ltr, error: fieldError(_fail, 'utilisateur_id')),
        const SizedBox(height: 16),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: d.common.create,
          loading: _loading,
          onPressed: () async {
            setState(() {
              _loading = true;
              _fail = null;
            });
            final r = await ref.read(apiClientProvider).post<dynamic>('/prestataires', body: {'nom': _nom.text.trim(), 'specialite': _spec.text.trim(), 'contact': _contact.text.trim(), 'utilisateur_id': _user.text.trim().isEmpty ? null : _user.text.trim()});
            if (!mounted) return;
            if (r is ApiFail) {
              setState(() {
                _loading = false;
                _fail = r;
              });
              return;
            }
            ref.invalidate(prestatairesProvider);
            Navigator.pop(context);
          },
        ),
      ],
    );
  }
}
