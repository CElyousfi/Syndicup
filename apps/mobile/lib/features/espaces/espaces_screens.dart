import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
import '../incidents/incidents_screens.dart' show scinderMessage;
import '../shell/app_shell.dart';

IconData _iconEspace(String type) {
  final t = type.toLowerCase();
  if (t.contains('piscine')) return Icons.pool_rounded;
  if (t.contains('terrain') || t.contains('sport')) return Icons.sports_soccer_rounded;
  if (t.contains('terrasse') || t.contains('jardin')) return Icons.deck_rounded;
  if (t.contains('parking')) return Icons.local_parking_rounded;
  return Icons.meeting_room_rounded;
}

// ── G1 Espaces ────────────────────────────────────────────────────────────────
class EspacesScreen extends ConsumerWidget {
  const EspacesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final espaces = ref.watch(espacesProvider);
    final racine = !context.canPop();
    final peutReserver = ctx.isResident && !(ctx.isLocataire && (ctx.copropriete?.reservationProprietairesSeulement ?? false));
    final fab = ctx.isGestion ? FloatingActionButton.extended(onPressed: () => showFormSheet<void>(context, title: d.espaces.nouveau, builder: (_) => const _EspaceForm()), icon: const Icon(Icons.add_rounded), label: Text(d.espaces.nouveau)) : null;
    Future<void> refresh() async => ref.invalidate(espacesProvider);
    final liste = AsyncView(espaces, onRetry: () => ref.invalidate(espacesProvider), skeletonCount: 2, loading: const LoadingList(count: 2, height: 260), data: (list) {
      if (list.isEmpty) return EmptyState(title: d.espaces.aucunEspace, hint: ctx.isGestion ? d.espaces.aucunEspaceAide : null, icon: Icons.deck_rounded, illustration: 'empty-reservations');
      return Column(
        children: [
          for (int k = 0; k < list.length; k++)
            SuEnter(key: ValueKey(list[k].id), index: k, child: _EspaceCard(espace: list[k], peutReserver: peutReserver)),
        ],
      );
    });
    // Ouverte depuis « Plus » : page Wise (grand titre + sous-titre) ; racine d'onglet : en-tête du shell.
    if (!racine) return SuPage(title: d.espaces.titre, subtitle: d.espaces.subtitle, onRefresh: refresh, fab: fab, padding: const EdgeInsets.fromLTRB(16, 0, 16, 96), children: [liste]);
    return Scaffold(
      appBar: ShellHeader(title: d.espaces.titre),
      floatingActionButton: fab,
      body: SuRefresh(
        onRefresh: refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
          children: [
            Text(d.espaces.subtitle, style: t.bodyLarge?.copyWith(color: SuColors.soft)),
            const SizedBox(height: 16),
            liste,
          ],
        ),
      ),
    );
  }
}

/// Carte d'espace Wise : photo pleine largeur aux coins arrondis dans la tuile greige, nom en
/// gras, capacité, statuts, pill « Réserver ».
class _EspaceCard extends StatelessWidget {
  const _EspaceCard({required this.espace, required this.peutReserver});
  final EspaceCommun espace;
  final bool peutReserver;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final e = espace;
    return SuCard(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(8),
      radius: 28,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Photo propre à l'espace si le syndic l'a personnalisée, sinon l'emplacement déduit du nom/type.
          ClipRRect(
            borderRadius: BorderRadius.circular(22),
            child: SizedBox(height: 156, child: CoproPhoto('espace:${e.id}', fallbackCle: espacePhotoCle(e.nom, e.type))),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 14, 10, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    IconCircle(_iconEspace(e.type), tone: Tone.tosca),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(e.nom, style: t.titleLarge, maxLines: 2, overflow: TextOverflow.ellipsis),
                        const SizedBox(height: 2),
                        Text('${e.type}${e.capacite != null ? ' · ${fill(d.espaces.personnes, {'n': e.capacite})}' : ''}', style: t.bodyMedium?.copyWith(fontSize: 14, color: SuColors.soft)),
                      ]),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  StatusBadge(e.reservable ? d.espaces.reservable : d.espaces.nonReservable, variant: e.reservable ? BadgeVariant.ok : BadgeVariant.outline, small: true),
                  if (e.reservable) StatusBadge(e.validationAutomatique ? d.espaces.validationAuto : d.espaces.validationManuelle, variant: e.validationAutomatique ? BadgeVariant.info : BadgeVariant.neutral, small: true),
                ]),
                if (e.reservable && peutReserver) ...[
                  const SizedBox(height: 16),
                  SubmitButton(label: d.espaces.reserver, icon: Icons.event_available_rounded, onPressed: () => showFormSheet<void>(context, title: fill(d.espaces.reserverTitre, {'nom': e.nom}), builder: (_) => ReservationForm(espace: e))),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Champ-sélecteur Wise (date, heure) : tuile greige, pastille, libellé ardoise, valeur grasse,
/// chevron vert profond.
class _PickerTile extends StatelessWidget {
  const _PickerTile({required this.icon, required this.value, required this.onTap, this.label});
  final IconData icon;
  final String? label;
  final String value;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return SuCard(
      onTap: onTap,
      radius: 20,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(children: [
        IconCircle(icon, tone: Tone.neutral, size: 40, iconSize: 20),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (label != null) Text(label!, style: t.bodySmall?.copyWith(color: SuColors.soft)),
            Text(value, style: t.titleMedium, maxLines: 1, overflow: TextOverflow.ellipsis),
          ]),
        ),
        const ChevronEnd(),
      ]),
    );
  }
}

/// G2 — réserver : date + créneau ; la détection de conflit reste serveur (409/422).
class ReservationForm extends ConsumerStatefulWidget {
  const ReservationForm({super.key, required this.espace});
  final EspaceCommun espace;
  @override
  ConsumerState<ReservationForm> createState() => _ReservationFormState();
}

class _ReservationFormState extends ConsumerState<ReservationForm> {
  DateTime _jour = DateTime.now().add(const Duration(days: 1));
  TimeOfDay _debut = const TimeOfDay(hour: 15, minute: 0);
  TimeOfDay _fin = const TimeOfDay(hour: 18, minute: 0);
  String? _lot;
  final _invites = TextEditingController();
  bool _loading = false;
  ApiFail? _fail;

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final md = context.mdict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final lots = (ref.watch(lotsProvider).valueOrNull ?? const <Lot>[]).where((x) => x.concerne(ctx.profil.id)).toList();
    _lot ??= lots.firstOrNull?.id;
    String hm(TimeOfDay x) => '${x.hour.toString().padLeft(2, '0')}:${x.minute.toString().padLeft(2, '0')}';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        StatusBadge(widget.espace.validationAutomatique ? d.espaces.validationAuto : d.espaces.validationManuelle, variant: widget.espace.validationAutomatique ? BadgeVariant.info : BadgeVariant.neutral),
        const SizedBox(height: 18),
        Text(md.chooseSlot, style: t.labelMedium?.copyWith(color: SuColors.ink)),
        const SizedBox(height: 8),
        _PickerTile(
          icon: Icons.event_rounded,
          value: formatDate(_jour.toIso8601String(), l),
          onTap: () async {
            final p = await showDatePicker(context: context, initialDate: _jour, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
            if (p != null) setState(() => _jour = p);
          },
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _PickerTile(icon: Icons.schedule_rounded, label: d.espaces.dateDebut, value: hm(_debut), onTap: () async {
                final p = await showTimePicker(context: context, initialTime: _debut);
                if (p != null) setState(() => _debut = p);
              }),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _PickerTile(icon: Icons.schedule_rounded, label: d.espaces.dateFin, value: hm(_fin), onTap: () async {
                final p = await showTimePicker(context: context, initialTime: _fin);
                if (p != null) setState(() => _fin = p);
              }),
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (lots.length > 1) ...[
          SuSelect<String>(label: d.espaces.pourLot, value: _lot, options: lots.map((x) => x.id).toList(), labelOf: (id) => lots.firstWhere((x) => x.id == id).numero, onChanged: (v) => setState(() => _lot = v), required: true),
          const SizedBox(height: 12),
        ],
        SuField(label: d.espaces.nombreInvites, controller: _invites, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], optionalLabel: d.common.optional, textDirection: TextDirection.ltr, error: fieldError(_fail, 'nombre_invites')),
        const SizedBox(height: 10),
        Text(md.conflictNote, style: t.bodySmall?.copyWith(color: SuColors.soft)),
        const SizedBox(height: 18),
        if (_fail != null) (_fail!.status == 409 || _fail!.status == 422) ? SuBanner(tone: BannerTone.warn, title: d.espaces.creneauPris, body: _fail!.error.message) : FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: '${d.common.confirm} ${hm(_debut)} – ${hm(_fin)}',
          loading: _loading,
          onPressed: _lot == null
              ? null
              : () async {
                  setState(() {
                    _loading = true;
                    _fail = null;
                  });
                  final debut = DateTime(_jour.year, _jour.month, _jour.day, _debut.hour, _debut.minute);
                  final fin = DateTime(_jour.year, _jour.month, _jour.day, _fin.hour, _fin.minute);
                  final r = await ref.read(apiClientProvider).post<Reservation>('/reservations', body: {
                    'espace_id': widget.espace.id,
                    'lot_id': _lot,
                    'date_debut': debut.toUtc().toIso8601String(),
                    'date_fin': fin.toUtc().toIso8601String(),
                    'nombre_invites': _invites.text.trim().isEmpty ? null : int.tryParse(_invites.text.trim()),
                  }, parse: (j) => Reservation.fromJson(asMap(j)));
                  if (!mounted) return;
                  switch (r) {
                    case ApiOk<Reservation>(:final data):
                      ref.invalidate(reservationsProvider);
                      // Succès plein écran sur le navigateur racine (la feuille se ferme d'abord).
                      final racine = Navigator.of(this.context, rootNavigator: true).context;
                      final (titre, corps) = scinderMessage(data.statut == 'CONFIRMEE' ? d.espaces.reservationConfirmee : d.espaces.reservationEnAttente);
                      Navigator.pop(context);
                      if (racine.mounted) showSuccess(racine, title: titre, body: corps ?? '${widget.espace.nom} · ${formatDate(debut.toIso8601String(), l)} · ${hm(_debut)} – ${hm(_fin)}', illustration: 'ok-reservation');
                    case ApiFail<Reservation>():
                      setState(() {
                        _loading = false;
                        _fail = r;
                      });
                  }
                },
          fail: _fail,
        ),
      ],
    );
  }
}

class _EspaceForm extends ConsumerStatefulWidget {
  const _EspaceForm();
  @override
  ConsumerState<_EspaceForm> createState() => _EspaceFormState();
}

class _EspaceFormState extends ConsumerState<_EspaceForm> {
  final _nom = TextEditingController(), _type = TextEditingController(), _cap = TextEditingController();
  bool _reservable = true, _auto = false, _loading = false;
  ApiFail? _fail;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SuField(label: d.espaces.nom, controller: _nom, required: true, error: fieldError(_fail, 'nom')),
        const SizedBox(height: 12),
        SuField(label: d.espaces.type, controller: _type, hint: d.espaces.typeHint, required: true, error: fieldError(_fail, 'type')),
        const SizedBox(height: 12),
        SuField(label: d.espaces.capacite, controller: _cap, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], optionalLabel: d.common.optional, textDirection: TextDirection.ltr, error: fieldError(_fail, 'capacite')),
        const SizedBox(height: 8),
        SuCheckbox(value: _reservable, onChanged: (v) => setState(() => _reservable = v), label: d.espaces.reservable),
        SuCheckbox(value: _auto, onChanged: (v) => setState(() => _auto = v), label: d.espaces.validationAuto),
        const SizedBox(height: 12),
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
            final r = await ref.read(apiClientProvider).post<dynamic>('/espaces-communs', body: {'nom': _nom.text.trim(), 'type': _type.text.trim(), 'capacite': _cap.text.trim().isEmpty ? null : int.tryParse(_cap.text.trim()), 'reservable': _reservable, 'validation_automatique': _auto});
            if (!mounted) return;
            if (r is ApiFail) {
              setState(() {
                _loading = false;
                _fail = r;
              });
              return;
            }
            ref.invalidate(espacesProvider);
            Navigator.pop(context);
          },
          fail: _fail,
        ),
      ],
    );
  }
}

// ── G3 Réservations ───────────────────────────────────────────────────────────
class ReservationsScreen extends ConsumerWidget {
  const ReservationsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final resas = ref.watch(reservationsProvider);
    final espaces = ref.watch(espacesProvider).valueOrNull ?? const <EspaceCommun>[];
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    final gestion = ctx.isGestion;
    final racine = !context.canPop();
    Widget carte(Reservation r) {
      final e = espaces.where((x) => x.id == r.espaceId).firstOrNull;
      final mienne = r.utilisateurId == ctx.profil.id;
      final lot = lots.where((x) => x.id == r.lotId).map((x) => x.numero).firstOrNull ?? '';
      final actions = r.statut == 'EN_ATTENTE' || r.statut == 'CONFIRMEE';
      // Ligne Wise : pastille 48, nom gras, créneau ardoise, statut en fin ; actions alignées sous le texte.
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 11),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            IconCircle(_iconEspace(e?.type ?? ''), tone: r.statut == 'EN_ATTENTE' ? Tone.sand : r.statut == 'CONFIRMEE' ? Tone.tosca : Tone.neutral),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(child: Text(e?.nom ?? d.espaces.titre, style: t.titleMedium, maxLines: 2, overflow: TextOverflow.ellipsis)),
                    const SizedBox(width: 10),
                    StatusBadge(d.enums.statutReservation[r.statut] ?? r.statut, variant: reservationVariant[r.statut] ?? BadgeVariant.neutral, small: true, pulse: r.statut == 'EN_ATTENTE' && gestion),
                  ]),
                  const SizedBox(height: 3),
                  Text('${formatDateHeure(r.dateDebut, l)} → ${formatHeure(r.dateFin, l)} · ${d.invitations.lot} $lot${r.nombreInvites != null ? ' · ${r.nombreInvites} ${d.espaces.nombreInvites.toLowerCase()}' : ''}', style: t.bodyMedium?.copyWith(fontSize: 14, color: SuColors.soft, height: 1.35)),
                  if (r.statut == 'EN_ATTENTE' && !gestion) Padding(padding: const EdgeInsets.only(top: 4), child: Text(d.espaces.reservationEnAttente, style: t.bodySmall?.copyWith(color: SuColors.warn))),
                  if (r.motifRejet != null) Padding(padding: const EdgeInsets.only(top: 10), child: SuBanner(tone: BannerTone.danger, title: d.espaces.motifRejet, body: r.motifRejet!)),
                  if (actions && (gestion || mienne))
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          if (gestion && r.statut == 'EN_ATTENTE') ...[
                            // Le thème fixe minimumSize = Size.fromHeight(…) : bornée ici (pill compacte).
                            SuButton(label: d.espaces.valider, size: SuButtonSize.sm, onPressed: () => _valider(context, ref, r), style: FilledButton.styleFrom(minimumSize: const Size(0, 40), padding: const EdgeInsets.symmetric(horizontal: 18))),
                            LinkButton(d.espaces.rejeter, color: SuColors.danger, onTap: () => _rejeter(context, ref, r)),
                          ],
                          LinkButton(d.espaces.annulerReservation, color: SuColors.soft, onTap: () => _annuler(context, ref, r)),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    final titre = gestion ? d.espaces.reservations : d.espaces.mesReservations;
    Future<void> refresh() async => ref.invalidate(reservationsProvider);
    final liste = AsyncView(resas, onRetry: () => ref.invalidate(reservationsProvider), data: (list) {
      if (list.isEmpty) return EmptyState(title: d.espaces.aucuneReservation, hint: d.espaces.aucuneReservationAide, icon: Icons.calendar_month_rounded, illustration: 'empty-reservations');
      final sorted = [...list]..sort((a, b) => b.dateDebut.compareTo(a.dateDebut));
      final attente = sorted.where((r) => r.statut == 'EN_ATTENTE').toList();
      final autres = sorted.where((r) => r.statut != 'EN_ATTENTE').toList();
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (attente.isNotEmpty) ...[SectionHeader(gestion ? d.espaces.fileAttente : d.enums.statutReservation['EN_ATTENTE']!), CardList([for (final r in attente) KeyedSubtree(key: ValueKey(r.id), child: carte(r))])],
          if (autres.isNotEmpty) ...[SectionHeader(d.espaces.planning), CardList([for (final r in autres) KeyedSubtree(key: ValueKey(r.id), child: carte(r))])],
        ],
      );
    });
    if (!racine) return SuPage(title: titre, onRefresh: refresh, children: [liste]);
    return Scaffold(
      appBar: ShellHeader(title: titre),
      body: SuRefresh(
        onRefresh: refresh,
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 32), children: [liste]),
      ),
    );
  }

  Future<void> _valider(BuildContext context, WidgetRef ref, Reservation r) async {
    final res = await ref.read(apiClientProvider).post<dynamic>('/reservations/${r.id}/valider');
    if (!context.mounted) return;
    if (res is ApiFail) showToast(context, res.error.message, error: true); else {
      ref.invalidate(reservationsProvider);
      showToast(context, context.dict.espaces.reservationValidee);
    }
  }

  Future<void> _rejeter(BuildContext context, WidgetRef ref, Reservation r) async {
    final d = context.dict;
    final ctrl = TextEditingController();
    await showFormSheet<void>(context, title: d.espaces.rejeter, builder: (sheet) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SuField(label: d.espaces.motifRejet, controller: ctrl, help: d.espaces.motifRejetAide, maxLines: 3, required: true),
        const SizedBox(height: 16),
        SubmitButton(label: d.espaces.rejeter, danger: true, onPressed: () async {
          final res = await ref.read(apiClientProvider).post<dynamic>('/reservations/${r.id}/rejeter', body: {'motif': ctrl.text.trim()});
          if (!sheet.mounted) return;
          if (res is ApiFail) showToast(sheet, res.error.message, error: true); else {
            ref.invalidate(reservationsProvider);
            Navigator.pop(sheet);
            showToast(context, d.espaces.reservationRejetee);
          }
        }),
      ],
    ));
  }

  Future<void> _annuler(BuildContext context, WidgetRef ref, Reservation r) async {
    final d = context.dict;
    final ok = await confirmDialog(context, title: d.espaces.annulerReservation, body: d.espaces.annulerReservationCorps, danger: true);
    if (!ok) return;
    final res = await ref.read(apiClientProvider).patch<dynamic>('/reservations/${r.id}', body: {'statut': 'ANNULEE'});
    if (!context.mounted) return;
    if (res is ApiFail) showToast(context, res.error.message, error: true); else {
      ref.invalidate(reservationsProvider);
      showToast(context, d.espaces.reservationAnnulee);
    }
  }
}
