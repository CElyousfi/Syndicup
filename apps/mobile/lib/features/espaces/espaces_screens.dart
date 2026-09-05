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
    return Scaffold(
      appBar: racine ? ShellHeader(title: d.espaces.titre) : AppBar(title: Text(d.espaces.titre)),
      floatingActionButton: ctx.isGestion ? FloatingActionButton.extended(onPressed: () => showFormSheet<void>(context, title: d.espaces.nouveau, builder: (_) => const _EspaceForm()), backgroundColor: SuColors.ink, foregroundColor: Colors.white, icon: const Icon(Icons.add_rounded), label: Text(d.espaces.nouveau)) : null,
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(espacesProvider),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
          children: [
            Text(d.espaces.subtitle, style: t.bodySmall),
            const SizedBox(height: 12),
            AsyncView(espaces, onRetry: () => ref.invalidate(espacesProvider), data: (list) {
              if (list.isEmpty) return EmptyState(title: d.espaces.aucunEspace, hint: ctx.isGestion ? d.espaces.aucunEspaceAide : null, icon: Icons.deck_rounded);
              return Column(
                children: [
                  for (final e in list)
                    SuCard(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: EdgeInsets.zero,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Photo propre à l'espace si le syndic l'a personnalisée, sinon l'emplacement déduit du nom/type.
                          SizedBox(height: 120, width: double.infinity, child: CoproPhoto('espace:${e.id}', fallbackCle: espacePhotoCle(e.nom, e.type))),
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    IconCircle(_iconEspace(e.type), tone: Tone.tosca, size: 40),
                                    const SizedBox(width: 12),
                                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(e.nom, style: t.titleSmall), Text('${e.type}${e.capacite != null ? ' · ${fill(d.espaces.personnes, {'n': e.capacite})}' : ''}', style: t.bodySmall)])),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                Wrap(spacing: 6, runSpacing: 6, children: [
                                  StatusBadge(e.reservable ? d.espaces.reservable : d.espaces.nonReservable, variant: e.reservable ? BadgeVariant.ok : BadgeVariant.outline, small: true),
                                  if (e.reservable) StatusBadge(e.validationAutomatique ? d.espaces.validationAuto : d.espaces.validationManuelle, variant: e.validationAutomatique ? BadgeVariant.info : BadgeVariant.neutral, small: true),
                                ]),
                                if (e.reservable && peutReserver) ...[
                                  const SizedBox(height: 12),
                                  FilledButton(onPressed: () => showFormSheet<void>(context, title: '${d.espaces.reserverTitre} · ${e.nom}', builder: (_) => ReservationForm(espace: e)), style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(46)), child: Text(d.espaces.reserver)),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              );
            }),
          ],
        ),
      ),
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
        Text(widget.espace.validationAutomatique ? d.espaces.validationAuto : d.espaces.validationManuelle, style: t.bodySmall),
        const SizedBox(height: 12),
        Text(md.chooseSlot, style: t.labelMedium?.copyWith(color: SuColors.ink)),
        const SizedBox(height: 6),
        OutlinedButton.icon(
          onPressed: () async {
            final p = await showDatePicker(context: context, initialDate: _jour, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
            if (p != null) setState(() => _jour = p);
          },
          icon: const Icon(Icons.event_rounded),
          label: Text(formatDate(_jour.toIso8601String(), l)),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: OutlinedButton(onPressed: () async {
              final p = await showTimePicker(context: context, initialTime: _debut);
              if (p != null) setState(() => _debut = p);
            }, child: Text('${d.espaces.dateDebut} ${hm(_debut)}'))),
            const SizedBox(width: 8),
            Expanded(child: OutlinedButton(onPressed: () async {
              final p = await showTimePicker(context: context, initialTime: _fin);
              if (p != null) setState(() => _fin = p);
            }, child: Text('${d.espaces.dateFin} ${hm(_fin)}'))),
          ],
        ),
        const SizedBox(height: 12),
        if (lots.length > 1) ...[
          SuSelect<String>(label: d.espaces.pourLot, value: _lot, options: lots.map((x) => x.id).toList(), labelOf: (id) => lots.firstWhere((x) => x.id == id).numero, onChanged: (v) => setState(() => _lot = v), required: true),
          const SizedBox(height: 12),
        ],
        SuField(label: d.espaces.nombreInvites, controller: _invites, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], optionalLabel: d.common.optional, textDirection: TextDirection.ltr, error: fieldError(_fail, 'nombre_invites')),
        const SizedBox(height: 10),
        Text(md.conflictNote, style: t.labelSmall),
        const SizedBox(height: 12),
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
                      Navigator.pop(context);
                      showToast(context, data.statut == 'CONFIRMEE' ? d.espaces.reservationConfirmee : d.espaces.reservationEnAttente);
                    case ApiFail<Reservation>():
                      setState(() {
                        _loading = false;
                        _fail = r;
                      });
                  }
                },
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
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [IconCircle(_iconEspace(e?.type ?? ''), tone: Tone.tosca, size: 36), const SizedBox(width: 10), Expanded(child: Text(e?.nom ?? r.espaceId.substring(0, 8), style: t.titleSmall)), StatusBadge(d.enums.statutReservation[r.statut] ?? r.statut, variant: reservationVariant[r.statut] ?? BadgeVariant.neutral, small: true, pulse: r.statut == 'EN_ATTENTE' && gestion)]),
            const SizedBox(height: 6),
            Text('${formatDateHeure(r.dateDebut, l)} → ${formatHeure(r.dateFin, l)} · ${d.invitations.lot} ${lots.where((x) => x.id == r.lotId).map((x) => x.numero).firstOrNull ?? ''}${r.nombreInvites != null ? ' · ${r.nombreInvites} ${d.espaces.nombreInvites.toLowerCase()}' : ''}', style: t.bodySmall),
            if (r.statut == 'EN_ATTENTE' && !gestion) Padding(padding: const EdgeInsets.only(top: 4), child: Text(d.espaces.reservationEnAttente, style: t.labelSmall)),
            if (r.motifRejet != null) Padding(padding: const EdgeInsets.only(top: 6), child: SuBanner(tone: BannerTone.danger, title: d.espaces.motifRejet, body: r.motifRejet!)),
            if (r.statut == 'EN_ATTENTE' || r.statut == 'CONFIRMEE')
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  if (gestion && r.statut == 'EN_ATTENTE') ...[
                    TextButton(onPressed: () => _rejeter(context, ref, r), style: TextButton.styleFrom(foregroundColor: SuColors.danger), child: Text(d.espaces.rejeter)),
                    TextButton(onPressed: () => _valider(context, ref, r), child: Text(d.espaces.valider)),
                  ],
                  if (mienne || gestion) TextButton(onPressed: () => _annuler(context, ref, r), style: TextButton.styleFrom(foregroundColor: SuColors.soft), child: Text(d.espaces.annulerReservation)),
                ],
              ),
          ],
        ),
      );
    }

    return Scaffold(
      appBar: racine ? ShellHeader(title: gestion ? d.espaces.reservations : d.espaces.mesReservations) : AppBar(title: Text(gestion ? d.espaces.reservations : d.espaces.mesReservations)),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(reservationsProvider),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
          children: [
            AsyncView(resas, onRetry: () => ref.invalidate(reservationsProvider), data: (list) {
              if (list.isEmpty) return EmptyState(title: d.espaces.aucuneReservation, hint: d.espaces.aucuneReservationAide, icon: Icons.calendar_month_rounded);
              final sorted = [...list]..sort((a, b) => b.dateDebut.compareTo(a.dateDebut));
              final attente = sorted.where((r) => r.statut == 'EN_ATTENTE').toList();
              final autres = sorted.where((r) => r.statut != 'EN_ATTENTE').toList();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (attente.isNotEmpty) ...[SectionHeader(gestion ? d.espaces.fileAttente : d.enums.statutReservation['EN_ATTENTE']!), CardList([for (final r in attente) carte(r)])],
                  if (autres.isNotEmpty) ...[SectionHeader(d.espaces.planning), CardList([for (final r in autres) carte(r)])],
                ],
              );
            }),
          ],
        ),
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
