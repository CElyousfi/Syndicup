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
import '../../core/theme/tokens.dart';
import '../../core/util/status.dart';
import '../../core/widgets/widgets.dart';
import '../invitations/invitations_screen.dart';
import '../shell/app_shell.dart';

/// B6 — console super admin : copropriétés de la plateforme, création, invitation du 1er syndic.
class AdminScreen extends ConsumerStatefulWidget {
  const AdminScreen({super.key});
  @override
  ConsumerState<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends ConsumerState<AdminScreen> {
  String _q = '';
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final copros = ref.watch(coproprietesProvider);
    return Scaffold(
      appBar: ShellHeader(title: d.admin.titre),
      floatingActionButton: FloatingActionButton.extended(onPressed: () => context.push('/admin/coproprietes/nouvelle'), icon: const Icon(Icons.add_rounded), label: Text(d.admin.creer)),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(coproprietesProvider),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
          children: [
            Text(d.admin.subtitle, style: t.bodyMedium?.copyWith(color: SuColors.soft)),
            const SizedBox(height: 14),
            TextField(onChanged: (v) => setState(() => _q = v.toLowerCase()), decoration: InputDecoration(hintText: d.common.search, prefixIcon: const Icon(Icons.search_rounded))),
            const SizedBox(height: 12),
            AsyncView(copros, onRetry: () => ref.invalidate(coproprietesProvider), data: (list) {
              final visible = list.where((c) => _q.isEmpty || c.nom.toLowerCase().contains(_q) || c.ville.toLowerCase().contains(_q)).toList();
              // Plateforme vide → créer ; recherche sans résultat → illustration recherche.
              if (visible.isEmpty) return EmptyState(title: d.common.emptyDefault, icon: Icons.apartment_rounded, illustration: list.isEmpty ? 'empty-lots' : 'empty-search', actionLabel: d.admin.creer, onAction: () => context.push('/admin/coproprietes/nouvelle'));
              return CardList([
                for (final c in visible)
                  ListRow(
                    leading: const IconCircle(Icons.apartment_rounded, tone: Tone.lilac),
                    title: c.nom,
                    subtitle: '${c.ville} · ${d.enums.typeResidence[c.typeResidence] ?? c.typeResidence} · ${c.nbLots} ${d.nav.lots.toLowerCase()}',
                    trailing: StatusBadge(d.enums.statutCopropriete[c.statut] ?? c.statut, variant: coproVariant[c.statut] ?? BadgeVariant.neutral, small: true),
                    onTap: () => context.push('/admin/coproprietes/${c.id}'),
                  ),
              ]);
            }),
          ],
        ),
      ),
    );
  }
}

/// J6 — créer une copropriété puis inviter son premier syndic.
class AdminCoproFormScreen extends ConsumerStatefulWidget {
  const AdminCoproFormScreen({super.key});
  @override
  ConsumerState<AdminCoproFormScreen> createState() => _AdminCoproFormScreenState();
}

class _AdminCoproFormScreenState extends ConsumerState<AdminCoproFormScreen> {
  final _nom = TextEditingController(), _adresse = TextEditingController(), _ville = TextEditingController(), _nb = TextEditingController();
  String _type = 'IMMEUBLE_COLLECTIF';
  bool _loading = false;
  ApiFail? _fail;
  Copropriete? _creee;
  Invitation? _invitation;

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final c = _creee;
    if (c != null) {
      return SuPage(
        title: d.admin.creee,
        children: [
          // Récapitulatif de la résidence créée (le succès plein écran vient d'être montré).
          SuCard(
            child: Row(
              children: [
                const IconCircle(Icons.apartment_rounded, tone: Tone.lilac),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(c.nom, style: t.titleMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
                      Padding(padding: const EdgeInsets.only(top: 3), child: Text('${c.ville} · ${d.enums.typeResidence[c.typeResidence] ?? c.typeResidence} · ${c.nbLots} ${d.nav.lots.toLowerCase()}', style: t.bodyMedium?.copyWith(fontSize: 14, color: SuColors.soft))),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (_invitation == null) ...[
            SectionHeader(d.admin.etapeSyndic, subtitle: d.admin.syndicAide),
            FormError(_fail),
            if (_fail != null) const SizedBox(height: 12),
            SubmitButton(label: d.admin.inviterSyndic, loading: _loading, icon: Icons.vpn_key_rounded, onPressed: () async {
              setState(() {
                _loading = true;
                _fail = null;
              });
              final r = await ref.read(apiClientProvider).post<Invitation>('/invitations', body: {'role_cible': 'SYNDIC', 'canal': 'QR_CODE', 'lot_id': null}, coproprieteId: c.id, parse: (j) => Invitation.fromJson(asMap(j)));
              if (!mounted) return;
              switch (r) {
                case ApiOk<Invitation>(:final data):
                  setState(() {
                    _loading = false;
                    _invitation = data;
                  });
                  // Succès plein écran ; à la fermeture, le code à transmettre est affiché.
                  showSuccess(this.context, title: d.invitations.creee, body: d.admin.codePret, illustration: 'ok-invitation');
                case ApiFail<Invitation>():
                  setState(() {
                    _loading = false;
                    _fail = r;
                  });
              }
            }),
            const SizedBox(height: 8),
            TextButton(onPressed: () => context.go('/admin'), child: Text(d.admin.plusTard)),
          ] else ...[
            SectionHeader(d.admin.codePret),
            CodeCard(invitation: _invitation!),
            const SizedBox(height: 16),
            FilledButton(onPressed: () {
              ref.invalidate(coproprietesProvider);
              context.go('/admin');
            }, child: Text(d.admin.terminer)),
          ],
        ],
      );
    }
    return SuPage(
      title: d.admin.creer,
      subtitle: d.admin.etapeInfos,
      children: [
        SuField(label: d.parametres.nom, controller: _nom, required: true, error: fieldError(_fail, 'nom')),
        const SizedBox(height: 12),
        SuField(label: d.parametres.adresse, controller: _adresse, required: true, error: fieldError(_fail, 'adresse')),
        const SizedBox(height: 12),
        SuField(label: d.parametres.ville, controller: _ville, required: true, error: fieldError(_fail, 'ville')),
        const SizedBox(height: 12),
        SuSelect<String>(label: d.parametres.typeResidence, value: _type, options: d.enums.typeResidence.keys.toList(), labelOf: (v) => d.enums.typeResidence[v]!, onChanged: (v) => setState(() => _type = v)),
        const SizedBox(height: 12),
        SuField(label: d.parametres.nbLots, controller: _nb, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], required: true, textDirection: TextDirection.ltr, error: fieldError(_fail, 'nb_lots')),
        const SizedBox(height: 16),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(label: d.common.create, loading: _loading, onPressed: () async {
          setState(() {
            _loading = true;
            _fail = null;
          });
          final r = await ref.read(apiClientProvider).post<Copropriete>('/coproprietes', body: {'nom': _nom.text.trim(), 'adresse': _adresse.text.trim(), 'ville': _ville.text.trim(), 'type_residence': _type, 'nb_lots': int.tryParse(_nb.text.trim()) ?? 1}, parse: (j) => Copropriete.fromJson(asMap(j)));
          if (!mounted) return;
          switch (r) {
            case ApiOk<Copropriete>(:final data):
              ref.invalidate(coproprietesProvider);
              setState(() {
                _loading = false;
                _creee = data;
              });
              // Succès plein écran Wise ; à la fermeture, l'étape « inviter le premier syndic ».
              showSuccess(this.context, title: d.admin.creee, body: data.nom, illustration: 'ok-general');
            case ApiFail<Copropriete>():
              setState(() {
                _loading = false;
                _fail = r;
              });
          }
        }),
      ],
    );
  }
}

/// Fiche client d'une copropriété (synthèse opérateur).
class AdminCoproDetailScreen extends ConsumerWidget {
  const AdminCoproDetailScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final copro = ref.watch(coproprieteProvider(id));
    final synthese = ref.watch(adminSyntheseProvider(id));
    return SuPage(
      title: copro.valueOrNull?.nom ?? d.admin.ficheClient,
      subtitle: copro.valueOrNull?.ville,
      onRefresh: () async {
        ref.invalidate(coproprieteProvider(id));
        ref.invalidate(adminSyntheseProvider(id));
      },
      children: [
        AsyncView(synthese, onRetry: () => ref.invalidate(adminSyntheseProvider(id)), data: (s) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Résumé Wise : statut et type de la résidence avant les chiffres.
            if (copro.valueOrNull != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    StatusBadge(d.enums.statutCopropriete[copro.valueOrNull!.statut] ?? copro.valueOrNull!.statut, variant: coproVariant[copro.valueOrNull!.statut] ?? BadgeVariant.neutral),
                    StatusBadge(d.enums.typeResidence[copro.valueOrNull!.typeResidence] ?? copro.valueOrNull!.typeResidence, variant: BadgeVariant.outline),
                  ],
                ),
              ),
            TwoCols([
              StatTile(label: fill(d.admin.lotsDeclares, {'n': copro.valueOrNull?.nbLots ?? '—'}), value: '${s.lots}', tone: Tone.lilac, icon: Icons.apartment_rounded),
              StatTile(label: d.admin.residentsActifs, value: '${s.residentsActifs}', tone: Tone.sage, icon: Icons.group_rounded),
              StatTile(label: d.admin.invitationsEnAttente, value: '${s.invitationsEnAttente}', tone: Tone.sand, icon: Icons.vpn_key_rounded),
              StatTile(label: d.admin.invitationsAcceptees, value: '${s.invitationsAcceptees}', tone: Tone.tosca, icon: Icons.how_to_reg_rounded),
              StatTile(label: d.dash.incidentsOuverts, value: '${s.incidentsOuverts}', tone: Tone.warn, icon: Icons.build_rounded, hint: s.slaDepasses > 0 ? '${s.slaDepasses} · ${d.dash.slaDepasse}' : null, hintColor: SuColors.danger),
              StatTile(label: d.nav.documents, value: '${s.documents}', tone: Tone.neutral, icon: Icons.description_rounded),
            ]),
            SectionHeader(d.nav.finances),
            SuCard(child: Column(children: [KeyValueRow(d.admin.appele, formatMAD(s.montantDu, l)), KeyValueRow(d.admin.encaisse, formatMAD(s.montantPaye, l))])),
            SectionHeader(d.dash.prochaineAg),
            s.prochaineAg == null
                ? Text(d.dash.aucuneAg, style: t.bodyMedium?.copyWith(color: SuColors.soft))
                : CardList([
                    ListRow(
                      leading: const IconCircle(Icons.how_to_vote_rounded, tone: Tone.lilac),
                      title: formatDateHeure(s.prochaineAg!['date_ag']?.toString(), l),
                      subtitle: d.enums.typeAg[s.prochaineAg!['type']] ?? '',
                      trailing: StatusBadge(d.enums.statutAg[s.prochaineAg!['statut']] ?? '', small: true),
                    ),
                  ]),
            SectionHeader(d.admin.derniereActivite),
            CardList([
              ListRow(leading: const IconCircle(Icons.history_rounded, tone: Tone.neutral), title: s.derniereActivite == null ? d.admin.aucuneActivite : formatDateHeure(s.derniereActivite, l)),
            ]),
            const SizedBox(height: 24),
            OutlinedButton.icon(
              onPressed: () async {
                final ctx = ref.read(appContextProvider);
                await ref.read(sessionProvider.notifier).chooseCopropriete(id);
                await ref.read(appStateProvider.notifier).reload();
                if (context.mounted && ctx.isSuperAdmin) context.push('/invitations?nouvelle=1');
              },
              icon: const Icon(Icons.vpn_key_rounded),
              label: Text(d.admin.inviterSyndic),
            ),
          ],
        )),
      ],
    );
  }
}
