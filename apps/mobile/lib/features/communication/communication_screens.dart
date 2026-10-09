import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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
import '../documents/document_viewer_screen.dart';

const _categories = ['INFORMATION', 'TRAVAUX', 'COUPURE', 'SECURITE', 'URGENCE', 'AG', 'CONVIVIALITE', 'REGLEMENT'];
const _audiences = ['TOUS', 'PROPRIETAIRES', 'OCCUPANTS', 'CONSEIL', 'BATIMENT'];

/// Markdown restreint (assaini côté API) → texte lisible : puces, gras retiré, liens en clair.
String texteAnnonce(String md) => md
    .replaceAllMapped(RegExp(r'\[([^\]]+)\]\(([^)]+)\)'), (m) => '${m[1]} (${m[2]})')
    .replaceAll(RegExp(r'\*\*([^*]+)\*\*'), r'$1')
    .replaceAllMapped(RegExp(r'\*\*([^*]+)\*\*'), (m) => m[1] ?? '')
    .replaceAllMapped(RegExp(r'\*([^*]+)\*'), (m) => m[1] ?? '')
    .replaceAllMapped(RegExp(r'^\s*[-+*]\s+', multiLine: true), (_) => '• ')
    .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'");

void _rafraichirAffichage(WidgetRef ref) {
  ref.invalidate(annoncesProvider);
  ref.invalidate(annoncesNonLuesProvider);
  ref.invalidate(sondagesProvider);
  ref.invalidate(contactsUtilesProvider);
}

/// Tableau d'affichage — annonces (épinglées d'abord, filtre catégorie), sondages, contacts utiles.
class AffichageScreen extends ConsumerStatefulWidget {
  const AffichageScreen({super.key});
  @override
  ConsumerState<AffichageScreen> createState() => _AffichageScreenState();
}

class _AffichageScreenState extends ConsumerState<AffichageScreen> {
  String? _categorie;
  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final c = d.communication;
    final e = d.enumsCommunication;
    final t = Theme.of(context).textTheme;
    final annonces = ref.watch(annoncesProvider(_categorie));
    final nonLues = ref.watch(annoncesNonLuesProvider).valueOrNull ?? 0;
    final sondages = ref.watch(sondagesProvider).valueOrNull ?? const <Sondage>[];
    final contacts = ref.watch(contactsUtilesProvider).valueOrNull ?? const <ContactUtile>[];
    final gestion = ctx.isGestion || ctx.isConseil;
    return SuPage(
      title: c.titre,
      subtitle: nonLues > 0 ? fill(c.nonLues, {'n': '$nonLues'}) : c.subtitle,
      onRefresh: () async => _rafraichirAffichage(ref),
      fab: gestion ? FloatingActionButton.extended(onPressed: () => showFormSheet<void>(context, title: c.nouvelle, builder: (_) => AnnonceComposer(onDone: () => _rafraichirAffichage(ref))), icon: const Icon(Icons.campaign_rounded), label: Text(c.nouvelle)) : null,
      children: [
        FilterChips<String?>(value: _categorie, options: [null, ..._categories], labelOf: (v) => v == null ? c.toutes : (e.categorieAnnonce[v] ?? v), onChanged: (v) => setState(() => _categorie = v)),
        const SizedBox(height: 12),
        SuFadeSwitch(value: _categorie, child: AsyncView(annonces, onRetry: () => ref.invalidate(annoncesProvider(_categorie)), data: (rows) {
          if (rows.isEmpty) return EmptyState(title: _categorie == null ? c.aucune : c.aucuneFiltre, hint: gestion && _categorie == null ? c.aucuneAide : null, icon: Icons.campaign_outlined, illustration: _categorie == null ? 'empty-annonces' : 'empty-search');
          // Affiche « à la une » : l'annonce épinglée publiée la plus récente (elle reste aussi dans la liste).
          final epinglees = rows.where((a) => a.epingle && a.statut == 'PUBLIEE').toList()..sort((a, b) => (b.publieLe ?? b.creeLe).compareTo(a.publieLe ?? a.creeLe));
          final une = epinglees.firstOrNull;
          return Column(children: [
            if (une != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: PosterCard(
                  color: SuColors.ink,
                  art: 'poster-annonce',
                  kicker: '${e.categorieAnnonce[une.categorie] ?? une.categorie} · ${c.epinglee}',
                  title: une.titre,
                  body: une.apercu.characters.length > 140 ? '${une.apercu.characters.take(140).toString().trimRight()}…' : une.apercu,
                  onTap: () => context.push('/affichage/${une.id}'),
                ),
              ),
            for (int i = 0; i < rows.length; i++) SuEnter(key: ValueKey(rows[i].id), index: i, child: Padding(padding: const EdgeInsets.only(bottom: 12), child: AnnonceCard(rows[i])))]);
        })),
        if (sondages.isNotEmpty) ...[
          SectionHeader(c.sondages, actionLabel: gestion ? c.nouveauSondage : null, onAction: gestion ? () => showFormSheet<void>(context, title: c.nouveauSondage, builder: (_) => SondageComposer(onDone: () => _rafraichirAffichage(ref))) : null),
          CardList([
            for (final s in sondages.take(5))
              ListRow(
                key: ValueKey(s.id),
                leading: IconCircle(Icons.poll_rounded, tone: s.statut == 'OUVERT' ? Tone.action : Tone.neutral),
                title: s.question,
                subtitle: s.statut == 'CLOS' ? fill(c.closLe, {'date': formatDateCourte(s.closLe ?? s.dateFin, l)}) : fill(c.finLe, {'date': formatDateHeure(s.dateFin, l)}),
                trailing: StatusBadge(s.maReponse != null ? c.dejaRepondu : (e.statutSondage[s.statut] ?? s.statut), variant: s.maReponse != null ? BadgeVariant.info : (sondageVariant[s.statut] ?? BadgeVariant.neutral), small: true),
                chevron: true,
                onTap: () => context.push('/affichage/sondages/${s.id}'),
              ),
          ]),
        ] else if (gestion) ...[
          SectionHeader(c.sondages, actionLabel: c.nouveauSondage, onAction: () => showFormSheet<void>(context, title: c.nouveauSondage, builder: (_) => SondageComposer(onDone: () => _rafraichirAffichage(ref)))),
          Text(c.aucunSondage, style: t.bodyMedium?.copyWith(color: SuColors.soft)),
        ],
        if (contacts.isNotEmpty) ...[
          SectionHeader(c.contacts, subtitle: c.contactsAide),
          CardList([
            for (final x in contacts)
              ListRow(
                key: ValueKey(x.id),
                leading: const IconCircle(Icons.call_rounded, tone: Tone.sage),
                title: x.libelle,
                subtitle: x.telephone,
                trailing: CircleIconButton(tooltip: c.appeler, icon: Icons.phone_forwarded_rounded, onTap: () => launchUrl(Uri.parse('tel:${x.telephone.replaceAll(RegExp(r'[^+0-9]'), '')}'))),
                onTap: () => launchUrl(Uri.parse('tel:${x.telephone.replaceAll(RegExp(r'[^+0-9]'), '')}')),
              ),
          ]),
        ],
      ],
    );
  }
}

class AnnonceCard extends StatelessWidget {
  const AnnonceCard(this.a, {super.key});
  final Annonce a;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final l = context.locale;
    final c = d.communication;
    final e = d.enumsCommunication;
    final t = Theme.of(context).textTheme;
    // Tuile Wise plate : pastille de catégorie, badges, titre gras, aperçu ardoise, méta.
    return SuCard(
      onTap: () => context.push('/affichage/${a.id}'),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        IconCircle(_iconeCategorie(a.categorie), tone: _toneCategorie(a.categorie)),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Wrap(spacing: 6, runSpacing: 6, children: [
              StatusBadge(e.categorieAnnonce[a.categorie] ?? a.categorie, variant: categorieAnnonceVariant[a.categorie] ?? BadgeVariant.neutral, small: true),
              if (a.epingle) StatusBadge(c.epinglee, variant: BadgeVariant.ink, small: true),
              if (a.statut != 'PUBLIEE') StatusBadge(e.statutAnnonce[a.statut] ?? a.statut, variant: annonceVariant[a.statut] ?? BadgeVariant.neutral, small: true),
              if (!a.lu && a.statut == 'PUBLIEE') StatusBadge(c.nonLue, variant: BadgeVariant.warn, small: true, pulse: true),
            ]),
            const SizedBox(height: 10),
            Text(a.titre, style: t.titleMedium?.copyWith(fontWeight: a.lu ? FontWeight.w600 : FontWeight.w700)),
            const SizedBox(height: 4),
            Text(a.apercu, style: t.bodyMedium?.copyWith(color: SuColors.soft, height: 1.4), maxLines: 3, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 8),
            Text('${a.publieLe != null ? formatDateHeure(a.publieLe, l) : formatDateHeure(a.creeLe, l)} · ${fill(c.par, {'nom': a.auteur.affichage})}${a.nbCommentaires > 0 ? ' · ${a.nbCommentaires} ${c.commentaires.toLowerCase()}' : ''}${a.nbLectures != null && a.statut == 'PUBLIEE' ? ' · ${c.lectures} ${a.nbLectures}' : ''}', style: t.bodySmall),
          ]),
        ),
      ]),
    );
  }
}

/// Pictogramme d'une catégorie d'annonce (pastilles de liste et de détail).
IconData _iconeCategorie(String categorie) => switch (categorie) {
      'TRAVAUX' => Icons.construction_rounded,
      'COUPURE' => Icons.power_off_rounded,
      'SECURITE' => Icons.shield_rounded,
      'URGENCE' => Icons.warning_rounded,
      'AG' => Icons.how_to_vote_rounded,
      'CONVIVIALITE' => Icons.celebration_rounded,
      'REGLEMENT' => Icons.gavel_rounded,
      _ => Icons.campaign_rounded,
    };

Tone _toneCategorie(String categorie) => switch (categorie) {
      'URGENCE' => Tone.danger,
      'COUPURE' || 'SECURITE' => Tone.warn,
      'TRAVAUX' => Tone.sand,
      'AG' => Tone.lilac,
      'CONVIVIALITE' => Tone.tosca,
      'REGLEMENT' => Tone.neutral,
      _ => Tone.sage,
    };

/// Détail d'une annonce — accusé de lecture automatique, pièces jointes, commentaires, modération / publication (gestion).
class AnnonceDetailScreen extends ConsumerStatefulWidget {
  const AnnonceDetailScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<AnnonceDetailScreen> createState() => _AnnonceDetailScreenState();
}

class _AnnonceDetailScreenState extends ConsumerState<AnnonceDetailScreen> {
  final _commentaire = TextEditingController();
  bool _envoi = false;
  bool _luEnvoye = false;
  ApiFail? _fail;

  Future<void> _marquerLue(Annonce a) async {
    if (_luEnvoye || a.lu || a.statut != 'PUBLIEE') return;
    _luEnvoye = true;
    await ref.read(apiClientProvider).post<dynamic>('/annonces/${a.id}/lu', body: const {});
    ref.invalidate(annoncesProvider);
    ref.invalidate(annoncesNonLuesProvider);
  }

  /// [corps] non nul : action majeure (publication) → écran de succès plein écran.
  Future<void> _action(String path, {Map<String, Object?> body = const {}, bool idempotent = false, String? succes, String? corps}) async {
    final r = await ref.read(apiClientProvider).post<dynamic>(path, body: body, idempotent: idempotent);
    if (!mounted) return;
    if (r is ApiFail) {
      showToast(context, r.error.message, error: true);
      return;
    }
    if (succes != null) {
      if (corps != null) {
        showSuccess(context, title: succes, body: corps, illustration: 'ok-general');
      } else {
        showToast(context, succes);
      }
    }
    ref.invalidate(annonceProvider(widget.id));
    _rafraichirAffichage(ref);
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final c = d.communication;
    final e = d.enumsCommunication;
    final t = Theme.of(context).textTheme;
    final annonce = ref.watch(annonceProvider(widget.id));
    final gestion = ctx.isGestion || ctx.isConseil;
    return SuPage(
      title: annonce.valueOrNull?.titre ?? c.titre,
      onRefresh: () async => ref.invalidate(annonceProvider(widget.id)),
      children: [
        AsyncView(
          annonce,
          onRetry: () => ref.invalidate(annonceProvider(widget.id)),
          data: (a) {
            WidgetsBinding.instance.addPostFrameCallback((_) => _marquerLue(a));
            final peutModifier = gestion && a.statut != 'ARCHIVEE' && (ctx.isGestion || a.categorie != 'URGENCE');
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // En-tête Wise : grande pastille de catégorie + statuts, puis la méta en ardoise.
                Row(children: [
                  IconCircle(_iconeCategorie(a.categorie), tone: _toneCategorie(a.categorie), size: 56),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Wrap(spacing: 6, runSpacing: 6, children: [
                      StatusBadge(e.categorieAnnonce[a.categorie] ?? a.categorie, variant: categorieAnnonceVariant[a.categorie] ?? BadgeVariant.neutral),
                      StatusBadge(e.statutAnnonce[a.statut] ?? a.statut, variant: annonceVariant[a.statut] ?? BadgeVariant.neutral),
                      if (a.epingle) StatusBadge(c.epinglee, variant: BadgeVariant.ink),
                    ]),
                  ),
                ]),
                const SizedBox(height: 14),
                Text('${a.publieLe != null ? (a.statut == 'BROUILLON' ? fill(c.programmeeLe, {'date': formatDateHeure(a.publieLe, l)}) : fill(c.publieeLe, {'date': formatDateHeure(a.publieLe, l)})) : formatDateHeure(a.creeLe, l)} · ${fill(c.par, {'nom': a.auteur.affichage})} · ${e.audience[a.audience] ?? a.audience}${a.batiment != null ? ' ${a.batiment}' : ''}', style: t.bodyMedium?.copyWith(color: SuColors.soft)),
                const SizedBox(height: 16),
                SuCard(padding: const EdgeInsets.all(20), child: SelectableText(texteAnnonce(a.contenu), style: t.bodyLarge?.copyWith(color: SuColors.ink, height: 1.55))),
                if (a.piecesJointes.isNotEmpty) ...[
                  SectionHeader(c.piecesJointes),
                  CardList([
                    for (final p in a.piecesJointes)
                      ListRow(leading: const IconCircle(Icons.attach_file_rounded, tone: Tone.neutral), title: '${p['nom']}', chevron: true, onTap: () => ouvrirVisionneuse(context, titre: '${p['nom']}', url: '${p['url']}')),
                  ]),
                ],
                if (gestion) ...[
                  SectionHeader(c.lectures, subtitle: c.lecteursAide),
                  SuCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    AnimatedFigureText(a.nbLectures != null && a.nbDestinataires != null ? fill(c.luPar, {'n': '${a.nbLectures}', 'total': '${a.nbDestinataires}'}) : '—', maxLines: null, style: t.headlineSmall),
                    if (a.nbDestinataires != null && a.nbDestinataires! > 0) ...[const SizedBox(height: 12), Gauge((a.nbLectures ?? 0) / a.nbDestinataires!)],
                  ])),
                  if (peutModifier) Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      if (a.statut == 'BROUILLON') SuButton(onPressed: () async {
                        if (await confirmDialog(context, title: c.publierTitre, body: c.publierCorps, confirmLabel: c.publier)) await _action('/annonces/${a.id}/publier', idempotent: true, succes: c.enregistree, corps: c.publierCorps);
                      }, icon: Icons.send_rounded, label: c.publier),
                      if (a.statut == 'PUBLIEE') SuButton(variant: SuButtonVariant.secondary, onPressed: () async {
                        if (await confirmDialog(context, title: c.archiver, body: c.archiverCorps, danger: true)) await _action('/annonces/${a.id}/archiver', succes: c.archivee);
                      }, icon: Icons.archive_outlined, label: c.archiver),
                    ]),
                  ),
                ],
                SectionHeader(c.commentaires, subtitle: a.commentaires.isNotEmpty ? '${a.commentaires.length}' : null),
                if (a.commentaires.isEmpty) Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(c.aucunCommentaire, style: t.bodyMedium?.copyWith(color: SuColors.soft))),
                for (final k in a.commentaires)
                  Opacity(
                    opacity: k.masque ? 0.6 : 1,
                    child: SuCard(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Avatar(k.auteur.affichage, size: 36),
                          const SizedBox(width: 10),
                          Expanded(child: Text(k.auteur.affichage, style: t.titleSmall)),
                          Text(formatDateHeure(k.creeLe, l), style: t.bodySmall),
                        ]),
                        if (k.masque) Padding(padding: const EdgeInsets.only(top: 6), child: Text(c.masque, style: t.bodySmall?.copyWith(color: SuColors.danger))),
                        const SizedBox(height: 8),
                        Text(texteAnnonce(k.contenu), style: t.bodyMedium?.copyWith(color: SuColors.ink)),
                        if (ctx.isGestion && !k.masque) Align(alignment: AlignmentDirectional.centerEnd, child: LinkButton(c.masquer, color: SuColors.danger, onTap: () => _action('/annonces/${a.id}/commentaires/${k.id}/masquer'))),
                      ]),
                    ),
                  ),
                if (a.statut == 'PUBLIEE' && a.commentairesActives) ...[
                  const SizedBox(height: 12),
                  SuField(label: c.votreCommentaire, controller: _commentaire, maxLines: 3, maxLength: 2000, error: fieldError(_fail, 'contenu')),
                  const SizedBox(height: 8),
                  FormError(_fail),
                  if (_fail != null) const SizedBox(height: 12),
                  SubmitButton(label: c.commenter, icon: Icons.send_rounded, loading: _envoi, fail: _fail, onPressed: () async {
                    if (_commentaire.text.trim().isEmpty) return;
                    setState(() { _envoi = true; _fail = null; });
                    final r = await ref.read(apiClientProvider).post<dynamic>('/annonces/${a.id}/commentaires', body: {'contenu': _commentaire.text.trim()});
                    if (!context.mounted) return;
                    setState(() => _envoi = false);
                    if (r is ApiFail) { setState(() => _fail = r); return; }
                    _commentaire.clear();
                    showToast(context, c.commentaireEnvoye);
                    ref.invalidate(annonceProvider(widget.id));
                    ref.invalidate(annoncesProvider);
                  }),
                ] else Padding(padding: const EdgeInsets.only(top: 8), child: Text(c.commentairesDesactives, style: t.bodySmall)),
              ],
            );
          },
        ),
      ],
    );
  }
}

/// Composer d'annonce (syndic / conseil) — audience, catégorie, épingle, publication immédiate ou différée. Pièces jointes : web (parité).
class AnnonceComposer extends ConsumerStatefulWidget {
  const AnnonceComposer({super.key, required this.onDone});
  final VoidCallback onDone;
  @override
  ConsumerState<AnnonceComposer> createState() => _AnnonceComposerState();
}

class _AnnonceComposerState extends ConsumerState<AnnonceComposer> {
  final _titre = TextEditingController();
  final _contenu = TextEditingController();
  final _batiment = TextEditingController();
  String _categorie = 'INFORMATION';
  String _audience = 'TOUS';
  bool _epingle = false;
  bool _commentaires = true;
  DateTime? _programme;
  bool _loading = false;
  ApiFail? _fail;

  Future<void> _envoyer({required bool publier}) async {
    setState(() { _loading = true; _fail = null; });
    final api = ref.read(apiClientProvider);
    final r = await api.post<Map<String, dynamic>>('/annonces', parse: asMap, body: {
      'titre': _titre.text.trim(), 'contenu': _contenu.text.trim(), 'categorie': _categorie, 'audience': _audience,
      if (_audience == 'BATIMENT') 'batiment': _batiment.text.trim(), 'epingle': _epingle, 'commentaires_actives': _commentaires,
    });
    if (!mounted) return;
    if (r is ApiFail<Map<String, dynamic>>) { setState(() { _loading = false; _fail = r; }); return; }
    final id = (r as ApiOk<Map<String, dynamic>>).data['id'] as String;
    if (publier) {
      final p = await api.post<dynamic>('/annonces/$id/publier', idempotent: true, body: {if (_programme != null) 'publie_le': _programme!.toUtc().toIso8601String()});
      if (!mounted) return;
      if (p is ApiFail) { setState(() { _loading = false; _fail = p; }); return; }
    }
    widget.onDone();
    if (!context.mounted) return;
    final c = context.dict.communication;
    if (!publier) {
      Navigator.pop(context);
      showToast(context, c.enregistree);
      context.push('/affichage/$id');
      return;
    }
    // Publication (immédiate ou programmée) : succès plein écran posé sur la fiche ouverte.
    final root = Navigator.of(context, rootNavigator: true).context;
    final router = GoRouter.of(context);
    final corps = _programme != null ? fill(c.programmeeLe, {'date': formatDateHeure(_programme!.toIso8601String(), context.locale)}) : c.publierCorps;
    Navigator.pop(context);
    router.push('/affichage/$id');
    showSuccess(root, title: _programme != null ? c.programmee : c.enregistree, body: corps, illustration: 'ok-general');
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final c = d.communication;
    final e = d.enumsCommunication;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(c.nouvelleAide, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: SuColors.soft)),
      const SizedBox(height: 16),
      SuField(label: c.titreChamp, controller: _titre, required: true, maxLength: 200, error: fieldError(_fail, 'titre')),
      const SizedBox(height: 12),
      SuSelect<String>(label: c.categorie, value: _categorie, options: _categories.where((k) => ctx.isGestion || k != 'URGENCE').toList(), labelOf: (v) => e.categorieAnnonce[v] ?? v, onChanged: (v) => setState(() => _categorie = v)),
      const SizedBox(height: 12),
      SuSelect<String>(label: c.audience, value: _audience, options: _audiences, labelOf: (v) => e.audience[v] ?? v, onChanged: (v) => setState(() => _audience = v), help: c.audienceAide),
      if (_audience == 'BATIMENT') ...[const SizedBox(height: 12), SuField(label: c.batiment, controller: _batiment, required: true, help: c.batimentAide, error: fieldError(_fail, 'batiment'))],
      const SizedBox(height: 12),
      SuField(label: c.contenu, controller: _contenu, required: true, maxLines: 6, maxLength: 20000, help: c.contenuAide, error: fieldError(_fail, 'contenu')),
      const SizedBox(height: 8),
      SuCheckbox(value: _epingle, onChanged: (v) => setState(() => _epingle = v), label: c.epingler),
      SuCheckbox(value: _commentaires, onChanged: (v) => setState(() => _commentaires = v), label: c.commentairesActives),
      const SizedBox(height: 12),
      // Moment de publication : tuile Wise (pastille, libellé, lien « Programmer »).
      SuCard(
        padding: const EdgeInsetsDirectional.fromSTEB(14, 10, 8, 10),
        child: Row(children: [
          IconCircle(Icons.schedule_rounded, tone: _programme == null ? Tone.neutral : Tone.sage),
          const SizedBox(width: 12),
          Expanded(child: Text(_programme == null ? c.publierMaintenant : fill(c.programmeeLe, {'date': formatDateHeure(_programme!.toIso8601String(), l)}), style: Theme.of(context).textTheme.titleSmall)),
          LinkButton(_programme == null ? c.programmer : d.common.modify, onTap: () async {
            final now = DateTime.now();
            final jour = await showDatePicker(context: context, initialDate: now.add(const Duration(days: 1)), firstDate: now, lastDate: now.add(const Duration(days: 365)), locale: l);
            if (jour == null || !context.mounted) return;
            final heure = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 9, minute: 0));
            if (heure == null) return;
            setState(() => _programme = DateTime(jour.year, jour.month, jour.day, heure.hour, heure.minute));
          }),
          if (_programme != null)
            CircleIconButton(icon: Icons.close_rounded, size: 40, color: SuColors.surface, tooltip: MaterialLocalizations.of(context).closeButtonTooltip, onTap: () => setState(() => _programme = null)),
        ]),
      ),
      const SizedBox(height: 16),
      FormError(_fail),
      if (_fail != null) const SizedBox(height: 12),
      SubmitButton(label: _programme == null ? c.publierMaintenant : c.programmer, loading: _loading, fail: _fail, onPressed: () => _envoyer(publier: true)),
      const SizedBox(height: 8),
      SubmitButton(label: c.enregistrerBrouillon, secondary: true, onPressed: _loading ? null : () => _envoyer(publier: false)),
    ]);
  }
}

/// Sondage consultatif — répondre, résultats agrégés (barres), ouverture / clôture (gestion).
class SondageScreen extends ConsumerStatefulWidget {
  const SondageScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<SondageScreen> createState() => _SondageScreenState();
}

class _SondageScreenState extends ConsumerState<SondageScreen> {
  final Set<String> _choix = {};
  bool _envoi = false;

  Future<void> _transition(String action, String succes) async {
    final r = await ref.read(apiClientProvider).post<dynamic>('/sondages/${widget.id}/$action', body: const {}, idempotent: true);
    if (!mounted) return;
    if (r is ApiFail) { showToast(context, r.error.message, error: true); return; }
    showToast(context, succes);
    ref.invalidate(sondageProvider(widget.id));
    _rafraichirAffichage(ref);
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final c = d.communication;
    final e = d.enumsCommunication;
    final t = Theme.of(context).textTheme;
    final sondage = ref.watch(sondageProvider(widget.id));
    final gestion = ctx.isGestion || ctx.isConseil;
    return SuPage(
      title: c.sondage,
      onRefresh: () async => ref.invalidate(sondageProvider(widget.id)),
      children: [
        AsyncView(
          sondage,
          onRetry: () => ref.invalidate(sondageProvider(widget.id)),
          data: (s) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Synthèse Wise : grande pastille, statuts, la question en grand, l'échéance.
              Row(children: [
                IconCircle(Icons.poll_rounded, tone: s.statut == 'OUVERT' ? Tone.action : Tone.neutral, size: 56),
                const SizedBox(width: 14),
                Expanded(child: Wrap(spacing: 6, runSpacing: 6, children: [StatusBadge(e.statutSondage[s.statut] ?? s.statut, variant: sondageVariant[s.statut] ?? BadgeVariant.neutral), if (s.maReponse != null) StatusBadge(c.dejaRepondu, variant: BadgeVariant.info)])),
              ]),
              const SizedBox(height: 16),
              Text(s.question, style: t.headlineMedium),
              const SizedBox(height: 6),
              Text('${s.statut == 'CLOS' ? fill(c.closLe, {'date': formatDateHeure(s.closLe ?? s.dateFin, l)}) : fill(c.finLe, {'date': formatDateHeure(s.dateFin, l)})} · ${e.audience[s.audience] ?? s.audience}', style: t.bodyMedium?.copyWith(color: SuColors.soft)),
              const SizedBox(height: 16),
              SuBanner(tone: BannerTone.info, body: c.mention),
              if (s.description != null && s.description!.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: SuCard(child: Text(texteAnnonce(s.description!), style: t.bodyLarge?.copyWith(color: SuColors.ink)))),
              if (gestion && (s.statut == 'BROUILLON' || s.statut == 'OUVERT')) Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  if (s.statut == 'BROUILLON') SuButton(onPressed: () async { if (await confirmDialog(context, title: c.ouvrir, body: c.ouvrirCorps)) await _transition('ouvrir', c.ouvert); }, icon: Icons.play_arrow_rounded, label: c.ouvrir),
                  if (s.statut == 'OUVERT') SuButton(variant: SuButtonVariant.secondary, onPressed: () async { if (await confirmDialog(context, title: c.clore, body: c.cloreCorps, danger: true)) await _transition('clore', c.clos); }, icon: Icons.stop_circle_outlined, label: c.clore),
                ]),
              ),
              SectionHeader(s.maReponse != null || !s.ouvertEncore ? c.resultats : c.repondre, subtitle: s.choixMultiple ? c.choixMultiple : null),
              if (s.ouvertEncore && s.maReponse == null) ...[
                // Options en pills blanches sélectionnables (case ou bouton radio selon le mode).
                for (final o in s.options)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _OptionSondage(
                      label: o.libelle,
                      multiple: s.choixMultiple,
                      selected: _choix.contains(o.id),
                      onTap: () => setState(() {
                        if (s.choixMultiple) {
                          _choix.contains(o.id) ? _choix.remove(o.id) : _choix.add(o.id);
                        } else {
                          _choix
                            ..clear()
                            ..add(o.id);
                        }
                      }),
                    ),
                  ),
                const SizedBox(height: 8),
                SubmitButton(label: c.repondre, loading: _envoi, onPressed: _choix.isEmpty ? null : () async {
                  setState(() => _envoi = true);
                  final r = await ref.read(apiClientProvider).post<dynamic>('/sondages/${s.id}/repondre', body: {'choix': _choix.toList()}, idempotent: true);
                  if (!context.mounted) return;
                  setState(() => _envoi = false);
                  if (r is ApiFail) { showToast(context, r.error.message, error: true); return; }
                  ref.invalidate(sondageProvider(widget.id));
                  ref.invalidate(sondagesProvider);
                  // Réponse délibérée et unique : succès plein écran.
                  showSuccess(context, title: c.reponseEnvoyee, body: s.question, illustration: 'ok-vote');
                }),
              ]
              else if (s.resultats == null) Text(c.resultatsApres, style: t.bodyMedium?.copyWith(color: SuColors.soft))
              else SuCard(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text('${fill(c.reponses, {'n': '${s.resultats!.nbReponses}', 'total': '${s.resultats!.nbDestinataires}'})}${s.resultats!.ponderationTantiemes ? ' · ${fill(c.tantiemesExprimes, {'n': s.resultats!.tantiemesExprimes})}' : ''}', style: t.bodyMedium?.copyWith(color: SuColors.soft)),
                const SizedBox(height: 14),
                for (final o in s.resultats!.options) ...[
                  Row(children: [
                    Expanded(child: Text(o.libelle, style: t.titleSmall)),
                    if (s.maReponse?.contains(o.id) ?? false) const Padding(padding: EdgeInsetsDirectional.only(end: 6), child: Icon(Icons.check_circle_rounded, size: 18, color: SuColors.link)),
                    AnimatedFigureText('${o.nb} · ${o.pourcentage} %', tint: false, textDirection: TextDirection.ltr, style: t.bodyMedium?.copyWith(color: SuColors.ink, fontWeight: FontWeight.w600, fontFeatures: const [FontFeature.tabularFigures()])),
                  ]),
                  const SizedBox(height: 6),
                  Gauge(o.pourcentage / 100, color: SuColors.link),
                  if (s.resultats!.ponderationTantiemes) ...[const SizedBox(height: 4), Gauge(o.pourcentageTantiemes / 100, height: 5, color: SuColors.ink), const SizedBox(height: 2), Text('${c.parTantiemes} · ${o.pourcentageTantiemes} %', style: t.bodySmall)],
                  const SizedBox(height: 14),
                ],
                Text(c.mention, style: t.bodySmall),
              ])),
            ],
          ),
        ),
      ],
    );
  }
}

/// Option de sondage : pill blanche, case/bouton radio vert profond, sélection = teinte sauge.
class _OptionSondage extends StatelessWidget {
  const _OptionSondage({required this.label, required this.multiple, required this.selected, required this.onTap});
  final String label;
  final bool multiple, selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final icon = multiple
        ? (selected ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded)
        : (selected ? Icons.radio_button_checked_rounded : Icons.radio_button_unchecked_rounded);
    return Semantics(
      button: true,
      selected: selected,
      child: SuTap(
        scale: 0.98,
        ink: false,
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Material(
          color: selected ? SuColors.sageTint : SuColors.tile,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: BorderSide(color: selected ? SuColors.link : Colors.transparent, width: 1.5)),
          clipBehavior: Clip.antiAlias,
          child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              child: Row(children: [
                Icon(icon, color: selected ? SuColors.link : SuColors.faint, size: 24),
                const SizedBox(width: 12),
                Expanded(child: Text(label, style: Theme.of(context).textTheme.titleMedium)),
              ]),
          ),
        ),
      ),
    );
  }
}

/// Création d'un sondage (syndic / conseil) — 2 à 10 options, audience, date de fin, ouverture immédiate.
class SondageComposer extends ConsumerStatefulWidget {
  const SondageComposer({super.key, required this.onDone});
  final VoidCallback onDone;
  @override
  ConsumerState<SondageComposer> createState() => _SondageComposerState();
}

class _SondageComposerState extends ConsumerState<SondageComposer> {
  final _question = TextEditingController();
  final _description = TextEditingController();
  final _batiment = TextEditingController();
  final List<TextEditingController> _options = [TextEditingController(), TextEditingController(), TextEditingController()];
  String _audience = 'TOUS';
  bool _multiple = false;
  bool _ponderation = false;
  DateTime _fin = DateTime.now().add(const Duration(days: 7));
  bool _loading = false;
  ApiFail? _fail;

  Future<void> _envoyer({required bool ouvrir}) async {
    setState(() { _loading = true; _fail = null; });
    final api = ref.read(apiClientProvider);
    final options = _options.map((c) => c.text.trim()).where((x) => x.isNotEmpty).toList();
    final r = await api.post<Map<String, dynamic>>('/sondages', parse: asMap, body: {
      'question': _question.text.trim(), if (_description.text.trim().isNotEmpty) 'description': _description.text.trim(),
      'options': [for (var i = 0; i < options.length; i++) {'id': 'opt${i + 1}', 'libelle': options[i]}],
      'choix_multiple': _multiple, 'audience': _audience, if (_audience == 'BATIMENT') 'batiment': _batiment.text.trim(),
      'ponderation_tantiemes': _ponderation, 'date_fin': _fin.toUtc().toIso8601String(),
    });
    if (!mounted) return;
    if (r is ApiFail<Map<String, dynamic>>) { setState(() { _loading = false; _fail = r; }); return; }
    final id = (r as ApiOk<Map<String, dynamic>>).data['id'] as String;
    if (ouvrir) {
      final o = await api.post<dynamic>('/sondages/$id/ouvrir', idempotent: true, body: const {});
      if (!mounted) return;
      if (o is ApiFail) { setState(() { _loading = false; _fail = o; }); return; }
    }
    widget.onDone();
    if (!context.mounted) return;
    final c = context.dict.communication;
    if (!ouvrir) {
      Navigator.pop(context);
      showToast(context, c.sondageEnregistre);
      context.push('/affichage/sondages/$id');
      return;
    }
    // Sondage ouvert (création majeure) : succès plein écran posé sur la fiche ouverte.
    final root = Navigator.of(context, rootNavigator: true).context;
    final router = GoRouter.of(context);
    Navigator.pop(context);
    router.push('/affichage/sondages/$id');
    showSuccess(root, title: c.ouvert, body: c.ouvrirCorps, illustration: 'ok-general');
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final l = context.locale;
    final c = d.communication;
    final e = d.enumsCommunication;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SuBanner(tone: BannerTone.info, body: c.mention),
      const SizedBox(height: 12),
      SuField(label: c.question, controller: _question, required: true, maxLength: 300, error: fieldError(_fail, 'question')),
      const SizedBox(height: 12),
      SuField(label: c.description, controller: _description, maxLines: 3, maxLength: 4000, optionalLabel: d.common.optional),
      const SizedBox(height: 12),
      Text(c.options, style: Theme.of(context).textTheme.labelMedium?.copyWith(color: SuColors.ink)),
      for (var i = 0; i < _options.length; i++) Padding(padding: const EdgeInsets.only(top: 8), child: SuField(label: fill(c.option, {'n': '${i + 1}'}), controller: _options[i], required: i < 2, maxLength: 200)),
      if (_options.length < 10) Align(alignment: AlignmentDirectional.centerStart, child: SuButton(variant: SuButtonVariant.ghost, onPressed: () => setState(() => _options.add(TextEditingController())), icon: Icons.add_rounded, label: fill(c.option, {'n': '${_options.length + 1}'}))),
      const SizedBox(height: 8),
      SuSelect<String>(label: c.audience, value: _audience, options: _audiences, labelOf: (v) => e.audience[v] ?? v, onChanged: (v) => setState(() => _audience = v)),
      if (_audience == 'BATIMENT') ...[const SizedBox(height: 12), SuField(label: c.batiment, controller: _batiment, required: true, error: fieldError(_fail, 'batiment'))],
      const SizedBox(height: 12),
      // Date de fin : tuile Wise (pastille, libellé + date, lien « Modifier »).
      SuCard(
        padding: const EdgeInsetsDirectional.fromSTEB(14, 10, 8, 10),
        child: Row(children: [
          const IconCircle(Icons.event_rounded, tone: Tone.neutral),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(c.dateFin, style: Theme.of(context).textTheme.bodySmall),
              Text(formatDateHeure(_fin.toIso8601String(), l), style: Theme.of(context).textTheme.titleSmall),
            ]),
          ),
          LinkButton(d.common.modify, onTap: () async {
            final jour = await showDatePicker(context: context, initialDate: _fin, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)), locale: l);
            if (jour == null) return;
            setState(() => _fin = DateTime(jour.year, jour.month, jour.day, 18));
          }),
        ]),
      ),
      const SizedBox(height: 8),
      SuCheckbox(value: _multiple, onChanged: (v) => setState(() => _multiple = v), label: c.choixMultiple),
      SuCheckbox(value: _ponderation, onChanged: (v) => setState(() => _ponderation = v), label: c.ponderation, help: c.ponderationAide),
      const SizedBox(height: 12),
      FormError(_fail),
      if (_fail != null) const SizedBox(height: 12),
      SubmitButton(label: c.ouvrir, loading: _loading, fail: _fail, onPressed: () => _envoyer(ouvrir: true)),
      const SizedBox(height: 8),
      SubmitButton(label: c.enregistrerBrouillon, secondary: true, onPressed: _loading ? null : () => _envoyer(ouvrir: false)),
    ]);
  }
}

/// Préférences de notification (profil) — digest hebdomadaire, canal, push des annonces.
class PreferencesNotificationSheet extends ConsumerStatefulWidget {
  const PreferencesNotificationSheet({super.key, required this.initial});
  final PreferencesNotification initial;
  @override
  ConsumerState<PreferencesNotificationSheet> createState() => _PreferencesNotificationSheetState();
}

class _PreferencesNotificationSheetState extends ConsumerState<PreferencesNotificationSheet> {
  late bool _digest = widget.initial.digestHebdo;
  late String _canal = widget.initial.canalDigest;
  late bool _push = widget.initial.annoncesPush;
  late bool _pushNormal = widget.initial.pushNormal;
  late bool _pushInfo = widget.initial.pushInfo;
  late bool _pushSon = widget.initial.pushSon;
  late bool _calmes = widget.initial.heuresCalmes != null;
  late String _calmesDebut = widget.initial.heuresCalmes?.debut ?? '22:00';
  late String _calmesFin = widget.initial.heuresCalmes?.fin ?? '07:00';
  bool _loading = false;
  ApiFail? _fail;

  Future<void> _choisirHeure(bool debut) async {
    final actuel = debut ? _calmesDebut : _calmesFin;
    final parts = actuel.split(':');
    final t = await showTimePicker(context: context, initialTime: TimeOfDay(hour: int.tryParse(parts[0]) ?? 22, minute: int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0));
    if (t == null) return;
    final v = '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
    setState(() => debut ? _calmesDebut = v : _calmesFin = v);
  }
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final c = d.communication;
    final e = d.enumsCommunication;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(c.preferencesAide, style: Theme.of(context).textTheme.bodySmall),
      const SizedBox(height: 8),
      SuCheckbox(value: _digest, onChanged: (v) => setState(() => _digest = v), label: c.digestHebdo, help: c.digestHebdoAide),
      const SizedBox(height: 8),
      SuSelect<String>(label: c.canalDigest, value: _canal, options: const ['EMAIL', 'PUSH', 'SMS', 'AUCUN'], labelOf: (v) => e.canalPreference[v] ?? v, onChanged: (v) => setState(() => _canal = v)),
      const SizedBox(height: 8),
      SuCheckbox(value: _push, onChanged: (v) => setState(() => _push = v), label: c.annoncesPush, help: c.annoncesPushAide),
      const SizedBox(height: 14),
      // Push sur le téléphone — niveaux (bannières, alertes, écran verrouillé) ; URGENT toujours livré.
      SectionHeader(c.pushTitre, subtitle: c.pushAide),
      SuCheckbox(value: _pushNormal, onChanged: (v) => setState(() => _pushNormal = v), label: c.pushNormal, help: c.pushNormalAide),
      const SizedBox(height: 8),
      SuCheckbox(value: _pushInfo, onChanged: (v) => setState(() => _pushInfo = v), label: c.pushInfo, help: c.pushInfoAide),
      const SizedBox(height: 8),
      SuCheckbox(value: _pushSon, onChanged: (v) => setState(() => _pushSon = v), label: c.pushSon, help: c.pushSonAide),
      const SizedBox(height: 8),
      SuCheckbox(value: _calmes, onChanged: (v) => setState(() => _calmes = v), label: c.heuresCalmes, help: c.heuresCalmesAide),
      if (_calmes) ...[
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: SuButton(variant: SuButtonVariant.secondary, onPressed: () => _choisirHeure(true), icon: Icons.bedtime_outlined, label: '${c.heuresCalmesDebut} · $_calmesDebut')),
          const SizedBox(width: 8),
          Expanded(child: SuButton(variant: SuButtonVariant.secondary, onPressed: () => _choisirHeure(false), icon: Icons.wb_sunny_outlined, label: '${c.heuresCalmesFin} · $_calmesFin')),
        ]),
      ],
      const SizedBox(height: 12),
      FormError(_fail),
      if (_fail != null) const SizedBox(height: 12),
      SubmitButton(label: d.common.save, loading: _loading, fail: _fail, onPressed: () async {
        setState(() { _loading = true; _fail = null; });
        final r = await ref.read(apiClientProvider).request<dynamic>('PUT', '/users/me/preferences-notification', body: PreferencesNotification(digestHebdo: _digest, canalDigest: _canal, annoncesPush: _push, pushNormal: _pushNormal, pushInfo: _pushInfo, pushSon: _pushSon, heuresCalmes: _calmes ? HeuresCalmes(debut: _calmesDebut, fin: _calmesFin) : null).toJson());
        if (!mounted) return;
        if (r is ApiFail) { setState(() { _loading = false; _fail = r; }); return; }
        ref.invalidate(preferencesNotificationProvider);
        if (!context.mounted) return;
        Navigator.pop(context);
        showToast(context, c.preferencesEnregistrees);
      }),
    ]);
  }
}
