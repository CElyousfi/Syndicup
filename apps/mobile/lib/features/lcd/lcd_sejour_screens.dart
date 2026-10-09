import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
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
import '../documents/document_viewer_screen.dart';
import '../../core/theme/motion.dart';

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

/// Message de succès « Titre. Détail » (ou « Titre — détail ») → titre d'affiche + corps.
({String title, String? body}) scinderSucces(String s) {
  for (final sep in const ['. ', ' — ']) {
    final i = s.indexOf(sep);
    if (i > 0) {
      final body = s.substring(i + sep.length).trim();
      return (title: s.substring(0, i), body: body.isEmpty ? null : body[0].toUpperCase() + body.substring(1));
    }
  }
  return (title: s.endsWith('.') ? s.substring(0, s.length - 1) : s, body: null);
}

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
      leading: IconCircle(Icons.luggage_rounded, tone: sejourTone(s.statut)),
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
        // Rappel du séjour : pastille + voyageur → lot, dates en ardoise.
        Row(
          children: [
            IconCircle(Icons.luggage_rounded, tone: sejourTone(widget.s.statut)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(libelleSejour(widget.s), style: t.titleMedium),
                  const SizedBox(height: 2),
                  Text('${fill(d.lcd.voyageurs, {'n': widget.s.nbVoyageurs})} · ${formatJour(widget.s.jourArrivee, context.locale)} → ${formatJour(widget.s.jourDepart, context.locale)}', style: t.bodySmall),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        SuField(label: d.lcd.nbVoyageursConstate, controller: _nb, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], optionalLabel: context.dict.common.optional),
        const SizedBox(height: 12),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.cloud_sync_rounded, size: 20, color: SuColors.soft),
            const SizedBox(width: 10),
            Expanded(child: Text(md.lcdOfflineConfirm, style: t.bodySmall)),
          ],
        ),
        const SizedBox(height: 20),
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(children: [
            const IconCircle(Icons.cloud_upload_rounded, tone: Tone.warn),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(fill(md.lcdQueueTitle, {'n': queue.length}), style: t.titleMedium), Text(md.queueLocal, style: t.labelSmall?.copyWith(color: SuColors.warn, fontFamily: 'GeistMono'))])),
          ]),
          const SizedBox(height: 12),
          for (final q in queue)
            Padding(
              key: ValueKey(q.id),
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Container(width: 10, height: 10, decoration: BoxDecoration(color: q.definitif ? SuColors.danger : SuColors.warn, shape: BoxShape.circle)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${q.action == 'arrivee' ? d.lcd.confirmerArrivee : d.lcd.confirmerDepart} · ${q.libelle ?? q.sejourId.substring(0, 8)}', style: t.titleSmall),
                        Text('${formatHeure(q.creeLe.toIso8601String(), l)} · ${q.definitif ? md.failedDefinitive : md.pendingSend}', style: t.bodySmall),
                      ],
                    ),
                  ),
                  if (q.definitif) CircleIconButton(onTap: () => ref.read(lcdSyncProvider.notifier).retirer(q.id), icon: Icons.delete_outline_rounded, color: SuColors.surface, iconColor: SuColors.danger, size: 40, tooltip: md.remove),
                ],
              ),
            ),
          const SizedBox(height: 6),
          Text(md.queueHint, style: t.bodySmall),
          const SizedBox(height: 14),
          SuButton(label: md.retryNow, icon: Icons.sync_rounded, variant: SuButtonVariant.secondary, onPressed: () => ref.read(lcdSyncProvider.notifier).flush()),
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
  /// Pièces jointes choisies (photo prise, galerie, fichier) — téléversées à l'envoi.
  final List<PieceLocale> _pieces = [];
  /// Parcours Wise en trois étapes : séjour → voyageur → pièces et récapitulatif.
  int _etape = 0;
  static const _nbEtapes = 3;

  bool get _edition => widget.sejourId != null;

  /// Erreur serveur sur un champ : on ramène l'utilisateur à l'étape qui le porte.
  int? _etapeDe(ApiFail f) {
    const e0 = {'lot_id', 'date_arrivee', 'date_depart', 'heure_arrivee_prevue', 'nb_voyageurs'};
    const e1 = {'voyageur_principal_nom', 'voyageur_telephone', 'voyageur_nationalite', 'piece_identite_type', 'piece_identite_fin', 'plaque_vehicule'};
    final k = f.error.fields.keys;
    if (k.any(e0.contains)) return 0;
    if (k.any(e1.contains)) return 1;
    return null;
  }

  void _precedent() {
    if (_etape > 0) {
      setState(() => _etape--);
    } else {
      context.pop();
    }
  }

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

    final etapeValide = switch (_etape) {
      0 => _lot != null && _arrivee != null && _depart != null,
      1 => _nom.text.trim().isNotEmpty,
      _ => _lot != null && _arrivee != null && _depart != null,
    };
    final titresEtapes = [d.lcd.sejour, d.lcd.voyageurPrincipal, d.lcd.piecesJointes];

    final List<Widget> champs = switch (_etape) {
      // 1 · Le séjour : lot, dates, heure, voyageurs.
      0 => [
          if (!_edition && declarations.hasValue && validees.isEmpty) ...[
            SuBanner(tone: BannerTone.warn, body: d.lcd.aucuneDeclarationAide),
            const SizedBox(height: 16),
          ],
          SuSelect<String>(label: d.lcd.lot, value: _lot, options: _edition ? [if (_lot != null) _lot!] : validees.map((x) => x.lotId).toList(), labelOf: numero, onChanged: (v) => setState(() => _lot = v), required: true, placeholder: d.lcd.lotSejour, enabled: !_edition, error: fieldError(_fail, 'lot_id'), help: _edition ? null : d.lcd.lotSejourAide),
          const SizedBox(height: 18),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _DateField(label: d.lcd.dateArrivee, value: _arrivee == null ? null : formatJourAnnee(_arrivee, l), onTap: () => _pickDate(true), required: true, error: fieldError(_fail, 'date_arrivee'))),
              const SizedBox(width: 10),
              Expanded(child: _DateField(label: d.lcd.dateDepart, value: _depart == null ? null : formatJourAnnee(_depart, l), onTap: () => _pickDate(false), required: true, error: fieldError(_fail, 'date_depart'))),
            ],
          ),
          if (_arrivee != null && _depart != null)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Row(children: [const Icon(Icons.nights_stay_rounded, size: 18, color: SuColors.link), const SizedBox(width: 8), Text(fill(d.lcd.nuits, {'n': _nuits()}), style: t.titleSmall)]),
            ),
          const SizedBox(height: 18),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _DateField(label: d.lcd.heureArrivee, value: _heure, onTap: _pickHeure, icon: Icons.schedule_rounded, onClear: _heure == null ? null : () => setState(() => _heure = null))),
              const SizedBox(width: 10),
              Expanded(child: SuField(label: d.lcd.nbVoyageurs, controller: _nb, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], required: true, error: fieldError(_fail, 'nb_voyageurs'))),
            ],
          ),
        ],
      // 2 · Le voyageur principal.
      1 => [
          SuField(label: d.lcd.voyageurNom, controller: _nom, required: true, textInputAction: TextInputAction.next, onChanged: (_) => setState(() {}), error: fieldError(_fail, 'voyageur_principal_nom')),
          const SizedBox(height: 16),
          SuField(label: d.lcd.voyageurTelephone, controller: _tel, keyboardType: TextInputType.phone, textDirection: TextDirection.ltr, optionalLabel: d.common.optional, error: fieldError(_fail, 'voyageur_telephone')),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: SuField(label: d.lcd.voyageurNationalite, controller: _nat, hint: d.lcd.voyageurNationaliteAide, maxLength: 3, textDirection: TextDirection.ltr, inputFormatters: [FilteringTextInputFormatter.allow(RegExp('[A-Za-z]'))], error: fieldError(_fail, 'voyageur_nationalite'))),
              const SizedBox(width: 10),
              Expanded(child: SuSelect<String?>(label: d.lcd.pieceIdentiteType, value: _piece, options: [null, ...d.enums.typePieceIdentite.keys], labelOf: (v) => v == null ? d.common.none : d.enums.typePieceIdentite[v] ?? v, onChanged: (v) => setState(() => _piece = v), placeholder: d.common.none)),
            ],
          ),
          const SizedBox(height: 16),
          SuField(label: d.lcd.pieceIdentiteFin, controller: _fin, help: d.lcd.pieceIdentiteAide, maxLength: 4, mono: true, textDirection: TextDirection.ltr, inputFormatters: [FilteringTextInputFormatter.allow(RegExp('[A-Za-z0-9]'))], optionalLabel: d.common.optional, error: fieldError(_fail, 'piece_identite_fin')),
          const SizedBox(height: 16),
          SuField(label: d.lcd.plaqueVehicule, controller: _plaque, mono: true, textDirection: TextDirection.ltr, optionalLabel: d.common.optional, error: fieldError(_fail, 'plaque_vehicule')),
        ],
      // 3 · Pièces jointes, puis récapitulatif avant l'envoi.
      _ => [
          PiecesPicker(pieces: _pieces, onChanged: () => setState(() {}), titre: false),
          const SizedBox(height: 20),
          SuCard(
            child: Column(
              children: [
                if (_lot != null) KeyValueRow(d.lcd.lot, numero(_lot!)),
                KeyValueRow(d.lcd.dateArrivee, '${_arrivee == null ? '—' : formatJourAnnee(_arrivee, l)}${_heure != null ? ' · $_heure' : ''}'),
                KeyValueRow(d.lcd.dateDepart, _depart == null ? '—' : formatJourAnnee(_depart, l)),
                KeyValueRow(d.lcd.nbVoyageurs, _nb.text.trim().isEmpty ? '1' : _nb.text.trim()),
                KeyValueRow(d.lcd.voyageurPrincipal, _nom.text.trim()),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Text(md.retryHint, style: t.bodySmall),
        ],
    };

    // Retour (bouton rond comme geste système) : étape précédente avant de quitter le parcours.
    return PopScope(
      canPop: _etape == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _etape > 0) setState(() => _etape--);
      },
      child: SuPage(
        title: _edition ? d.lcd.modifierSejour : d.lcd.declarerSejour,
        leading: _etape == 0 && !context.canPop()
            ? null
            : Padding(
                padding: const EdgeInsetsDirectional.only(start: 16),
                child: Align(alignment: AlignmentDirectional.centerStart, child: CircleIconButton(icon: Icons.arrow_back_rounded, mirror: true, tooltip: _etape > 0 ? d.common.previous : MaterialLocalizations.of(context).backButtonTooltip, onTap: _precedent)),
              ),
        children: [
          if (_edition && existing!.isLoading && !_prefilled)
            const LoadingList(count: 3)
          else ...[
            // Barre de progression du parcours.
            Text(fill(md.obStep, {'n': _etape + 1, 'total': _nbEtapes}), style: t.bodySmall?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Gauge((_etape + 1) / _nbEtapes, height: 6, color: SuColors.link),
            AnimatedSwitcher(
              duration: SuMotion.of(context, const Duration(milliseconds: 280)),
              switchInCurve: SuMotion.easeOut,
              switchOutCurve: SuMotion.easeIn,
              transitionBuilder: (c, a) => FadeTransition(opacity: a, child: SlideTransition(position: Tween(begin: const Offset(0.04, 0), end: Offset.zero).animate(a), child: c)),
              layoutBuilder: (current, previous) => Stack(alignment: AlignmentDirectional.topStart, children: [...previous, if (current != null) current]),
              child: Column(
                key: ValueKey(_etape),
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SectionHeader(titresEtapes[_etape], subtitle: _etape == 2 ? d.lcd.piecesJointesAide : null),
                  if (_fail != null) ...[FormError(_fail), const SizedBox(height: 16)],
                  ...champs,
                  const SizedBox(height: 28),
                  if (_etape < _nbEtapes - 1)
                    SuButton(label: md.obNext, size: SuButtonSize.lg, expand: true, onPressed: etapeValide ? () => setState(() => _etape++) : null)
                  else
                    SubmitButton(label: _edition ? d.common.save : d.lcd.declarerSejour, loading: _loading, onPressed: etapeValide ? _submit : null, fail: _fail),
                ],
              ),
            ),
          ],
        ],
      ),
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
    final chemins = await televerserPieces(api, _pieces);
    if (!mounted) return;
    if (chemins == null) {
      setState(() {
        _loading = false;
        _fail = ApiFail(const ApiError(code: 'INTERNAL_ERROR', message: 'Téléversement impossible.'), 502);
      });
      return;
    }
    final body = <String, Object?>{
      if (!_edition) 'lot_id': _lot,
      if (!_edition && chemins.isNotEmpty) 'pieces_jointes': chemins,
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
        if (_edition && chemins.isNotEmpty) {
          await api.post<dynamic>('/lcd/sejours/${data.id}/pieces-jointes', body: {'chemins': chemins});
          ref.invalidate(lcdPiecesJointesProvider(data.id));
        }
        if (!mounted) return;
        ref.invalidate(lcdSejoursProvider);
        ref.invalidate(lcdDuJourProvider);
        ref.invalidate(lcdSejourProvider(data.id));
        ref.invalidate(lcdDeclarationProvider(data.declarationLcdId));
        ref.invalidate(lcdSyntheseProvider(data.lotId));
        if (_edition) {
          showToast(context, context.dict.lcd.sejourModifie);
          context.pop();
        } else {
          // Moment Wise : écran de succès plein cadre, puis la fiche du séjour.
          final m = scinderSucces(context.dict.lcd.sejourDeclare);
          await showSuccess(context, title: m.title, body: m.body, illustration: 'ok-general');
          if (!mounted) return;
          context.pushReplacement('/location-courte-duree/sejours/${data.id}');
        }
      case ApiFail<LcdSejour>():
        final etape = _etapeDe(r);
        setState(() {
          _loading = false;
          _fail = r;
          if (etape != null) _etape = etape;
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
    // Même habillage que SuSelect : champ blanc, liseré hairline-strong, glyphe vert profond.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [Flexible(child: Text(label, style: t.labelMedium?.copyWith(color: SuColors.ink), maxLines: 1, overflow: TextOverflow.ellipsis)), if (required) Text(' *', style: t.labelMedium?.copyWith(color: SuColors.danger))]),
        const SizedBox(height: 8),
        Material(
          color: SuColors.surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(SuRadius.field), side: BorderSide(color: error != null ? SuColors.danger : SuColors.hairlineStrong)),
          clipBehavior: Clip.antiAlias,
          child: SuTap(
            onTap: onTap,
            customBorder: RoundedRectangleBorder(borderRadius: BorderRadius.circular(SuRadius.field)),
            child: Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(16, 17, 10, 17),
              child: Row(
                children: [
                  Expanded(child: Text(value ?? '—', style: t.bodyLarge?.copyWith(color: value == null ? SuColors.faint : SuColors.ink, fontFeatures: const [FontFeature.tabularFigures()]), maxLines: 1, overflow: TextOverflow.ellipsis)),
                  onClear != null
                      ? Semantics(button: true, label: MaterialLocalizations.of(context).deleteButtonTooltip, child: SuTap(ink: false, onTap: onClear, child: const Padding(padding: EdgeInsets.all(2), child: Icon(Icons.close_rounded, color: SuColors.link, size: 20))))
                      : Icon(icon, color: SuColors.link, size: 20),
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
              // Résumé Wise : grande pastille, voyageur en grand, lot · nuits · voyageurs, statut.
              SuEnter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    IconCircle(Icons.luggage_rounded, tone: sejourTone(s.statut), size: 64),
                    const SizedBox(height: 16),
                    Text(s.voyageurPrincipalNom, style: t.displaySmall),
                    const SizedBox(height: 4),
                    Text('${d.lcd.lot} ${s.lotNumero} · ${fill(d.lcd.nuits, {'n': s.nuits})} · ${fill(d.lcd.voyageurs, {'n': s.nbVoyageurs})}', style: t.bodyLarge?.copyWith(color: SuColors.soft)),
                    const SizedBox(height: 12),
                    StatusBadge(d.enums.statutSejour[s.statut] ?? s.statut, variant: sejourVariant[s.statut] ?? BadgeVariant.neutral, pulse: s.statut == 'EN_COURS'),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SuCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
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
              const SizedBox(height: 20),
              if (peutConfirmer && s.statut == 'PREVU' && !enFile)
                SubmitButton(label: d.lcd.confirmerArrivee, icon: Icons.login_rounded, loading: _loading, onPressed: () => confirmerSejour(context, ref, s, 'arrivee')),
              if (peutConfirmer && s.statut == 'EN_COURS' && !enFile)
                SubmitButton(label: d.lcd.confirmerDepart, icon: Icons.logout_rounded, loading: _loading, onPressed: () => confirmerSejour(context, ref, s, 'depart')),
              if (peutConfirmer && s.actif) ...[const SizedBox(height: 8), Text(md.lcdOfflineConfirm, style: t.bodySmall, textAlign: TextAlign.center), const SizedBox(height: 12)],
              if (peutGerer && s.statut == 'PREVU')
                Row(
                  children: [
                    Expanded(child: SubmitButton(label: d.common.modify, icon: Icons.edit_rounded, secondary: true, onPressed: () => context.push('/location-courte-duree/sejours/nouveau?sejour=${s.id}'))),
                    const SizedBox(width: 10),
                    Expanded(child: SuButton(label: d.lcd.annuler, icon: Icons.cancel_outlined, variant: SuButtonVariant.secondary, onPressed: _loading ? null : () => _annuler(s), style: OutlinedButton.styleFrom(foregroundColor: SuColors.danger, side: const BorderSide(color: SuColors.danger, width: 1.2)))),
                  ],
                ),
              if ((s.statut == 'EN_COURS' || s.statut == 'TERMINE') && !ctx.isPrestataire) ...[
                const SizedBox(height: 10),
                SubmitButton(label: d.lcd.signalerNuisance, icon: Icons.build_rounded, secondary: true, onPressed: () => context.push('/incidents/nouveau?sejour=${s.id}')),
              ],
              PiecesJointesSection(sejourId: s.id, peutJoindre: (ctx.declareSejoursLcd || ctx.isGardien || ctx.isGestion) && s.statut != 'ANNULE', peutRetirer: (ctx.declareSejoursLcd || ctx.isGestion) && s.statut != 'ANNULE'),
              SectionHeader(d.lcd.journal),
              if (s.evenements.isEmpty)
                Text(d.lcd.journalVide, style: t.bodyMedium?.copyWith(color: SuColors.soft))
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
              IconCircle(iconEvenement(e.type), tone: tone, size: 40, iconSize: 20),
              if (!last) Expanded(child: Container(width: 2, margin: const EdgeInsets.symmetric(vertical: 4), decoration: BoxDecoration(color: SuColors.washStrong, borderRadius: BorderRadius.circular(1)))),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(top: 2, bottom: last ? 0 : 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(d.enums.typeEvenementSejour[e.type] ?? e.type, style: t.titleMedium),
                  const SizedBox(height: 2),
                  Text(formatDateHeure(e.horodatage, context.locale), style: t.bodySmall),
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
        Text(widget.body, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: SuColors.soft)),
        const SizedBox(height: 16),
        SuField(label: widget.label, controller: _motif, maxLines: 3, required: widget.required, optionalLabel: widget.required ? null : d.common.optional, onChanged: (_) => setState(() {})),
        const SizedBox(height: 20),
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

// ── Pièces jointes (photo prise, galerie, fichier) ─────────────────────────

/// Fichier choisi localement avant téléversement.
class PieceLocale {
  const PieceLocale({required this.nom, required this.chemin, required this.contentType});
  final String nom, chemin, contentType;
  bool get estImage => contentType.startsWith('image/');
}

String _contentTypeDe(String nom, String? mime) {
  if (mime != null && mime.isNotEmpty) return mime;
  final n = nom.toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
}

/// Sélection : caméra, galerie ou fichier (image / PDF). 10 pièces au plus.
Future<PieceLocale?> choisirPiece(BuildContext context) async {
  final d = context.dict;
  final choix = await showSuSheet<String>(
    context,
    isScrollControlled: false,
    useSafeArea: false,
    builder: (ctx) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Lignes Wise : pastille 48, libellé gras.
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: CardList([
              ListRow(leading: const IconCircle(Icons.photo_camera_rounded), title: d.lcd.prendrePhoto, onTap: () => Navigator.pop(ctx, 'camera')),
              ListRow(leading: const IconCircle(Icons.photo_library_rounded), title: d.incidents.choisirGalerie, onTap: () => Navigator.pop(ctx, 'galerie')),
              ListRow(leading: const IconCircle(Icons.attach_file_rounded), title: d.lcd.choisirFichier, onTap: () => Navigator.pop(ctx, 'fichier')),
            ]),
          ),
        ],
      ),
    ),
  );
  if (choix == null) return null;
  if (choix == 'fichier') {
    final r = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic'], withData: false);
    final f = r?.files.single;
    if (f == null || f.path == null) return null;
    return PieceLocale(nom: f.name, chemin: f.path!, contentType: _contentTypeDe(f.name, null));
  }
  final x = await ImagePicker().pickImage(source: choix == 'camera' ? ImageSource.camera : ImageSource.gallery, imageQuality: 82, maxWidth: 2000);
  if (x == null) return null;
  return PieceLocale(nom: x.name, chemin: x.path, contentType: _contentTypeDe(x.name, x.mimeType));
}

/// URL signée par pièce → PUT direct → chemins ; null si un téléversement a échoué.
Future<List<String>?> televerserPieces(ApiClient api, List<PieceLocale> pieces) async {
  final chemins = <String>[];
  for (final p in pieces) {
    final prep = await api.post<Map<String, dynamic>>('/lcd/sejours/upload-url', body: {'nom_fichier': p.nom, 'content_type': p.contentType}, parse: asMap);
    if (prep is! ApiOk<Map<String, dynamic>>) return null;
    final ok = await api.uploadSigned(prep.data['upload_url'] as String, await File(p.chemin).readAsBytes(), p.contentType);
    if (!ok) return null;
    chemins.add(prep.data['storage_path'] as String);
  }
  return chemins;
}

/// Bloc « Pièces jointes » du formulaire : liste des fichiers choisis + bouton d'ajout.
class PiecesPicker extends StatelessWidget {
  const PiecesPicker({super.key, required this.pieces, required this.onChanged, this.titre = true});
  final List<PieceLocale> pieces;
  final VoidCallback onChanged;
  /// Libellé + aide au-dessus (masqués quand l'étape du parcours les porte déjà).
  final bool titre;

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (titre) ...[
          Text(d.lcd.piecesJointes, style: t.labelMedium?.copyWith(color: SuColors.ink)),
          const SizedBox(height: 4),
          Text(d.lcd.piecesJointesAide, style: t.bodySmall),
          const SizedBox(height: 8),
        ],
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final p in pieces)
              Chip(
                avatar: Icon(p.estImage ? Icons.image_rounded : Icons.picture_as_pdf_rounded, size: 16, color: SuColors.link),
                label: Text(p.nom, overflow: TextOverflow.ellipsis),
                onDeleted: () {
                  pieces.remove(p);
                  onChanged();
                },
              ),
            if (pieces.length < 10)
              ActionChip(
                avatar: const Icon(Icons.add_a_photo_rounded, size: 16, color: SuColors.link),
                label: Text(d.lcd.ajouterPieces),
                onPressed: () async {
                  final p = await choisirPiece(context);
                  if (p == null) return;
                  pieces.add(p);
                  onChanged();
                },
              ),
          ],
        ),
      ],
    );
  }
}

/// Galerie des pièces d'un séjour existant : aperçu, ouverture dans la visionneuse intégrée,
/// ajout (photo / galerie / fichier) et retrait.
class PiecesJointesSection extends ConsumerStatefulWidget {
  const PiecesJointesSection({super.key, required this.sejourId, required this.peutJoindre, required this.peutRetirer});
  final String sejourId;
  final bool peutJoindre, peutRetirer;
  @override
  ConsumerState<PiecesJointesSection> createState() => _PiecesJointesSectionState();
}

class _PiecesJointesSectionState extends ConsumerState<PiecesJointesSection> {
  bool _busy = false;

  Future<void> _ajouter() async {
    final p = await choisirPiece(context);
    if (p == null || !mounted) return;
    setState(() => _busy = true);
    final api = ref.read(apiClientProvider);
    final chemins = await televerserPieces(api, [p]);
    if (!mounted) return;
    if (chemins == null) {
      setState(() => _busy = false);
      showToast(context, context.mdict.networkError, error: true);
      return;
    }
    final r = await api.post<dynamic>('/lcd/sejours/${widget.sejourId}/pieces-jointes', body: {'chemins': chemins});
    if (!mounted) return;
    setState(() => _busy = false);
    if (r is ApiFail) {
      showToast(context, r.error.message, error: true);
      return;
    }
    ref.invalidate(lcdPiecesJointesProvider(widget.sejourId));
    ref.invalidate(lcdSejourProvider(widget.sejourId));
    showToast(context, context.dict.lcd.pieceAjoutee);
  }

  Future<void> _retirer(LcdPieceJointe pj) async {
    final d = context.dict;
    final ok = await confirmDialog(context, title: d.lcd.retirerPiece, body: pj.nom, confirmLabel: d.lcd.retirerPiece, danger: true);
    if (!ok || !mounted) return;
    final r = await ref.read(apiClientProvider).delete<dynamic>('/lcd/sejours/${widget.sejourId}/pieces-jointes', body: {'chemin': pj.path});
    if (!mounted) return;
    if (r is ApiFail) {
      showToast(context, r.error.message, error: true);
      return;
    }
    ref.invalidate(lcdPiecesJointesProvider(widget.sejourId));
    ref.invalidate(lcdSejourProvider(widget.sejourId));
    showToast(context, d.lcd.pieceRetiree);
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final pieces = ref.watch(lcdPiecesJointesProvider(widget.sejourId));
    final liste = pieces.valueOrNull ?? const <LcdPieceJointe>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(d.lcd.piecesJointes, subtitle: d.lcd.piecesJointesAide, actionLabel: widget.peutJoindre && liste.length < 10 ? d.lcd.ajouterPieces : null, onAction: widget.peutJoindre && liste.length < 10 && !_busy ? _ajouter : null),
        liste.isEmpty
            ? Text(pieces.isLoading ? context.mdict.loading : d.lcd.aucunePiece, style: t.bodyMedium?.copyWith(color: SuColors.soft))
            : GridView.count(
                  crossAxisCount: 3,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  children: [
                    for (final pj in liste)
                      Stack(
                        fit: StackFit.expand,
                        children: [
                          SuTap(
                            borderRadius: BorderRadius.circular(18),
                            onTap: () => ouvrirVisionneuse(context, titre: pj.nom, url: pj.url),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(18),
                              child: pj.estImage
                                  ? SuImage.network(pj.url, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(color: SuColors.tile, child: const Icon(Icons.broken_image_outlined, color: SuColors.faint)))
                                  : Container(color: SuColors.tile, padding: const EdgeInsets.all(8), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [const Icon(Icons.picture_as_pdf_rounded, color: SuColors.link, size: 28), const SizedBox(height: 4), Text(pj.nom, style: t.labelSmall, maxLines: 2, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, textDirection: TextDirection.ltr)])),
                            ),
                          ),
                          if (widget.peutRetirer)
                            PositionedDirectional(
                              end: 4,
                              top: 4,
                              child: CircleIconButton(onTap: () => _retirer(pj), icon: Icons.close_rounded, size: 30, color: SuColors.surface, iconColor: SuColors.ink, tooltip: d.lcd.retirerPiece),
                            ),
                        ],
                      ),
                  ],
                ),
      ],
    );
  }
}
