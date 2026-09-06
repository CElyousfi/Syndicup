import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
import '../../offline/sync_queue/presence_sync.dart';
import '../documents/document_viewer_screen.dart';

const _jours = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
String _libelleJour(BuildContext context, String j) {
  final e = context.dict.enumsPersonnelRh.jour;
  return switch (j) { 'lun' => e.lun, 'mar' => e.mar, 'mer' => e.mer, 'jeu' => e.jeu, 'ven' => e.ven, 'sam' => e.sam, _ => e.dim };
}
String _periodeCourante() => jourIso(DateTime.now()).substring(0, 7);
String _decalerMois(String periode, int delta) {
  final a = int.parse(periode.substring(0, 4));
  final m = int.parse(periode.substring(5, 7));
  return jourIso(DateTime(a, m + delta, 1)).substring(0, 7);
}

/// « Mon dossier » (gardien / employé) — résout la fiche propre puis affiche le dossier RH.
class MonDossierScreen extends ConsumerWidget {
  const MonDossierScreen({super.key, this.onglet});
  final String? onglet;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final list = ref.watch(personnelProvider);
    return list.when(
      loading: () => Scaffold(appBar: AppBar(title: Text(d.personnel.monDossier)), body: const Padding(padding: EdgeInsets.all(16), child: LoadingList())),
      error: (e, _) => Scaffold(appBar: AppBar(title: Text(d.personnel.monDossier)), body: Padding(padding: const EdgeInsets.all(16), child: ErrorState(error: e, onRetry: () => ref.invalidate(personnelProvider)))),
      data: (ps) {
        final mienne = ps.where((p) => p.utilisateurId == ctx.profil.id).firstOrNull;
        if (mienne == null) return Scaffold(appBar: AppBar(title: Text(d.personnel.monDossier)), body: EmptyState(title: d.personnel.aucuneFiche, icon: Icons.badge_outlined));
        return PersonnelDetailScreen(id: mienne.id, onglet: onglet);
      },
    );
  }
}

/// Dossier RH d'un employé (M20) — fiche / paie / congés / présences ; syndic complet, employé sur
/// son propre dossier, conseil : fiche publique seulement (les évaluations restent web-first).
class PersonnelDetailScreen extends ConsumerStatefulWidget {
  const PersonnelDetailScreen({super.key, required this.id, this.onglet});
  final String id;
  final String? onglet;
  @override
  ConsumerState<PersonnelDetailScreen> createState() => _PersonnelDetailScreenState();
}

class _PersonnelDetailScreenState extends ConsumerState<PersonnelDetailScreen> with TickerProviderStateMixin {
  TabController? _tabs;
  int _nb = 0;

  TabController _controller(int nb, int initial) {
    if (_tabs == null || _nb != nb) {
      _tabs?.dispose();
      _tabs = TabController(length: nb, vsync: this, initialIndex: initial.clamp(0, nb - 1));
      _nb = nb;
    }
    return _tabs!;
  }

  @override
  void dispose() {
    _tabs?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final detail = ref.watch(personnelDetailProvider(widget.id));
    final x = detail.valueOrNull;
    final soi = x != null && x.fiche.utilisateurId == ctx.profil.id;
    final complet = ctx.isGestion || soi;
    final onglets = complet ? const ['fiche', 'paie', 'conges', 'presences'] : const ['fiche', 'presences'];
    final initial = onglets.indexOf(widget.onglet ?? 'fiche');
    final tabs = _controller(onglets.length, initial < 0 ? 0 : initial);
    String libelle(String o) => switch (o) { 'paie' => d.personnel.onglets.paie, 'conges' => d.personnel.onglets.conges, 'presences' => d.personnel.onglets.presences, _ => d.personnel.onglets.fiche };
    final titre = x == null ? d.personnel.dossier : (soi && !ctx.isGestion ? d.personnel.monDossier : x.fiche.nomAffiche(d.enumsPersonnelRh.poste[x.fiche.poste] ?? x.fiche.poste));
    return Scaffold(
      appBar: AppBar(
        title: Text(titre),
        actions: [if (ctx.isGestion || ctx.isConseil) IconButton(tooltip: d.personnel.planning, icon: const Icon(Icons.calendar_view_week_rounded), onPressed: () => context.push('/personnel/planning'))],
        bottom: TabBar(controller: tabs, isScrollable: true, tabAlignment: TabAlignment.start, tabs: [for (final o in onglets) Tab(text: libelle(o))]),
      ),
      body: AsyncView(
        detail,
        onRetry: () => ref.invalidate(personnelDetailProvider(widget.id)),
        loading: const Padding(padding: EdgeInsets.all(16), child: LoadingList()),
        data: (x) => TabBarView(
          controller: tabs,
          children: [
            for (final o in onglets)
              switch (o) {
                'paie' => _PaieTab(detail: x, gestion: ctx.isGestion),
                'conges' => _CongesTab(detail: x, gestion: ctx.isGestion, soi: soi),
                'presences' => _PresencesTab(detail: x, gestion: ctx.isGestion, soi: soi),
                _ => _FicheTab(detail: x, complet: complet, gestion: ctx.isGestion),
              },
          ],
        ),
      ),
    );
  }
}

class _FicheTab extends ConsumerWidget {
  const _FicheTab({required this.detail, required this.complet, required this.gestion});
  final PersonnelDetail detail;
  final bool complet, gestion;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final l = context.locale;
    final e = d.enumsPersonnelRh;
    final p = detail.fiche;
    final nom = p.nomAffiche(e.poste[p.poste] ?? p.poste);
    final solde = detail.soldeConges;
    final pm = detail.presencesMois;
    int? joursFin;
    if (p.dateFinContrat != null) joursFin = DateTime.parse(p.dateFinContrat!).difference(DateTime.now()).inDays + 1;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        Row(children: [
          Avatar(nom, size: 48),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(nom, style: Theme.of(context).textTheme.titleMedium),
            Text('${e.poste[p.poste] ?? p.poste}${p.typeContrat != null && complet ? ' · ${e.typeContratTravail[p.typeContrat!] ?? p.typeContrat}' : ''}', style: Theme.of(context).textTheme.bodySmall),
          ])),
          StatusBadge(d.enums.statutPersonnel[p.statut] ?? p.statut, variant: personnelVariant[p.statut] ?? BadgeVariant.neutral, pulse: p.statut == 'ABSENT'),
        ]),
        if (complet && joursFin != null && joursFin >= 0 && joursFin <= 30) Padding(padding: const EdgeInsets.only(top: 12), child: SuBanner(tone: BannerTone.warn, body: fill(d.personnel.finContratProche, {'n': '$joursFin'}))),
        SectionHeader(d.personnel.dossier),
        SuCard(child: Column(children: [
          KeyValueRow(d.personnel.logement, p.logementLotNumero ?? d.personnel.aucuneLoge),
          if (p.utilisateur?.telephone != null) KeyValueRow(d.depenses.telephone, formatTelephone(p.utilisateur!.telephone), mono: true),
          if (complet) ...[
            KeyValueRow(d.personnel.dateEmbauche, p.dateEmbauche == null ? '—' : formatJourAnnee(p.dateEmbauche, l)),
            KeyValueRow(d.personnel.dateFinContrat, p.dateFinContrat == null ? '—' : formatJourAnnee(p.dateFinContrat, l)),
            KeyValueRow(d.personnel.salaireBrut, p.salaireBrutMensuel == null ? '—' : formatMAD(p.salaireBrutMensuel, l)),
            KeyValueRow(d.personnel.cnss, p.numeroCnssMasque ?? d.personnel.cnssNonRenseigne, mono: true),
            KeyValueRow(d.personnel.contactUrgence, p.contactUrgence ?? '—'),
          ],
        ])),
        if (complet && (p.notes?.isNotEmpty ?? false)) Padding(padding: const EdgeInsets.only(top: 10), child: SuCard(color: SuColors.canvas, child: Text(p.notes!, style: Theme.of(context).textTheme.bodyMedium))),
        SectionHeader(d.personnel.horaires),
        SuCard(child: Column(children: [
          for (final j in _jours)
            KeyValueRow(
              _libelleJour(context, j),
              ((p.horaires?[j] as List?) ?? const []).isEmpty ? d.personnel.aucunePlage : ((p.horaires![j] as List).map((pl) => '${(pl as Map)['debut']}–${pl['fin']}').join(' · ')),
              mono: true,
            ),
        ])),
        if (complet && solde != null) ...[
          SectionHeader('${d.personnel.soldeConges} ${solde['annee'] ?? ''}'),
          TwoCols([
            StatTile(label: d.personnel.acquis, value: '${solde['acquis'] ?? '—'}', icon: Icons.beach_access_rounded, tone: Tone.sage),
            StatTile(label: d.personnel.solde, value: '${solde['solde'] ?? '—'}', icon: Icons.event_available_rounded, tone: Tone.ok, hint: '${d.personnel.pris} ${solde['pris'] ?? '0'}'),
          ]),
          if (solde['parametres_non_configures'] == true) Padding(padding: const EdgeInsets.only(top: 8), child: Text(d.personnel.soldeNonConfigure, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: SuColors.warn))),
        ],
        if (complet && pm != null) ...[
          SectionHeader('${d.personnel.presences} · ${formatPeriode('${pm['periode']}', l)}'),
          TwoCols([
            StatTile(label: d.personnel.presents, value: '${pm['presents'] ?? 0}', icon: Icons.check_circle_outline_rounded, tone: Tone.ok),
            StatTile(label: d.personnel.absents, value: '${pm['absents'] ?? 0}', icon: Icons.cancel_outlined, tone: Tone.danger),
          ]),
        ],
        if (complet && gestion && p.documentContrat != null) ...[
          SectionHeader(d.personnel.contratTravail),
          CardList([
            ListRow(
              leading: const IconCircle(Icons.description_outlined, tone: Tone.ink, size: 40),
              title: '${p.documentContrat!['nom'] ?? d.personnel.contratTravail}',
              chevron: true,
              onTap: () => ouvrirFichierApi(context, ref, endpoint: '/documents/${p.documentContrat!['id']}/download-url', titre: '${p.documentContrat!['nom'] ?? ''}'),
            ),
          ]),
        ],
      ],
    );
  }
}

class _PaieTab extends ConsumerWidget {
  const _PaieTab({required this.detail, required this.gestion});
  final PersonnelDetail detail;
  final bool gestion;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final l = context.locale;
    final langue = context.locale.isAr ? 'ar' : 'fr';
    final fiches = ref.watch(fichesPaieProvider(detail.fiche.id));
    final nonConfigure = gestion && detail.paie != null && detail.paie!['parametres_configures'] == false;
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(fichesPaieProvider(detail.fiche.id)),
      color: SuColors.action,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          if (nonConfigure) Padding(padding: const EdgeInsets.only(bottom: 12), child: SuBanner(tone: BannerTone.warn, title: d.personnel.paieNonConfiguree, body: d.personnel.paieNonConfigureeCorps)),
          AsyncView(fiches, onRetry: () => ref.invalidate(fichesPaieProvider(detail.fiche.id)), data: (fs) {
            if (fs.isEmpty) return EmptyState(title: d.personnel.aucuneFichePaie, icon: Icons.receipt_long_outlined);
            return CardList([
              for (final f in fs)
                ListRow(
                  leading: IconCircle(Icons.receipt_long_outlined, tone: f.statut == 'PAYEE' ? Tone.ok : (f.statut == 'VALIDEE' ? Tone.action : Tone.neutral), size: 40),
                  title: formatPeriode(f.periode, l),
                  subtitle: '${d.personnel.net} ${formatMAD(f.net, l)} · ${d.personnel.brut} ${formatMAD(f.brut, l)}',
                  trailing: StatusBadge(d.enumsPersonnelRh.statutFichePaie[f.statut] ?? f.statut, variant: fichePaieVariant[f.statut] ?? BadgeVariant.neutral, small: true),
                  chevron: true,
                  onTap: () => ouvrirPdfApi(context, ref, endpoint: '/personnel/${f.personnelId}/fiches-paie/${f.id}/pdf', query: {'langue': langue}, titre: '${d.personnel.fichePaie} ${f.periode}'),
                ),
            ]);
          }),
          Padding(padding: const EdgeInsets.only(top: 12), child: Text(d.personnel.mentionPaie, style: Theme.of(context).textTheme.bodySmall)),
        ],
      ),
    );
  }
}

class _CongesTab extends ConsumerWidget {
  const _CongesTab({required this.detail, required this.gestion, required this.soi});
  final PersonnelDetail detail;
  final bool gestion, soi;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final l = context.locale;
    final e = d.enumsPersonnelRh;
    final id = detail.fiche.id;
    final conges = ref.watch(congesProvider(id));
    final solde = detail.soldeConges;
    void rafraichir() {
      ref.invalidate(congesProvider(id));
      ref.invalidate(personnelDetailProvider(id));
      ref.invalidate(congesEnAttenteProvider);
    }
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: (gestion || soi) && detail.fiche.statut != 'PARTI'
          ? FloatingActionButton.extended(
              onPressed: () => showFormSheet<void>(context, title: d.personnel.demanderCongeTitre, builder: (_) => _CongeForm(personnelId: id, onDone: rafraichir)),
              backgroundColor: SuColors.ink,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add_rounded),
              label: Text(d.personnel.demanderConge),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () async => rafraichir(),
        color: SuColors.action,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
          children: [
            if (solde != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text('${d.personnel.soldeConges} ${solde['annee'] ?? ''} : ${d.personnel.acquis} ${solde['acquis'] ?? '—'} · ${d.personnel.pris} ${solde['pris'] ?? '0'} · ${d.personnel.solde} ${solde['solde'] ?? '—'}', style: Theme.of(context).textTheme.bodySmall)),
            AsyncView(conges, onRetry: rafraichir, data: (cs) {
              if (cs.isEmpty) return EmptyState(title: d.personnel.aucunConge, icon: Icons.beach_access_outlined);
              return CardList([
                for (final c in cs)
                  _CongeRow(conge: c, gestion: gestion, soi: soi, onDone: rafraichir, sousTitre: '${formatJourAnnee(c.dateDebut, l)} → ${formatJourAnnee(c.dateFin, l)} · ${c.nbJours} ${d.personnel.nbJours.toLowerCase()}${c.remplacantNom != null ? ' · ${d.personnel.remplacant} ${c.remplacantNom}' : ''}${c.motifRefus != null ? '\n${d.personnel.motifRefus} : ${c.motifRefus}' : ''}', titre: '${e.typeConge[c.type] ?? c.type}${c.motif != null ? ' · ${c.motif}' : ''}'),
              ]);
            }),
          ],
        ),
      ),
    );
  }
}

class _CongeRow extends ConsumerStatefulWidget {
  const _CongeRow({required this.conge, required this.gestion, required this.soi, required this.onDone, required this.titre, required this.sousTitre});
  final Conge conge;
  final bool gestion, soi;
  final VoidCallback onDone;
  final String titre, sousTitre;
  @override
  ConsumerState<_CongeRow> createState() => _CongeRowState();
}

class _CongeRowState extends ConsumerState<_CongeRow> {
  bool _busy = false;

  Future<void> _decider(String action, {String? motif}) async {
    setState(() => _busy = true);
    final r = await ref.read(apiClientProvider).post<dynamic>('/personnel/conges/${widget.conge.id}/$action', body: motif == null ? {} : {'motif_refus': motif}, idempotent: true);
    if (!mounted) return;
    setState(() => _busy = false);
    if (r is ApiFail) {
      showToast(context, r.error.message, error: true);
      return;
    }
    final d = context.dict;
    showToast(context, action == 'approuver' ? d.personnel.congeApprouve : (action == 'refuser' ? d.personnel.congeRefuse : d.personnel.congeAnnule));
    widget.onDone();
  }

  Future<void> _refuser() async {
    final d = context.dict;
    final ctrl = TextEditingController();
    final ok = await showFormSheet<bool>(
      context,
      title: d.personnel.refuserCongeTitre,
      builder: (ctx) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SuField(label: d.personnel.motifRefus, controller: ctrl, maxLines: 3, required: true),
        const SizedBox(height: 16),
        SubmitButton(label: d.personnel.refuserConge, danger: true, onPressed: () => Navigator.pop(ctx, ctrl.text.trim().isNotEmpty)),
      ]),
    );
    if (ok == true) await _decider('refuser', motif: ctrl.text.trim());
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final c = widget.conge;
    final enAttente = c.statut == 'DEMANDE';
    Widget? trailing;
    if (_busy) {
      trailing = const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2));
    } else if (enAttente && widget.gestion) {
      trailing = Row(mainAxisSize: MainAxisSize.min, children: [
        IconButton(tooltip: d.personnel.approuverConge, icon: const Icon(Icons.check_circle_rounded, color: SuColors.ok), onPressed: () async {
          if (await confirmDialog(context, title: d.personnel.approuverConge, body: widget.sousTitre, confirmLabel: d.personnel.approuverConge)) await _decider('approuver');
        }),
        IconButton(tooltip: d.personnel.refuserConge, icon: const Icon(Icons.cancel_rounded, color: SuColors.danger), onPressed: _refuser),
      ]);
    } else if (enAttente && widget.soi) {
      trailing = TextButton(onPressed: () async {
        if (await confirmDialog(context, title: d.personnel.annulerConge, body: widget.sousTitre, danger: true)) await _decider('annuler');
      }, child: Text(d.personnel.annulerConge));
    } else {
      trailing = StatusBadge(d.enumsPersonnelRh.statutConge[c.statut] ?? c.statut, variant: congeVariant[c.statut] ?? BadgeVariant.neutral, small: true);
    }
    return ListRow(
      leading: IconCircle(c.type == 'MALADIE' ? Icons.medical_services_outlined : Icons.beach_access_outlined, tone: enAttente ? Tone.warn : Tone.sage, size: 40),
      title: widget.titre,
      subtitle: widget.sousTitre,
      trailing: trailing,
    );
  }
}

class _CongeForm extends ConsumerStatefulWidget {
  const _CongeForm({required this.personnelId, required this.onDone});
  final String personnelId;
  final VoidCallback onDone;
  @override
  ConsumerState<_CongeForm> createState() => _CongeFormState();
}

class _CongeFormState extends ConsumerState<_CongeForm> {
  String _type = 'ANNUEL';
  DateTime? _debut, _fin;
  final _motif = TextEditingController();
  bool _loading = false;
  ApiFail? _fail;

  Future<void> _pick(bool debut) async {
    final now = DateTime.now();
    final r = await showDatePicker(context: context, initialDate: (debut ? _debut : _fin) ?? _debut ?? now, firstDate: DateTime(now.year - 1), lastDate: DateTime(now.year + 1, 12, 31), locale: context.locale);
    if (r == null || !mounted) return;
    setState(() {
      if (debut) {
        _debut = r;
        if (_fin == null || _fin!.isBefore(r)) _fin = r;
      } else {
        _fin = r;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final l = context.locale;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(d.personnel.demanderCongeAide, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 12),
        SuSelect<String>(label: d.personnel.typeConge, value: _type, options: const ['ANNUEL', 'MALADIE', 'SANS_SOLDE', 'EXCEPTIONNEL'], labelOf: (v) => d.enumsPersonnelRh.typeConge[v] ?? v, onChanged: (v) => setState(() => _type = v)),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: _DateField(label: d.personnel.dateDebut, value: _debut == null ? null : formatJourAnnee(jourIso(_debut!), l), onTap: () => _pick(true), error: fieldError(_fail, 'date_debut'))),
          const SizedBox(width: 10),
          Expanded(child: _DateField(label: d.personnel.dateFin, value: _fin == null ? null : formatJourAnnee(jourIso(_fin!), l), onTap: () => _pick(false), error: fieldError(_fail, 'date_fin'))),
        ]),
        const SizedBox(height: 12),
        SuField(label: d.personnel.motif, controller: _motif, maxLines: 2, optionalLabel: d.common.optional),
        const SizedBox(height: 16),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: d.personnel.demanderConge,
          loading: _loading,
          onPressed: _debut == null || _fin == null
              ? null
              : () async {
                  setState(() {
                    _loading = true;
                    _fail = null;
                  });
                  final r = await ref.read(apiClientProvider).post<dynamic>('/personnel/${widget.personnelId}/conges', idempotent: true, body: {'type': _type, 'date_debut': jourIso(_debut!), 'date_fin': jourIso(_fin!), if (_motif.text.trim().isNotEmpty) 'motif': _motif.text.trim()});
                  if (!mounted) return;
                  if (r is ApiFail) {
                    setState(() {
                      _loading = false;
                      _fail = r;
                    });
                    return;
                  }
                  widget.onDone();
                  if (!context.mounted) return;
                  Navigator.pop(context);
                  showToast(context, d.personnel.congeDemande);
                },
        ),
      ],
    );
  }
}

class _DateField extends StatelessWidget {
  const _DateField({required this.label, required this.value, required this.onTap, this.error});
  final String label;
  final String? value;
  final VoidCallback onTap;
  final String? error;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: t.labelLarge),
      const SizedBox(height: 6),
      InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(SuRadius.field),
        child: Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(border: Border.all(color: error != null ? SuColors.danger : SuColors.hairlineStrong), borderRadius: BorderRadius.circular(SuRadius.field), color: SuColors.surface),
          alignment: AlignmentDirectional.centerStart,
          child: Row(children: [
            Expanded(child: Text(value ?? '—', style: t.bodyMedium?.copyWith(color: value == null ? SuColors.soft : SuColors.ink))),
            const Icon(Icons.calendar_today_outlined, size: 18, color: SuColors.soft),
          ]),
        ),
      ),
      if (error != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(error!, style: t.bodySmall?.copyWith(color: SuColors.danger))),
    ]);
  }
}

class _PresencesTab extends ConsumerStatefulWidget {
  const _PresencesTab({required this.detail, required this.gestion, required this.soi});
  final PersonnelDetail detail;
  final bool gestion, soi;
  @override
  ConsumerState<_PresencesTab> createState() => _PresencesTabState();
}

class _PresencesTabState extends ConsumerState<_PresencesTab> {
  String _periode = _periodeCourante();
  bool _pointage = false;

  Future<void> _pointer() async {
    final d = context.dict;
    setState(() => _pointage = true);
    final r = await ref.read(presenceSyncProvider.notifier).pointer();
    if (!mounted) return;
    setState(() => _pointage = false);
    if (r.refus != null) {
      showToast(context, r.refus!.error.message, error: true);
      return;
    }
    showToast(context, r.enFile ? context.mdict.pendingSend : d.personnel.pointe);
    ref.invalidate(presencesProvider('${widget.detail.fiche.id}|$_periode'));
    ref.invalidate(personnelDetailProvider(widget.detail.fiche.id));
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final l = context.locale;
    final e = d.enumsPersonnelRh;
    final cle = '${widget.detail.fiche.id}|$_periode';
    final presences = ref.watch(presencesProvider(cle));
    final file = widget.soi ? (ref.watch(presencesQueueProvider).valueOrNull ?? const <PresencesQueueData>[]) : const <PresencesQueueData>[];
    final aujourdhui = jourIso(DateTime.now());
    final a = int.parse(_periode.substring(0, 4));
    final m = int.parse(_periode.substring(5, 7));
    final nbJours = DateTime(a, m + 1, 0).day;
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(presencesProvider(cle)),
      color: SuColors.action,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          if (widget.soi && widget.detail.fiche.statut != 'PARTI')
            AsyncView(presences, onRetry: () => ref.invalidate(presencesProvider(cle)), loading: const SizedBox.shrink(), data: (ps) {
              final pointe = ps.any((p) => p.date == aujourdhui) || file.any((q) => q.date == aujourdhui && !q.definitif);
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: pointe ? SuBanner(tone: BannerTone.ok, body: d.personnel.pointe) : SubmitButton(label: d.personnel.pointer, icon: Icons.how_to_reg_rounded, loading: _pointage, onPressed: _pointer),
              );
            }),
          if (file.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: SuBanner(tone: BannerTone.info, body: '${context.mdict.pendingSend} (${file.length})', action: TextButton(onPressed: () => ref.read(presenceSyncProvider.notifier).flush(), child: Text(d.common.retry))),
            ),
          Row(children: [
            IconButton(tooltip: d.personnel.moisPrecedent, icon: const Icon(Icons.chevron_left_rounded), onPressed: () => setState(() => _periode = _decalerMois(_periode, -1))),
            Expanded(child: Text(formatPeriode(_periode, l), textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium)),
            IconButton(tooltip: d.personnel.moisSuivant, icon: const Icon(Icons.chevron_right_rounded), onPressed: () => setState(() => _periode = _decalerMois(_periode, 1))),
          ]),
          AsyncView(presences, onRetry: () => ref.invalidate(presencesProvider(cle)), data: (ps) {
            final parDate = {for (final p in ps) p.date: p};
            return Column(children: [
              Wrap(spacing: 6, runSpacing: 6, children: [
                for (final s in const ['PRESENT', 'ABSENT', 'CONGE', 'MALADIE'])
                  StatusBadge('${e.statutPresence[s] ?? s} · ${ps.where((p) => p.statut == s).length}', variant: presenceVariant[s] ?? BadgeVariant.neutral, small: true),
              ]),
              const SizedBox(height: 12),
              CardList([
                for (var i = 1; i <= nbJours; i++)
                  Builder(builder: (_) {
                    final iso = '$_periode-${i.toString().padLeft(2, '0')}';
                    final p = parDate[iso];
                    final enFile = file.any((q) => q.date == iso && !q.definitif);
                    return ListRow(
                      title: formatJourAnnee(iso, l),
                      subtitle: p?.commentaire,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      trailing: p != null
                          ? StatusBadge(e.statutPresence[p.statut] ?? p.statut, variant: presenceVariant[p.statut] ?? BadgeVariant.neutral, small: true)
                          : (enFile ? const Icon(Icons.cloud_upload_outlined, size: 18, color: SuColors.soft) : Text('—', style: TextStyle(color: SuColors.soft))),
                    );
                  }),
              ]),
              if (widget.gestion) Padding(padding: const EdgeInsets.only(top: 12), child: Text(d.personnel.saisirPresencesAide, style: Theme.of(context).textTheme.bodySmall)),
            ]);
          }),
        ],
      ),
    );
  }
}

/// Planning hebdomadaire (M20) — horaires, congés approuvés + remplaçants, présences ; syndic,
/// conseil et employés (leur propre ligne côté API).
class PlanningScreen extends ConsumerStatefulWidget {
  const PlanningScreen({super.key, this.semaine});
  final String? semaine;
  @override
  ConsumerState<PlanningScreen> createState() => _PlanningScreenState();
}

class _PlanningScreenState extends ConsumerState<PlanningScreen> {
  late String? _semaine = widget.semaine;

  String _decaler(String lundi, int jours) => jourIso(DateTime.parse(lundi).add(Duration(days: jours)));

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final l = context.locale;
    final e = d.enumsPersonnelRh;
    final planning = ref.watch(planningProvider(_semaine));
    final x = planning.valueOrNull;
    return SuPage(
      title: d.personnel.planning,
      subtitle: x == null ? d.personnel.planningSubtitle : '${formatJourAnnee(x.jours.first, l)} → ${formatJourAnnee(x.jours.last, l)}',
      onRefresh: () async => ref.invalidate(planningProvider(_semaine)),
      children: [
        Row(children: [
          Expanded(child: OutlinedButton.icon(onPressed: x == null ? null : () => setState(() => _semaine = _decaler(x.semaine, -7)), icon: const Icon(Icons.chevron_left_rounded), label: Text(d.personnel.semainePrecedente, overflow: TextOverflow.ellipsis))),
          const SizedBox(width: 8),
          TextButton(onPressed: () => setState(() => _semaine = null), child: Text(d.common.today)),
          const SizedBox(width: 8),
          Expanded(child: OutlinedButton.icon(onPressed: x == null ? null : () => setState(() => _semaine = _decaler(x.semaine, 7)), icon: const Icon(Icons.chevron_right_rounded), label: Text(d.personnel.semaineSuivante, overflow: TextOverflow.ellipsis))),
        ]),
        const SizedBox(height: 12),
        AsyncView(planning, onRetry: () => ref.invalidate(planningProvider(_semaine)), data: (x) {
          if (x.personnels.isEmpty) return EmptyState(title: d.personnel.aucuneFiche, icon: Icons.calendar_view_week_outlined);
          return Column(children: [
            for (final pp in x.personnels) ...[
              SectionHeader(pp.fiche.nomAffiche(e.poste[pp.fiche.poste] ?? pp.fiche.poste), subtitle: e.poste[pp.fiche.poste] ?? pp.fiche.poste, actionLabel: d.personnel.dossier, onAction: () => context.push('/personnel/${pp.fiche.id}')),
              SuCard(padding: EdgeInsets.zero, child: Column(children: [
                for (var i = 0; i < pp.jours.length; i++)
                  Builder(builder: (_) {
                    final j = pp.jours[i];
                    final conge = j['conge'] as Map?;
                    final presence = j['presence'] as Map?;
                    final plages = (j['plages'] as List?) ?? const [];
                    final texte = conge != null
                        ? '${e.typeConge['${conge['type']}'] ?? conge['type']}${conge['remplacant'] != null ? ' → ${conge['remplacant']}' : ''}'
                        : (plages.isEmpty ? d.personnel.aucunePlage : plages.map((pl) => '${(pl as Map)['debut']}–${pl['fin']}').join(' · '));
                    return ListRow(
                      title: '${_libelleJour(context, _jours[i])} ${formatJourAnnee('${j['date']}', l)}',
                      subtitle: texte,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      trailing: presence != null ? StatusBadge(e.statutPresence['${presence['statut']}'] ?? '${presence['statut']}', variant: presenceVariant['${presence['statut']}'] ?? BadgeVariant.neutral, small: true) : null,
                    );
                  }),
              ])),
            ],
          ]);
        }),
      ],
    );
  }
}
