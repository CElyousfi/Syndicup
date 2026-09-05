import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

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

/// J5 — paramètres de la copropriété (syndic) : identité, règlement, options, paramètres
/// légaux (section distincte, bannière permanente : jamais une valeur légale devinée).
class ParametresScreen extends ConsumerStatefulWidget {
  const ParametresScreen({super.key});
  @override
  ConsumerState<ParametresScreen> createState() => _ParametresScreenState();
}

class _ParametresScreenState extends ConsumerState<ParametresScreen> {
  final _nom = TextEditingController(), _adresse = TextEditingController(), _ville = TextEditingController(), _nbLots = TextEditingController(), _tantiemes = TextEditingController();
  final _delai = TextEditingController(), _quorum = TextEditingController(), _limite = TextEditingController(), _retention = TextEditingController();
  bool _locPv = false, _resaProprio = false, _init = false, _loading = false;
  ApiFail? _fail;
  String? _section;

  void _fill(Copropriete c) {
    _init = true;
    _nom.text = c.nom;
    _adresse.text = c.adresse;
    _ville.text = c.ville;
    _nbLots.text = '${c.nbLots}';
    _tantiemes.text = c.totalTantiemes ?? '';
    _delai.text = c.delaiConvocationJours?.toString() ?? '';
    _quorum.text = c.quorumPremiereConvocation ?? '';
    _limite.text = c.limiteProcurationsMandataire?.toString() ?? '';
    _retention.text = c.retentionDesactivationMois?.toString() ?? '';
    _locPv = c.locataireVoitPv;
    _resaProprio = c.reservationProprietairesSeulement;
  }

  Future<void> _save(String section, Map<String, dynamic> body) async {
    final ctx = ref.read(appContextProvider);
    setState(() {
      _loading = true;
      _fail = null;
      _section = section;
    });
    final r = await ref.read(apiClientProvider).patch<dynamic>('/coproprietes/${ctx.coproprieteId}', body: body);
    if (!mounted) return;
    setState(() => _loading = false);
    if (r is ApiFail) {
      setState(() => _fail = r);
      return;
    }
    ref.invalidate(coproprieteProvider(ctx.coproprieteId));
    await ref.read(appStateProvider.notifier).reload();
    if (mounted) showToast(context, context.dict.parametres.enregistre);
  }

  int? _int(TextEditingController c) => c.text.trim().isEmpty ? null : int.tryParse(c.text.trim());

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final p = d.parametres;
    final t = Theme.of(context).textTheme;
    final copro = ref.watch(coproprieteProvider(ctx.coproprieteId));
    if (!_init && copro.valueOrNull != null) _fill(copro.valueOrNull!);
    Widget err(String s) => _section == s ? FormError(_fail) : const SizedBox.shrink();
    return SuPage(
      title: p.titre,
      subtitle: ctx.copropriete?.nom,
      onRefresh: () async => ref.invalidate(coproprieteProvider(ctx.coproprieteId)),
      children: [
        AsyncView(copro, onRetry: () => ref.invalidate(coproprieteProvider(ctx.coproprieteId)), data: (c) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SectionHeader(p.photos, subtitle: p.photosAide),
            _PhotosSection(copro: c),
            SectionHeader(p.identite),
            SuCard(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              SuField(label: p.nom, controller: _nom, error: fieldError(_fail, 'nom')),
              const SizedBox(height: 10),
              SuField(label: p.adresse, controller: _adresse, error: fieldError(_fail, 'adresse')),
              const SizedBox(height: 10),
              SuField(label: p.ville, controller: _ville, error: fieldError(_fail, 'ville')),
              const SizedBox(height: 10),
              KeyValueRow(p.typeResidence, d.enums.typeResidence[c.typeResidence] ?? c.typeResidence),
              SuField(label: p.nbLots, controller: _nbLots, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], textDirection: TextDirection.ltr, error: fieldError(_fail, 'nb_lots')),
              const SizedBox(height: 12),
              err('identite'),
              SubmitButton(label: d.common.save, loading: _loading && _section == 'identite', onPressed: () => _save('identite', {'nom': _nom.text.trim(), 'adresse': _adresse.text.trim(), 'ville': _ville.text.trim(), 'nb_lots': _int(_nbLots)})),
            ])),
            SectionHeader(p.reglement),
            SuCard(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              SuField(label: p.totalTantiemes, controller: _tantiemes, help: p.totalTantiemesAide, keyboardType: const TextInputType.numberWithOptions(decimal: true), inputFormatters: montantFormatters, textDirection: TextDirection.ltr, mono: true, error: fieldError(_fail, 'total_tantiemes')),
              const SizedBox(height: 12),
              err('reglement'),
              SubmitButton(label: d.common.save, loading: _loading && _section == 'reglement', onPressed: () => _save('reglement', {'total_tantiemes': _tantiemes.text.trim().isEmpty ? null : _tantiemes.text.trim()})),
            ])),
            SectionHeader(p.options),
            SuCard(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              SwitchListTile(contentPadding: EdgeInsets.zero, value: _locPv, onChanged: (v) => setState(() => _locPv = v), title: Text(p.optLocatairesPv, style: t.bodyMedium?.copyWith(color: SuColors.ink))),
              SwitchListTile(contentPadding: EdgeInsets.zero, value: _resaProprio, onChanged: (v) => setState(() => _resaProprio = v), title: Text(p.optReservationProprio, style: t.bodyMedium?.copyWith(color: SuColors.ink))),
              const SizedBox(height: 8),
              err('options'),
              SubmitButton(label: d.common.save, loading: _loading && _section == 'options', onPressed: () => _save('options', {'config_json': {...?c.configJson, 'locataire_voit_pv': _locPv, 'reservation_espaces_proprietaires_only': _resaProprio}})),
            ])),
            SectionHeader(p.recouvrement, subtitle: p.recouvrementAide),
            SuCard(child: Text(c.politiqueRecouvrementJson == null ? p.nonConfigure : c.politiqueRecouvrementJson!.entries.map((e) => '${e.key} : ${e.value}').join(' · '), style: t.bodySmall)),
            SectionHeader(p.legaux),
            SuBanner(tone: BannerTone.legal, body: p.legauxBanner),
            const SizedBox(height: 10),
            SuCard(border: SuColors.warnBorder, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              SuField(label: p.delaiConvocation, controller: _delai, help: p.delaiConvocationAide, hint: p.nonConfigure, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], textDirection: TextDirection.ltr, error: fieldError(_fail, 'delai_convocation_jours')),
              const SizedBox(height: 10),
              SuField(label: p.quorumPremiere, controller: _quorum, help: p.quorumPremiereAide, hint: '0.500', keyboardType: const TextInputType.numberWithOptions(decimal: true), textDirection: TextDirection.ltr, mono: true, error: fieldError(_fail, 'quorum_premiere_convocation')),
              const SizedBox(height: 10),
              SuField(label: p.limiteProcurations, controller: _limite, help: p.limiteProcurationsAide, hint: p.nonConfigure, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], textDirection: TextDirection.ltr, error: fieldError(_fail, 'limite_procurations_mandataire')),
              const SizedBox(height: 10),
              SuField(label: p.retention, controller: _retention, help: p.retentionAide, hint: p.nonConfigure, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], textDirection: TextDirection.ltr, error: fieldError(_fail, 'retention_desactivation_mois')),
              const SizedBox(height: 12),
              err('legaux'),
              SubmitButton(
                label: d.common.save,
                loading: _loading && _section == 'legaux',
                onPressed: () async {
                  final ok = await confirmDialog(context, title: p.legaux, body: p.legauxBanner, confirmLabel: d.common.save);
                  if (!ok) return;
                  _save('legaux', {
                    'delai_convocation_jours': _int(_delai),
                    'quorum_premiere_convocation': _quorum.text.trim().isEmpty ? null : _quorum.text.trim().replaceAll(',', '.'),
                    'limite_procurations_mandataire': _int(_limite),
                    'retention_desactivation_mois': _int(_retention),
                  });
                },
              ),
            ])),
            const SizedBox(height: 12),
            Text('${d.common.sinceDate.replaceAll('{date}', formatDateCourte(c.creeLe, context.locale))} · ${c.id}', style: t.labelSmall, textAlign: TextAlign.center),
          ],
        )),
      ],
    );
  }
}

/// Photos de la résidence (M20) — un emplacement par ligne (aperçu, où elle apparaît,
/// changer, retirer) puis une ligne par espace commun. Téléversement direct au stockage
/// (URL signée), puis PATCH de la carte `photos_json` fusionnée : un emplacement à la fois.
class _PhotosSection extends ConsumerStatefulWidget {
  const _PhotosSection({required this.copro});
  final Copropriete copro;
  @override
  ConsumerState<_PhotosSection> createState() => _PhotosSectionState();
}

class _PhotosSectionState extends ConsumerState<_PhotosSection> {
  String? _enCours;

  Map<String, String> get _photos => {for (final e in (widget.copro.photosJson ?? const {}).entries) if (e.value is String) e.key: e.value as String};

  Future<void> _patch(Map<String, String> photos) async {
    final api = ref.read(apiClientProvider);
    final r = await api.patch<dynamic>('/coproprietes/${widget.copro.id}', body: {'photos_json': photos.isEmpty ? null : photos});
    if (!mounted) return;
    if (r is ApiFail) {
      showToast(context, r.error.message, error: true);
      return;
    }
    ref.invalidate(coproPhotosProvider(widget.copro.id));
    ref.invalidate(coproprieteProvider(widget.copro.id));
    await ref.read(appStateProvider.notifier).reload();
  }

  Future<void> _changer(String cle) async {
    final f = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 2000, imageQuality: 85);
    if (f == null || !mounted) return;
    setState(() => _enCours = cle);
    final api = ref.read(apiClientProvider);
    final contentType = f.mimeType ?? (f.path.toLowerCase().endsWith('.png') ? 'image/png' : f.path.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg');
    final prep = await api.post<Map<String, dynamic>>('/coproprietes/${widget.copro.id}/photos/upload-url', body: {'cle': cle, 'nom_fichier': f.name, 'content_type': contentType}, parse: asMap);
    if (!mounted) return;
    if (prep is ApiFail<Map<String, dynamic>>) {
      setState(() => _enCours = null);
      showToast(context, prep.error.message, error: true);
      return;
    }
    final pr = (prep as ApiOk<Map<String, dynamic>>).data;
    final ok = await api.uploadSigned(pr['upload_url'] as String, await File(f.path).readAsBytes(), contentType);
    if (!mounted) return;
    if (!ok) {
      setState(() => _enCours = null);
      showToast(context, context.mdict.networkError, error: true);
      return;
    }
    await _patch({..._photos, cle: pr['storage_path'] as String});
    if (!mounted) return;
    setState(() => _enCours = null);
    showToast(context, context.dict.parametres.photoMiseAJour);
  }

  Future<void> _retirer(String cle) async {
    setState(() => _enCours = cle);
    await _patch({..._photos}..remove(cle));
    if (!mounted) return;
    setState(() => _enCours = null);
    showToast(context, context.dict.parametres.photoRetiree);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.dict.parametres;
    final espaces = ref.watch(espacesProvider).valueOrNull ?? const <EspaceCommun>[];
    final libelles = <String, (String, String)>{
      'accueil': (p.photoAccueil, p.photoAccueilAide),
      'entree': (p.photoEntree, p.photoEntreeAide),
      'cour': (p.photoCour, p.photoCourAide),
      'salle': (p.photoSalle, p.photoSalleAide),
      'piscine': (p.photoPiscine, p.photoPiscineAide),
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final cle in clesPhoto) _slot(cle, libelles[cle]!.$1, libelles[cle]!.$2, null),
        if (espaces.isNotEmpty) ...[
          SectionHeader(p.photosEspaces, subtitle: p.photosEspacesAide),
          for (final e in espaces) _slot('espace:${e.id}', e.nom, libelles[espacePhotoCle(e.nom, e.type)]!.$1, espacePhotoCle(e.nom, e.type)),
        ],
      ],
    );
  }

  Widget _slot(String cle, String titre, String aide, String? fallbackCle) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final perso = _photos.containsKey(cle);
    final busy = _enCours == cle;
    return SuCard(
      margin: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(borderRadius: BorderRadius.circular(SuRadius.row), child: SizedBox(width: 96, height: 64, child: CoproPhoto(cle, fallbackCle: fallbackCle))),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(titre, style: t.titleSmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text(aide, style: t.bodySmall, maxLines: 2, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 6),
                    StatusBadge(perso ? d.parametres.photoPersonnalisee : d.parametres.photoDefaut, variant: perso ? BadgeVariant.info : BadgeVariant.outline, small: true),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: OutlinedButton.icon(onPressed: busy ? null : () => _changer(cle), icon: busy ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.photo_library_rounded, size: 18), label: Text(perso ? context.mdict.photoChanger : d.parametres.logoChoisir))),
              if (perso) ...[
                const SizedBox(width: 8),
                TextButton(onPressed: busy ? null : () => _retirer(cle), style: TextButton.styleFrom(foregroundColor: SuColors.danger), child: Text(d.parametres.photoRetirer)),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
