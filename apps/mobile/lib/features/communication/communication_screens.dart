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
      fab: gestion ? FloatingActionButton.extended(onPressed: () => showFormSheet<void>(context, title: c.nouvelle, builder: (_) => AnnonceComposer(onDone: () => _rafraichirAffichage(ref))), backgroundColor: SuColors.ink, foregroundColor: Colors.white, icon: const Icon(Icons.campaign_rounded), label: Text(c.nouvelle)) : null,
      children: [
        FilterChips<String?>(value: _categorie, options: [null, ..._categories], labelOf: (v) => v == null ? c.toutes : (e.categorieAnnonce[v] ?? v), onChanged: (v) => setState(() => _categorie = v)),
        const SizedBox(height: 12),
        AsyncView(annonces, onRetry: () => ref.invalidate(annoncesProvider(_categorie)), data: (rows) {
          if (rows.isEmpty) return EmptyState(title: _categorie == null ? c.aucune : c.aucuneFiltre, hint: gestion && _categorie == null ? c.aucuneAide : null, icon: Icons.campaign_outlined);
          return Column(children: [for (final a in rows) Padding(padding: const EdgeInsets.only(bottom: 10), child: AnnonceCard(a))]);
        }),
        if (sondages.isNotEmpty) ...[
          SectionHeader(c.sondages, actionLabel: gestion ? c.nouveauSondage : null, onAction: gestion ? () => showFormSheet<void>(context, title: c.nouveauSondage, builder: (_) => SondageComposer(onDone: () => _rafraichirAffichage(ref))) : null),
          CardList([
            for (final s in sondages.take(5))
              ListRow(
                leading: IconCircle(Icons.poll_rounded, tone: s.statut == 'OUVERT' ? Tone.action : Tone.neutral, size: 40),
                title: s.question,
                subtitle: s.statut == 'CLOS' ? fill(c.closLe, {'date': formatDateCourte(s.closLe ?? s.dateFin, l)}) : fill(c.finLe, {'date': formatDateHeure(s.dateFin, l)}),
                trailing: StatusBadge(s.maReponse != null ? c.dejaRepondu : (e.statutSondage[s.statut] ?? s.statut), variant: s.maReponse != null ? BadgeVariant.info : (sondageVariant[s.statut] ?? BadgeVariant.neutral), small: true),
                chevron: true,
                onTap: () => context.push('/affichage/sondages/${s.id}'),
              ),
          ]),
        ] else if (gestion) ...[
          SectionHeader(c.sondages, actionLabel: c.nouveauSondage, onAction: () => showFormSheet<void>(context, title: c.nouveauSondage, builder: (_) => SondageComposer(onDone: () => _rafraichirAffichage(ref)))),
          SuCard(child: Text(c.aucunSondage, style: t.bodySmall)),
        ],
        if (contacts.isNotEmpty) ...[
          SectionHeader(c.contacts, subtitle: c.contactsAide),
          CardList([
            for (final x in contacts)
              ListRow(
                leading: const IconCircle(Icons.call_rounded, tone: Tone.sage, size: 40),
                title: x.libelle,
                subtitle: x.telephone,
                trailing: IconButton(tooltip: c.appeler, icon: const Icon(Icons.phone_forwarded_rounded, color: SuColors.action), onPressed: () => launchUrl(Uri.parse('tel:${x.telephone.replaceAll(RegExp(r'[^+0-9]'), '')}'))),
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
    return SuCard(
      onTap: () => context.push('/affichage/${a.id}'),
      border: !a.lu && a.statut == 'PUBLIEE' ? SuColors.actionBorder : null,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Wrap(spacing: 6, runSpacing: 6, children: [
          StatusBadge(e.categorieAnnonce[a.categorie] ?? a.categorie, variant: categorieAnnonceVariant[a.categorie] ?? BadgeVariant.neutral, small: true),
          if (a.epingle) StatusBadge(c.epinglee, variant: BadgeVariant.ink, small: true),
          if (a.statut != 'PUBLIEE') StatusBadge(e.statutAnnonce[a.statut] ?? a.statut, variant: annonceVariant[a.statut] ?? BadgeVariant.neutral, small: true),
          if (!a.lu && a.statut == 'PUBLIEE') StatusBadge(c.nonLue, variant: BadgeVariant.warn, small: true),
        ]),
        const SizedBox(height: 8),
        Text(a.titre, style: t.titleMedium?.copyWith(fontWeight: a.lu ? FontWeight.w600 : FontWeight.w700)),
        const SizedBox(height: 4),
        Text(a.apercu, style: t.bodyMedium, maxLines: 3, overflow: TextOverflow.ellipsis),
        const SizedBox(height: 6),
        Text('${a.publieLe != null ? formatDateHeure(a.publieLe, l) : formatDateHeure(a.creeLe, l)} · ${fill(c.par, {'nom': a.auteur.affichage})}${a.nbCommentaires > 0 ? ' · ${a.nbCommentaires} ${c.commentaires.toLowerCase()}' : ''}${a.nbLectures != null && a.statut == 'PUBLIEE' ? ' · ${c.lectures} ${a.nbLectures}' : ''}', style: t.bodySmall),
      ]),
    );
  }
}

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

  Future<void> _action(String path, {Map<String, Object?> body = const {}, bool idempotent = false, String? succes}) async {
    final r = await ref.read(apiClientProvider).post<dynamic>(path, body: body, idempotent: idempotent);
    if (!mounted) return;
    if (r is ApiFail) {
      showToast(context, r.error.message, error: true);
      return;
    }
    if (succes != null) showToast(context, succes);
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
    return Scaffold(
      appBar: AppBar(title: Text(annonce.valueOrNull?.titre ?? c.titre)),
      body: AsyncView(
        annonce,
        onRetry: () => ref.invalidate(annonceProvider(widget.id)),
        loading: const Padding(padding: EdgeInsets.all(16), child: LoadingList()),
        data: (a) {
          WidgetsBinding.instance.addPostFrameCallback((_) => _marquerLue(a));
          final peutModifier = gestion && a.statut != 'ARCHIVEE' && (ctx.isGestion || a.categorie != 'URGENCE');
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(annonceProvider(widget.id)),
            color: SuColors.action,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
              children: [
                Wrap(spacing: 6, runSpacing: 6, children: [
                  StatusBadge(e.categorieAnnonce[a.categorie] ?? a.categorie, variant: categorieAnnonceVariant[a.categorie] ?? BadgeVariant.neutral),
                  StatusBadge(e.statutAnnonce[a.statut] ?? a.statut, variant: annonceVariant[a.statut] ?? BadgeVariant.neutral),
                  if (a.epingle) StatusBadge(c.epinglee, variant: BadgeVariant.ink),
                ]),
                const SizedBox(height: 10),
                Text(a.titre, style: t.headlineSmall),
                const SizedBox(height: 4),
                Text('${a.publieLe != null ? (a.statut == 'BROUILLON' ? fill(c.programmeeLe, {'date': formatDateHeure(a.publieLe, l)}) : fill(c.publieeLe, {'date': formatDateHeure(a.publieLe, l)})) : formatDateHeure(a.creeLe, l)} · ${fill(c.par, {'nom': a.auteur.affichage})} · ${e.audience[a.audience] ?? a.audience}${a.batiment != null ? ' ${a.batiment}' : ''}', style: t.bodySmall),
                const SizedBox(height: 12),
                SuCard(child: SelectableText(texteAnnonce(a.contenu), style: t.bodyLarge)),
                if (a.piecesJointes.isNotEmpty) ...[
                  SectionHeader(c.piecesJointes),
                  CardList([
                    for (final p in a.piecesJointes)
                      ListRow(leading: const IconCircle(Icons.attach_file_rounded, tone: Tone.neutral, size: 36), title: '${p['nom']}', chevron: true, onTap: () => ouvrirVisionneuse(context, titre: '${p['nom']}', url: '${p['url']}')),
                  ]),
                ],
                if (gestion) ...[
                  SectionHeader(c.lectures, subtitle: c.lecteursAide),
                  SuCard(child: Row(children: [
                    Expanded(child: Text(a.nbLectures != null && a.nbDestinataires != null ? fill(c.luPar, {'n': '${a.nbLectures}', 'total': '${a.nbDestinataires}'}) : '—', style: t.titleSmall)),
                    if (a.nbDestinataires != null && a.nbDestinataires! > 0) SizedBox(width: 120, child: Gauge((a.nbLectures ?? 0) / a.nbDestinataires!)),
                  ])),
                  if (peutModifier) Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Wrap(spacing: 8, runSpacing: 8, children: [
                      if (a.statut == 'BROUILLON') FilledButton.icon(onPressed: () async {
                        if (await confirmDialog(context, title: c.publierTitre, body: c.publierCorps, confirmLabel: c.publier)) await _action('/annonces/${a.id}/publier', idempotent: true, succes: c.enregistree);
                      }, icon: const Icon(Icons.send_rounded, size: 18), label: Text(c.publier)),
                      if (a.statut == 'PUBLIEE') OutlinedButton.icon(onPressed: () async {
                        if (await confirmDialog(context, title: c.archiver, body: c.archiverCorps, danger: true)) await _action('/annonces/${a.id}/archiver', succes: c.archivee);
                      }, icon: const Icon(Icons.archive_outlined, size: 18), label: Text(c.archiver)),
                    ]),
                  ),
                ],
                SectionHeader('${c.commentaires}${a.commentaires.isNotEmpty ? ' · ${a.commentaires.length}' : ''}'),
                if (a.commentaires.isEmpty) SuCard(child: Text(c.aucunCommentaire, style: t.bodySmall)),
                for (final k in a.commentaires)
                  Opacity(
                    opacity: k.masque ? 0.6 : 1,
                    child: SuCard(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [Avatar(k.auteur.affichage, size: 28), const SizedBox(width: 8), Expanded(child: Text(k.auteur.affichage, style: t.labelLarge)), Text(formatDateHeure(k.creeLe, l), style: t.bodySmall)]),
                        if (k.masque) Padding(padding: const EdgeInsets.only(top: 4), child: Text(c.masque, style: t.bodySmall?.copyWith(color: SuColors.danger))),
                        const SizedBox(height: 6),
                        Text(texteAnnonce(k.contenu), style: t.bodyMedium),
                        if (ctx.isGestion && !k.masque) Align(alignment: AlignmentDirectional.centerEnd, child: TextButton(onPressed: () => _action('/annonces/${a.id}/commentaires/${k.id}/masquer'), child: Text(c.masquer, style: const TextStyle(color: SuColors.danger)))),
                      ]),
                    ),
                  ),
                if (a.statut == 'PUBLIEE' && a.commentairesActives) ...[
                  const SizedBox(height: 8),
                  SuField(label: c.votreCommentaire, controller: _commentaire, maxLines: 3, maxLength: 2000, error: fieldError(_fail, 'contenu')),
                  const SizedBox(height: 8),
                  FormError(_fail),
                  SubmitButton(label: c.commenter, loading: _envoi, onPressed: () async {
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
            ),
          );
        },
      ),
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
    Navigator.pop(context);
    showToast(context, publier ? (_programme != null ? context.dict.communication.programmee : context.dict.communication.enregistree) : context.dict.communication.enregistree);
    context.push('/affichage/$id');
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final c = d.communication;
    final e = d.enumsCommunication;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(c.nouvelleAide, style: Theme.of(context).textTheme.bodySmall),
      const SizedBox(height: 12),
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
      const SizedBox(height: 8),
      Row(children: [
        Expanded(child: Text(_programme == null ? c.publierMaintenant : fill(c.programmeeLe, {'date': formatDateHeure(_programme!.toIso8601String(), l)}), style: Theme.of(context).textTheme.bodyMedium)),
        TextButton.icon(onPressed: () async {
          final now = DateTime.now();
          final jour = await showDatePicker(context: context, initialDate: now.add(const Duration(days: 1)), firstDate: now, lastDate: now.add(const Duration(days: 365)), locale: l);
          if (jour == null || !context.mounted) return;
          final heure = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 9, minute: 0));
          if (heure == null) return;
          setState(() => _programme = DateTime(jour.year, jour.month, jour.day, heure.hour, heure.minute));
        }, icon: const Icon(Icons.schedule_rounded, size: 18), label: Text(c.programmer)),
        if (_programme != null) IconButton(onPressed: () => setState(() => _programme = null), icon: const Icon(Icons.close_rounded, size: 18)),
      ]),
      const SizedBox(height: 12),
      FormError(_fail),
      if (_fail != null) const SizedBox(height: 12),
      SubmitButton(label: _programme == null ? c.publierMaintenant : c.programmer, loading: _loading, onPressed: () => _envoyer(publier: true)),
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
    return Scaffold(
      appBar: AppBar(title: Text(c.sondage)),
      body: AsyncView(
        sondage,
        onRetry: () => ref.invalidate(sondageProvider(widget.id)),
        loading: const Padding(padding: EdgeInsets.all(16), child: LoadingList()),
        data: (s) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(sondageProvider(widget.id)),
          color: SuColors.action,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
            children: [
              Wrap(spacing: 6, children: [StatusBadge(e.statutSondage[s.statut] ?? s.statut, variant: sondageVariant[s.statut] ?? BadgeVariant.neutral), if (s.maReponse != null) StatusBadge(c.dejaRepondu, variant: BadgeVariant.info)]),
              const SizedBox(height: 10),
              Text(s.question, style: t.headlineSmall),
              const SizedBox(height: 4),
              Text('${s.statut == 'CLOS' ? fill(c.closLe, {'date': formatDateHeure(s.closLe ?? s.dateFin, l)}) : fill(c.finLe, {'date': formatDateHeure(s.dateFin, l)})} · ${e.audience[s.audience] ?? s.audience}', style: t.bodySmall),
              const SizedBox(height: 12),
              SuBanner(tone: BannerTone.info, body: c.mention),
              if (s.description != null && s.description!.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: SuCard(child: Text(texteAnnonce(s.description!), style: t.bodyMedium))),
              if (gestion && (s.statut == 'BROUILLON' || s.statut == 'OUVERT')) Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Wrap(spacing: 8, children: [
                  if (s.statut == 'BROUILLON') FilledButton.icon(onPressed: () async { if (await confirmDialog(context, title: c.ouvrir, body: c.ouvrirCorps)) await _transition('ouvrir', c.ouvert); }, icon: const Icon(Icons.play_arrow_rounded, size: 18), label: Text(c.ouvrir)),
                  if (s.statut == 'OUVERT') OutlinedButton.icon(onPressed: () async { if (await confirmDialog(context, title: c.clore, body: c.cloreCorps, danger: true)) await _transition('clore', c.clos); }, icon: const Icon(Icons.stop_circle_outlined, size: 18), label: Text(c.clore)),
                ]),
              ),
              SectionHeader(s.maReponse != null || !s.ouvertEncore ? c.resultats : c.repondre, subtitle: s.choixMultiple ? c.choixMultiple : null),
              if (s.ouvertEncore && s.maReponse == null) SuCard(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                for (final o in s.options)
                  s.choixMultiple
                      ? CheckboxListTile(value: _choix.contains(o.id), onChanged: (v) => setState(() => v == true ? _choix.add(o.id) : _choix.remove(o.id)), title: Text(o.libelle), contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading)
                      : RadioListTile<String>(value: o.id, groupValue: _choix.isEmpty ? null : _choix.first, onChanged: (v) => setState(() { _choix.clear(); if (v != null) _choix.add(v); }), title: Text(o.libelle), contentPadding: EdgeInsets.zero),
                const SizedBox(height: 8),
                SubmitButton(label: c.repondre, loading: _envoi, onPressed: _choix.isEmpty ? null : () async {
                  setState(() => _envoi = true);
                  final r = await ref.read(apiClientProvider).post<dynamic>('/sondages/${s.id}/repondre', body: {'choix': _choix.toList()}, idempotent: true);
                  if (!context.mounted) return;
                  setState(() => _envoi = false);
                  if (r is ApiFail) { showToast(context, r.error.message, error: true); return; }
                  showToast(context, c.reponseEnvoyee);
                  ref.invalidate(sondageProvider(widget.id));
                  ref.invalidate(sondagesProvider);
                }),
              ]))
              else if (s.resultats == null) SuCard(child: Text(c.resultatsApres, style: t.bodySmall))
              else SuCard(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text('${fill(c.reponses, {'n': '${s.resultats!.nbReponses}', 'total': '${s.resultats!.nbDestinataires}'})}${s.resultats!.ponderationTantiemes ? ' · ${fill(c.tantiemesExprimes, {'n': s.resultats!.tantiemesExprimes})}' : ''}', style: t.bodySmall),
                const SizedBox(height: 10),
                for (final o in s.resultats!.options) ...[
                  Row(children: [Expanded(child: Text(o.libelle, style: t.bodyMedium)), if (s.maReponse?.contains(o.id) ?? false) const Icon(Icons.check_rounded, size: 16, color: SuColors.action), const SizedBox(width: 6), Text('${o.nb} · ${o.pourcentage} %', style: t.bodySmall)]),
                  const SizedBox(height: 4),
                  Gauge(o.pourcentage / 100, color: SuColors.action),
                  if (s.resultats!.ponderationTantiemes) ...[const SizedBox(height: 3), Gauge(o.pourcentageTantiemes / 100, height: 5, color: SuColors.ink), Text('${c.parTantiemes} · ${o.pourcentageTantiemes} %', style: t.bodySmall)],
                  const SizedBox(height: 10),
                ],
                Text(c.mention, style: t.bodySmall),
              ])),
            ],
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
    Navigator.pop(context);
    showToast(context, ouvrir ? context.dict.communication.ouvert : context.dict.communication.sondageEnregistre);
    context.push('/affichage/sondages/$id');
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
      Text(c.options, style: Theme.of(context).textTheme.labelLarge),
      for (var i = 0; i < _options.length; i++) Padding(padding: const EdgeInsets.only(top: 8), child: SuField(label: fill(c.option, {'n': '${i + 1}'}), controller: _options[i], required: i < 2, maxLength: 200)),
      if (_options.length < 10) Align(alignment: AlignmentDirectional.centerStart, child: TextButton.icon(onPressed: () => setState(() => _options.add(TextEditingController())), icon: const Icon(Icons.add_rounded, size: 18), label: Text(fill(c.option, {'n': '${_options.length + 1}'})))),
      const SizedBox(height: 8),
      SuSelect<String>(label: c.audience, value: _audience, options: _audiences, labelOf: (v) => e.audience[v] ?? v, onChanged: (v) => setState(() => _audience = v)),
      if (_audience == 'BATIMENT') ...[const SizedBox(height: 12), SuField(label: c.batiment, controller: _batiment, required: true, error: fieldError(_fail, 'batiment'))],
      const SizedBox(height: 12),
      Row(children: [
        Expanded(child: Text('${c.dateFin} : ${formatDateHeure(_fin.toIso8601String(), l)}', style: Theme.of(context).textTheme.bodyMedium)),
        TextButton(onPressed: () async {
          final jour = await showDatePicker(context: context, initialDate: _fin, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)), locale: l);
          if (jour == null) return;
          setState(() => _fin = DateTime(jour.year, jour.month, jour.day, 18));
        }, child: Text(d.common.modify)),
      ]),
      SuCheckbox(value: _multiple, onChanged: (v) => setState(() => _multiple = v), label: c.choixMultiple),
      SuCheckbox(value: _ponderation, onChanged: (v) => setState(() => _ponderation = v), label: c.ponderation, help: c.ponderationAide),
      const SizedBox(height: 12),
      FormError(_fail),
      if (_fail != null) const SizedBox(height: 12),
      SubmitButton(label: c.ouvrir, loading: _loading, onPressed: () => _envoyer(ouvrir: true)),
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
      Text(c.pushTitre, style: Theme.of(context).textTheme.titleSmall),
      Text(c.pushAide, style: Theme.of(context).textTheme.bodySmall),
      const SizedBox(height: 8),
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
          Expanded(child: OutlinedButton.icon(onPressed: () => _choisirHeure(true), icon: const Icon(Icons.bedtime_outlined, size: 18), label: Text('${c.heuresCalmesDebut} · $_calmesDebut'))),
          const SizedBox(width: 8),
          Expanded(child: OutlinedButton.icon(onPressed: () => _choisirHeure(false), icon: const Icon(Icons.wb_sunny_outlined, size: 18), label: Text('${c.heuresCalmesFin} · $_calmesFin'))),
        ]),
      ],
      const SizedBox(height: 12),
      FormError(_fail),
      if (_fail != null) const SizedBox(height: 12),
      SubmitButton(label: d.common.save, loading: _loading, onPressed: () async {
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
