import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';

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
import '../../offline/sync_queue/lcd_sync.dart';

/// M15 Location courte durée (Doc A §10.2) — séjours : formulaire (déclarer / modifier),
/// fiche (détail + chronologie des événements + actions), confirmations gardien hors-ligne.

Tone sejourTone(String statut) => switch (statut) {
      'EN_COURS' => Tone.ok,
      'PREVU' => Tone.tosca,
      'ANNULE' => Tone.neutral,
      _ => Tone.sand,
    };

IconData iconEvenement(String type) => switch (type) {
      'DECLARE' => Icons.add_circle_outline_rounded,
      'MODIFIE' => Icons.edit_rounded,
      'ARRIVEE_CONFIRMEE' => Icons.login_rounded,
      'DEPART_CONFIRME' => Icons.logout_rounded,
      'ANNULE' => Icons.cancel_outlined,
      'INCIDENT_LIE' => Icons.build_rounded,
      'GARDIEN_NOTIFIE' => Icons.notifications_active_rounded,
      _ => Icons.circle_outlined,
    };

/// Libellé « voyageur → lot » partagé par les listes, la file locale et les toasts.
String libelleSejour(LcdSejour s) => '${s.voyageurPrincipalNom} → ${s.lotNumero}';

/// Ligne de séjour (listes, tableau du jour, fiche lot).
class SejourRow extends StatelessWidget {
  const SejourRow(this.s, {super.key, this.trailing, this.enAttente = false});
  final LcdSejour s;
  final Widget? trailing;
  final bool enAttente;

  @override
  Widget build(BuildContext context) {
    final md = context.mdict;
    final d = context.dict;
    final l = context.locale;
    final heure = s.heureArriveePrevue;
    return ListRow(
      leading: IconCircle(Icons.luggage_rounded, tone: sejourTone(s.statut), size: 40),
      title: libelleSejour(s),
      subtitle: '${formatJour(s.jourArrivee, l)} → ${formatJour(s.jourDepart, l)} · ${fill(d.lcd.voyageurs, {'n': s.nbVoyageurs})}${heure != null && s.statut == 'PREVU' ? ' · $heure' : ''}${enAttente ? ' · ${md.pendingSend}' : ''}',
      trailing: trailing ?? StatusBadge(d.enums.statutSejour[s.statut] ?? s.statut, variant: sejourVariant[s.statut] ?? BadgeVariant.neutral, small: true, pulse: s.statut == 'EN_COURS'),
      onTap: () => context.push('/location-courte-duree/sejours/${s.id}'),
    );
  }
}

/// Confirmation d'arrivée / de départ — passe par la file locale (hors-ligne assumé) avec une
/// Idempotency-Key stable : « Réessayer » ne crée jamais un second événement.
Future<void> confirmerSejour(BuildContext context, WidgetRef ref, LcdSejour s, String action) async {
  final md = context.mdict;
  final d = context.dict;
  Map<String, Object?>? payload;
  if (action == 'arrivee') {
    payload = await showFormSheet<Map<String, Object?>>(context, title: d.lcd.confirmerArrivee, builder: (_) => _ArriveeForm(s));
  } else {
    final ok = await confirmDialog(context, title: d.lcd.confirmerDepart, body: '${libelleSejour(s)} · ${formatJour(s.jourDepart, context.locale)}', confirmLabel: d.lcd.confirmerDepart);
    payload = ok ? const {} : null;
  }
  if (payload == null || !context.mounted) return;
  final r = await ref.read(lcdSyncProvider.notifier).confirmer(sejourId: s.id, action: action, payload: payload, libelle: libelleSejour(s));
  if (!context.mounted) return;
  if (r.refus != null) {
    showToast(context, r.refus!.error.message, error: true);
  } else if (r.enFile) {
    showToast(context, md.pendingSend);
  } else {
    showToast(context, action == 'arrivee' ? d.lcd.arriveeConfirmee : d.lcd.departConfirme);
  }
}

class _ArriveeForm extends StatefulWidget {
  const _ArriveeForm(this.s);
  final LcdSejour s;
  @override
  State<_ArriveeForm> createState() => _ArriveeFormState();
}

class _ArriveeFormState extends State<_ArriveeForm> {
  late final _nb = TextEditingController(text: '${widget.s.nbVoyageurs}');
  @override
  Widget build(BuildContext context) {
    final md = context.mdict;
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(libelleSejour(widget.s), style: t.titleSmall),
        const SizedBox(height: 4),
        Text('${fill(d.lcd.voyageurs, {'n': widget.s.nbVoyageurs})} · ${formatJour(widget.s.jourArrivee, context.locale)} → ${formatJour(widget.s.jourDepart, context.locale)}', style: t.bodySmall),
        const SizedBox(height: 14),
        SuField(label: d.lcd.nbVoyageursConstate, controller: _nb, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], optionalLabel: context.dict.common.optional),
        const SizedBox(height: 10),
        Text(md.lcdOfflineConfirm, style: t.labelSmall),
        const SizedBox(height: 14),
        SubmitButton(
          label: d.lcd.confirmerArrivee,
          icon: Icons.login_rounded,
          onPressed: () {
            final n = int.tryParse(_nb.text.trim());
            Navigator.pop(context, <String, Object?>{if (n != null && n > 0) 'nb_voyageurs_constate': n});
          },
        ),
      ],
    );
  }
}

/// Carte « file locale » des confirmations non envoyées (même UX que les visites).
class LcdQueueCard extends ConsumerWidget {
  const LcdQueueCard({super.key, required this.queue});
  final List<LcdActionsQueueData> queue;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final md = context.mdict;
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    return SuCard(
      border: SuColors.warnBorder,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [Expanded(child: Text(fill(md.lcdQueueTitle, {'n': queue.length}), style: t.titleSmall)), Text(md.queueLocal, style: t.labelSmall?.copyWith(color: SuColors.warn, fontFamily: 'GeistMono'))]),
          const SizedBox(height: 10),
          for (final q in queue)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Container(width: 9, height: 9, decoration: BoxDecoration(color: q.definitif ? SuColors.danger : SuColors.warn, shape: BoxShape.circle)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${q.action == 'arrivee' ? d.lcd.confirmerArrivee : d.lcd.confirmerDepart} · ${q.libelle ?? q.sejourId.substring(0, 8)}', style: t.bodyMedium?.copyWith(color: SuColors.ink, fontWeight: FontWeight.w500)),
                        Text('${formatHeure(q.creeLe.toIso8601String(), l)} · ${q.definitif ? md.failedDefinitive : md.pendingSend}', style: t.labelSmall),
                      ],
                    ),
                  ),
                  if (q.definitif) IconButton(onPressed: () => ref.read(lcdSyncProvider.notifier).retirer(q.id), icon: const Icon(Icons.delete_outline_rounded, color: SuColors.faint), tooltip: md.remove),
                ],
              ),
            ),
          Text(md.queueHint, style: t.labelSmall),
          const SizedBox(height: 8),
          OutlinedButton.icon(onPressed: () => ref.read(lcdSyncProvider.notifier).flush(), style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(42)), icon: const Icon(Icons.sync_rounded, size: 18), label: Text(md.retryNow)),
        ],
      ),
    );
  }
}

// ── Formulaire de séjour ──────────────────────────────────────────────────────

class LcdSejourFormScreen extends ConsumerStatefulWidget {
  const LcdSejourFormScreen({super.key, this.sejourId, this.lotId});
  final String? sejourId;
  final String? lotId;
  @override
  ConsumerState<LcdSejourFormScreen> createState() => _LcdSejourFormScreenState();
}

class _LcdSejourFormScreenState extends ConsumerState<LcdSejourFormScreen> {
  /// Une seule clé par saisie : « Réessayer » rejoue la même écriture, jamais un doublon.
  final _idempotencyKey = const Uuid().v4();
  String? _lot;
  String? _arrivee, _depart, _heure, _piece;
  final _nb = TextEditingController(text: '1');
  final _nom = TextEditingController();
  final _tel = TextEditingController();
  final _nat = TextEditingController();
  final _fin = TextEditingController();
  final _plaque = TextEditingController();
  bool _loading = false, _prefilled = false;
  ApiFail? _fail;

  bool get _edition => widget.sejourId != null;

  @override
  void initState() {
    super.initState();
    _lot = widget.lotId;
  }

  void _prefill(LcdSejour s) {
    _lot = s.lotId;
    _arrivee = s.jourArrivee;
    _depart = s.jourDepart;
    _heure = s.heureArriveePrevue;
    _piece = s.pieceIdentiteType;
    _nb.text = '${s.nbVoyageurs}';
    _nom.text = s.voyageurPrincipalNom;
    _tel.text = s.voyageurTelephone ?? '';
    _nat.text = s.voyageurNationalite ?? '';
    _fin.text = s.pieceIdentiteFin ?? '';
    _plaque.text = s.plaqueVehicule ?? '';
  }

  Future<void> _pickDate(bool arrivee) async {
    final l = context.locale;
    final base = DateTime.tryParse((arrivee ? _arrivee : _depart) ?? '') ?? DateTime.tryParse(_arrivee ?? '') ?? DateTime.now();
    final now = DateTime.now();
    final d = await showDatePicker(context: context, initialDate: base, firstDate: DateTime(now.year - 1), lastDate: DateTime(now.year + 2), locale: l);
    if (d == null) return;
    setState(() {
      if (arrivee) {
        _arrivee = jourIso(d);
        final dep = DateTime.tryParse(_depart ?? '');
        if (dep == null || !dep.isAfter(d)) _depart = jourIso(d.add(const Duration(days: 1)));
      } else {
        _depart = jourIso(d);
      }
    });
  }

  Future<void> _pickHeure() async {
    final parts = (_heure ?? '15:00').split(':');
    final t = await showTimePicker(context: context, initialTime: TimeOfDay(hour: int.tryParse(parts[0]) ?? 15, minute: int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0));
    if (t == null) return;
    setState(() => _heure = '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}');
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final md = context.mdict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final declarations = ref.watch(lcdDeclarationsProvider);
    final existing = _edition ? ref.watch(lcdSejourProvider(widget.sejourId!)) : null;
    if (existing?.valueOrNull != null && !_prefilled) {
      _prefilled = true;
      _prefill(existing!.valueOrNull!);
    }
    final validees = (declarations.valueOrNull ?? const <LcdDeclaration>[]).where((x) => x.statut == 'VALIDEE').toList();
    if (_lot == null && validees.length == 1 && !_edition) _lot = validees.first.lotId;
    String numero(String lotId) => validees.where((x) => x.lotId == lotId).map((x) => x.lotNumero).firstOrNull ?? (existing?.valueOrNull?.lotNumero ?? lotId.substring(0, 8));

    return SuPage(
      title: _edition ? d.lcd.modifierSejour : d.lcd.declarerSejour,
      children: [
        if (_edition && existing!.isLoading && !_prefilled)
          const LoadingList(count: 3)
        else ...[
          if (!_edition && declarations.hasValue && validees.isEmpty) ...[
            SuBanner(tone: BannerTone.warn, body: d.lcd.aucuneDeclarationAide),
            const SizedBox(height: 12),
          ],
          SuSelect<String>(label: d.lcd.lot, value: _lot, options: _edition ? [if (_lot != null) _lot!] : validees.map((x) => x.lotId).toList(), labelOf: numero, onChanged: (v) => setState(() => _lot = v), required: true, placeholder: d.lcd.lotSejour, enabled: !_edition, error: fieldError(_fail, 'lot_id')),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: _DateField(label: d.lcd.dateArrivee, value: _arrivee == null ? null : formatJourAnnee(_arrivee, l), onTap: () => _pickDate(true), required: true, error: fieldError(_fail, 'date_arrivee'))),
              const SizedBox(width: 10),
              Expanded(child: _DateField(label: d.lcd.dateDepart, value: _depart == null ? null : formatJourAnnee(_depart, l), onTap: () => _pickDate(false), required: true, error: fieldError(_fail, 'date_depart'))),
            ],
          ),
          if (_arrivee != null && _depart != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(fill(d.lcd.nuits, {'n': _nuits()}), style: t.bodySmall)),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: _DateField(label: d.lcd.heureArrivee, value: _heure, onTap: _pickHeure, icon: Icons.schedule_rounded, onClear: _heure == null ? null : () => setState(() => _heure = null))),
              const SizedBox(width: 10),
              Expanded(child: SuField(label: d.lcd.nbVoyageurs, controller: _nb, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], required: true, error: fieldError(_fail, 'nb_voyageurs'))),
            ],
          ),
          const SizedBox(height: 14),
          SuField(label: d.lcd.voyageurNom, controller: _nom, required: true, textInputAction: TextInputAction.next, error: fieldError(_fail, 'voyageur_principal_nom')),
          const SizedBox(height: 14),
          SuField(label: d.lcd.voyageurTelephone, controller: _tel, keyboardType: TextInputType.phone, textDirection: TextDirection.ltr, optionalLabel: d.common.optional, error: fieldError(_fail, 'voyageur_telephone')),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: SuField(label: d.lcd.voyageurNationalite, controller: _nat, hint: d.lcd.voyageurNationaliteAide, maxLength: 3, textDirection: TextDirection.ltr, inputFormatters: [FilteringTextInputFormatter.allow(RegExp('[A-Za-z]'))], error: fieldError(_fail, 'voyageur_nationalite'))),
              const SizedBox(width: 10),
              Expanded(child: SuSelect<String?>(label: d.lcd.pieceIdentiteType, value: _piece, options: [null, ...d.enums.typePieceIdentite.keys], labelOf: (v) => v == null ? d.common.none : d.enums.typePieceIdentite[v] ?? v, onChanged: (v) => setState(() => _piece = v), placeholder: d.common.none)),
            ],
          ),
          const SizedBox(height: 14),
          SuField(label: d.lcd.pieceIdentiteFin, controller: _fin, help: d.lcd.pieceIdentiteAide, maxLength: 4, mono: true, textDirection: TextDirection.ltr, inputFormatters: [FilteringTextInputFormatter.allow(RegExp('[A-Za-z0-9]'))], optionalLabel: d.common.optional, error: fieldError(_fail, 'piece_identite_fin')),
          const SizedBox(height: 14),
          SuField(label: d.lcd.plaqueVehicule, controller: _plaque, mono: true, textDirection: TextDirection.ltr, optionalLabel: d.common.optional, error: fieldError(_fail, 'plaque_vehicule')),
          const SizedBox(height: 20),
          FormError(_fail),
          if (_fail != null) const SizedBox(height: 12),
          Text(md.retryHint, style: t.labelSmall),
          const SizedBox(height: 10),
          SubmitButton(label: _edition ? d.common.save : d.lcd.declarerSejour, loading: _loading, onPressed: _lot == null || _arrivee == null || _depart == null ? null : _submit),
        ],
      ],
    );
  }

  int _nuits() {
    final a = DateTime.tryParse(_arrivee ?? '');
    final b = DateTime.tryParse(_depart ?? '');
    if (a == null || b == null) return 0;
    final n = b.difference(a).inDays;
    return n < 0 ? 0 : n;
  }

  String? _opt(TextEditingController c) => c.text.trim().isEmpty ? null : c.text.trim();

  Future<void> _submit() async {
    if (_nom.text.trim().isEmpty) return;
    setState(() {
      _loading = true;
      _fail = null;
    });
    final api = ref.read(apiClientProvider);
    final body = <String, Object?>{
      if (!_edition) 'lot_id': _lot,
      'date_arrivee': _arrivee,
      'date_depart': _depart,
      'heure_arrivee_prevue': _heure,
      'nb_voyageurs': int.tryParse(_nb.text.trim()) ?? 1,
      'voyageur_principal_nom': _nom.text.trim(),
      'voyageur_telephone': _opt(_tel),
      'voyageur_nationalite': _opt(_nat)?.toUpperCase(),
      'piece_identite_type': _piece,
      'piece_identite_fin': _opt(_fin),
      'plaque_vehicule': _opt(_plaque),
    };
    final r = _edition
        ? await api.patch<LcdSejour>('/lcd/sejours/${widget.sejourId}', body: body, parse: (j) => LcdSejour.fromJson(asMap(j)))
        : await api.post<LcdSejour>('/lcd/sejours', body: body, idempotencyKey: _idempotencyKey, parse: (j) => LcdSejour.fromJson(asMap(j)));
    if (!mounted) return;
    switch (r) {
      case ApiOk<LcdSejour>(:final data):
        ref.invalidate(lcdSejoursProvider);
        ref.invalidate(lcdDuJourProvider);
        ref.invalidate(lcdSejourProvider(data.id));
        ref.invalidate(lcdDeclarationProvider(data.declarationLcdId));
        ref.invalidate(lcdSyntheseProvider(data.lotId));
        showToast(context, _edition ? context.dict.lcd.sejourModifie : context.dict.lcd.sejourDeclare);
        if (_edition) {
          context.pop();
        } else {
          context.pushReplacement('/location-courte-duree/sejours/${data.id}');
        }
      case ApiFail<LcdSejour>():
        setState(() {
          _loading = false;
          _fail = r;
        });
    }
  }
}

/// Champ date / heure : même habillage que SuSelect (sélecteur natif au toucher).
class _DateField extends StatelessWidget {
  const _DateField({required this.label, required this.value, required this.onTap, this.required = false, this.error, this.icon = Icons.calendar_month_rounded, this.onClear});
  final String label;
  final String? value;
  final VoidCallback onTap;
  final VoidCallback? onClear;
  final bool required;
  final String? error;
  final IconData icon;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [Flexible(child: Text(label, style: t.labelMedium?.copyWith(color: SuColors.ink), maxLines: 1, overflow: TextOverflow.ellipsis)), if (required) Text(' *', style: t.labelMedium?.copyWith(color: SuColors.danger))]),
        const SizedBox(height: 6),
        Material(
          color: SuColors.surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(SuRadius.field), side: BorderSide(color: error != null ? SuColors.danger : SuColors.hairline)),
          child: InkWell(
            borderRadius: BorderRadius.circular(SuRadius.field),
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(14, 15, 8, 15),
              child: Row(
                children: [
                  Expanded(child: Text(value ?? '—', style: t.bodyLarge?.copyWith(color: value == null ? SuColors.faint : SuColors.ink, fontFeatures: const [FontFeature.tabularFigures()]), maxLines: 1, overflow: TextOverflow.ellipsis)),
                  onClear != null
                      ? GestureDetector(onTap: onClear, child: const Icon(Icons.close_rounded, color: SuColors.soft, size: 20))
                      : Icon(icon, color: SuColors.soft, size: 20),
                ],
              ),
            ),
          ),
        ),
        if (error != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(error!, style: t.bodySmall?.copyWith(color: SuColors.danger))),
      ],
    );
  }
}

// ── Fiche séjour ──────────────────────────────────────────────────────────────

class LcdSejourScreen extends ConsumerStatefulWidget {
  const LcdSejourScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<LcdSejourScreen> createState() => _LcdSejourScreenState();
}

class _LcdSejourScreenState extends ConsumerState<LcdSejourScreen> {
  bool _loading = false;

  Future<void> _annuler(LcdSejour s) async {
    final d = context.dict;
    final motif = await showFormSheet<String>(context, title: d.lcd.annuler, builder: (ctx) => _MotifForm(body: d.lcd.annulerAide, label: d.lcd.motifAnnulation, submit: d.lcd.annuler, danger: true));
    if (motif == null || !mounted) return;
    setState(() => _loading = true);
    final r = await ref.read(apiClientProvider).post<LcdSejour>('/lcd/sejours/${s.id}/annuler', body: {'motif': motif.isEmpty ? null : motif}, idempotencyKey: const Uuid().v4(), parse: (j) => LcdSejour.fromJson(asMap(j)));
    if (!mounted) return;
    setState(() => _loading = false);
    switch (r) {
      case ApiOk<LcdSejour>():
        ref.invalidate(lcdSejourProvider(s.id));
        ref.invalidate(lcdSejoursProvider);
        ref.invalidate(lcdDuJourProvider);
        ref.invalidate(lcdDeclarationProvider(s.declarationLcdId));
        showToast(context, d.lcd.annule);
      case ApiFail<LcdSejour>(:final error):
        showToast(context, error.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final md = context.mdict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final sejour = ref.watch(lcdSejourProvider(widget.id));
    final queue = (ref.watch(lcdQueueProvider).valueOrNull ?? const <LcdActionsQueueData>[]).where((q) => q.sejourId == widget.id).toList();
    final me = ctx.profil.id;
    final peutConfirmer = ctx.isGestion || ctx.isGardien;

    return SuPage(
      title: d.lcd.sejours,
      subtitle: sejour.valueOrNull == null ? null : fill(md.lcdSejourDe, {'lot': sejour.valueOrNull!.lotNumero}),
      onRefresh: () async {
        ref.invalidate(lcdSejourProvider(widget.id));
        await ref.read(lcdSyncProvider.notifier).flush();
      },
      children: [
        AsyncView(sejour, onRetry: () => ref.invalidate(lcdSejourProvider(widget.id)), data: (s) {
          final peutGerer = ctx.isGestion || s.declareParId == me || ctx.declareSejoursLcd;
          final enFile = queue.where((q) => !q.definitif).isNotEmpty;
          // Fin de pièce dans un isolat LTR (U+2066…U+2069) : jamais réordonnée par le bidi après un libellé arabe.
          final piece = s.pieceIdentiteType == null ? null : '${d.enums.typePieceIdentite[s.pieceIdentiteType] ?? s.pieceIdentiteType}${s.pieceIdentiteFin != null ? ' · \u2066****${s.pieceIdentiteFin}\u2069' : ''}';
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SuCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        IconCircle(Icons.luggage_rounded, tone: sejourTone(s.statut), size: 48),
                        const SizedBox(width: 12),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(s.voyageurPrincipalNom, style: t.titleLarge), Text('${d.lcd.lot} ${s.lotNumero} · ${fill(d.lcd.nuits, {'n': s.nuits})}', style: t.bodySmall)])),
                        StatusBadge(d.enums.statutSejour[s.statut] ?? s.statut, variant: sejourVariant[s.statut] ?? BadgeVariant.neutral, pulse: s.statut == 'EN_COURS'),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Divider(height: 16),
                    KeyValueRow(d.lcd.dateArrivee, '${formatJourAnnee(s.jourArrivee, l)}${s.heureArriveePrevue != null ? ' · ${s.heureArriveePrevue}' : ''}'),
                    KeyValueRow(d.lcd.dateDepart, formatJourAnnee(s.jourDepart, l)),
                    KeyValueRow(d.lcd.nbVoyageurs, '${s.nbVoyageurs}'),
                    if (s.voyageurTelephone != null) KeyValueRow(d.lcd.voyageurTelephone, '', valueWidget: _ltrValue(context, formatTelephone(s.voyageurTelephone), mono: true)),
                    if (s.voyageurNationalite != null) KeyValueRow(d.lcd.voyageurNationalite, s.voyageurNationalite!.toUpperCase()),
                    if (piece != null) KeyValueRow(d.lcd.pieceIdentite, piece),
                    if (s.plaqueVehicule != null) KeyValueRow(d.lcd.plaqueVehicule, '', valueWidget: _ltrValue(context, s.plaqueVehicule!, mono: true)),
                    if (s.gardienInformeLe != null) KeyValueRow(md.lcdGardienInforme, formatDateHeure(s.gardienInformeLe, l)),
                    if (s.statut == 'ANNULE') KeyValueRow(d.lcd.motifAnnulation, s.motifAnnulation ?? '—'),
                  ],
                ),
              ),
              if (enFile) ...[const SizedBox(height: 12), SuBanner(tone: BannerTone.warn, body: '${md.pendingSend} — ${md.queueHint}')],
              if (queue.any((q) => q.definitif)) ...[const SizedBox(height: 12), SuBanner(tone: BannerTone.danger, body: queue.firstWhere((q) => q.definitif).derniereErreur ?? md.failedDefinitive)],
              const SizedBox(height: 14),
              if (peutConfirmer && s.statut == 'PREVU' && !enFile)
                SubmitButton(label: d.lcd.confirmerArrivee, icon: Icons.login_rounded, loading: _loading, onPressed: () => confirmerSejour(context, ref, s, 'arrivee')),
              if (peutConfirmer && s.statut == 'EN_COURS' && !enFile)
                SubmitButton(label: d.lcd.confirmerDepart, icon: Icons.logout_rounded, loading: _loading, onPressed: () => confirmerSejour(context, ref, s, 'depart')),
              if (peutConfirmer && s.actif) ...[const SizedBox(height: 6), Text(md.lcdOfflineConfirm, style: t.labelSmall, textAlign: TextAlign.center), const SizedBox(height: 10)],
              if (peutGerer && s.statut == 'PREVU')
                Row(
                  children: [
                    Expanded(child: SubmitButton(label: d.common.modify, icon: Icons.edit_rounded, secondary: true, onPressed: () => context.push('/location-courte-duree/sejours/nouveau?sejour=${s.id}'))),
                    const SizedBox(width: 10),
                    Expanded(child: OutlinedButton.icon(onPressed: _loading ? null : () => _annuler(s), style: OutlinedButton.styleFrom(foregroundColor: SuColors.danger, side: const BorderSide(color: SuColors.danger)), icon: const Icon(Icons.cancel_outlined, size: 18), label: Text(d.lcd.annuler, overflow: TextOverflow.ellipsis))),
                  ],
                ),
              if ((s.statut == 'EN_COURS' || s.statut == 'TERMINE') && !ctx.isPrestataire) ...[
                const SizedBox(height: 10),
                SubmitButton(label: d.lcd.signalerNuisance, icon: Icons.build_rounded, secondary: true, onPressed: () => context.push('/incidents/nouveau?sejour=${s.id}')),
              ],
              SectionHeader(d.lcd.journal),
              if (s.evenements.isEmpty)
                SuCard(child: Text(d.common.emptyDefault, style: t.bodySmall))
              else
                SuCard(
                  child: Column(
                    children: [
                      for (int i = 0; i < s.evenements.length; i++) _EvenementItem(e: s.evenements[i], last: i == s.evenements.length - 1),
                    ],
                  ),
                ),
            ],
          );
        }),
      ],
    );
  }
}

/// Valeur toujours lue de gauche à droite (téléphone, plaque, fin de pièce) — jamais inversée en RTL.
Widget _ltrValue(BuildContext context, String value, {bool mono = false}) {
  final t = Theme.of(context).textTheme;
  return Align(
    alignment: AlignmentDirectional.centerEnd,
    child: Text(value, textDirection: TextDirection.ltr, style: t.bodyMedium?.copyWith(color: SuColors.ink, fontWeight: FontWeight.w600, fontFamily: mono ? 'GeistMono' : null, fontFeatures: const [FontFeature.tabularFigures()])),
  );
}

class _EvenementItem extends StatelessWidget {
  const _EvenementItem({required this.e, required this.last});
  final LcdSejourEvenement e;
  final bool last;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final details = e.detailsJson;
    final constate = details?['nb_voyageurs_constate'];
    final motif = details?['motif'] ?? (details?['apres'] is Map ? (details!['apres'] as Map)['motif'] : null);
    final tone = switch (e.type) { 'ARRIVEE_CONFIRMEE' => Tone.ok, 'DEPART_CONFIRME' => Tone.sand, 'ANNULE' => Tone.danger, 'INCIDENT_LIE' => Tone.warn, _ => Tone.neutral };
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Column(
            children: [
              IconCircle(iconEvenement(e.type), tone: tone, size: 32, iconSize: 16),
              if (!last) Expanded(child: Container(width: 2, margin: const EdgeInsets.symmetric(vertical: 4), color: SuColors.hairline)),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: last ? 0 : 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(d.enums.typeEvenementSejour[e.type] ?? e.type, style: t.titleSmall),
                  Text(formatDateHeure(e.horodatage, context.locale), style: t.labelSmall),
                  if (constate != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text('${d.lcd.nbVoyageursConstate} : $constate', style: t.bodySmall)),
                  if (motif is String && motif.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 2), child: Text(motif, style: t.bodySmall)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Feuille « motif » (annulation, décision) — renvoie le texte saisi (vide autorisé si non requis).
class _MotifForm extends StatefulWidget {
  const _MotifForm({required this.body, required this.label, required this.submit, this.required = false, this.danger = false});
  final String body, label, submit;
  final bool required, danger;
  @override
  State<_MotifForm> createState() => _MotifFormState();
}

class _MotifFormState extends State<_MotifForm> {
  final _motif = TextEditingController();
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(widget.body, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 12),
        SuField(label: widget.label, controller: _motif, maxLines: 3, required: widget.required, optionalLabel: widget.required ? null : d.common.optional, onChanged: (_) => setState(() {})),
        const SizedBox(height: 14),
        SubmitButton(label: widget.submit, danger: widget.danger, onPressed: widget.required && _motif.text.trim().isEmpty ? null : () => Navigator.pop(context, _motif.text.trim())),
      ],
    );
  }
}

/// Feuille motif exposée aux autres écrans LCD (décision du syndic).
Future<String?> demanderMotif(BuildContext context, {required String title, required String body, required String label, required String submit, bool required = false, bool danger = false}) =>
    showFormSheet<String>(context, title: title, builder: (_) => _MotifForm(body: body, label: label, submit: submit, required: required, danger: danger));

/// Filtre de séjours par statut (liste principale) — partagé avec l'écran d'accueil LCD.
List<LcdSejour> trierSejours(List<LcdSejour> list) {
  final l = [...list]..sort((a, b) => b.jourArrivee.compareTo(a.jourArrivee));
  return l;
}
