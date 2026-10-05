import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_result.dart';
import '../../core/auth/app_state.dart';
import '../../core/auth/session.dart';
import '../../core/config/app_config.dart';
import '../../core/format/format.dart';
import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
import '../../core/push/push_service.dart';
import '../../core/theme/tokens.dart';
import '../../core/util/status.dart';
import '../../core/widgets/widgets.dart';
import '../../core/api/providers.dart';
import '../communication/communication_screens.dart';
import '../shell/app_shell.dart';

/// J1 — profil : nom, prénom, langue (change le sens de lecture), identifiants, rôles.
class ProfilScreen extends ConsumerStatefulWidget {
  const ProfilScreen({super.key});
  @override
  ConsumerState<ProfilScreen> createState() => _ProfilScreenState();
}

class _ProfilScreenState extends ConsumerState<ProfilScreen> {
  late final TextEditingController _prenom;
  late final TextEditingController _nom;
  late String _langue;
  bool _loading = false;
  ApiFail? _fail;

  @override
  void initState() {
    super.initState();
    final p = ref.read(appContextProvider).profil;
    _prenom = TextEditingController(text: p.prenom ?? '');
    _nom = TextEditingController(text: p.nom ?? '');
    _langue = p.languePreferee == 'AR' ? 'AR' : 'FR';
  }

  Future<void> _save() async {
    setState(() {
      _loading = true;
      _fail = null;
    });
    final r = await ref.read(apiClientProvider).patch<dynamic>('/users/me', body: {'prenom': _prenom.text.trim(), 'nom': _nom.text.trim(), 'langue_preferee': _langue});
    if (!mounted) return;
    if (r is ApiFail) {
      setState(() {
        _loading = false;
        _fail = r;
      });
      return;
    }
    await ref.read(localeProvider.notifier).set(Locale(_langue == 'AR' ? 'ar' : 'fr'));
    if (!mounted) return;
    // Toast AVANT le rechargement de session : celui-ci repasse par l'écran de démarrage et
    // démonte cette page (le toast vit dans l'overlay racine, il survit). Texte dans la langue
    // qui vient d'être choisie.
    showToast(context, ref.read(dictProvider).profil.enregistre);
    await ref.read(appStateProvider.notifier).reload();
    if (!mounted) return;
    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final md = context.mdict;
    final t = Theme.of(context).textTheme;
    final p = ctx.profil;
    final nom = nomCompletProfil(ctx);
    return SuPage(
      title: d.profil.titre,
      children: [
        // En-tête « Account » de Wise : grand avatar centré, nom en gras, rôle, statut du compte.
        SuEnter(
          child: Padding(
            padding: const EdgeInsets.only(top: 4, bottom: 8),
            child: Column(
              children: [
                Avatar(nom ?? p.email ?? '?', size: 104),
                const SizedBox(height: 16),
                Text(nom ?? '—', style: t.displaySmall, textAlign: TextAlign.center),
                const SizedBox(height: 4),
                Text('${libelleRole(context, ctx.role)}${ctx.copropriete != null ? ' · ${ctx.copropriete!.nom}' : ''}', style: t.bodyMedium?.copyWith(color: SuColors.soft), textAlign: TextAlign.center),
                const SizedBox(height: 10),
                StatusBadge(d.enums.statutCompte[p.statutCompte] ?? p.statutCompte, variant: compteVariant[p.statutCompte] ?? BadgeVariant.neutral),
              ],
            ),
          ),
        ),
        // Informations modifiables : tuile greige (nom, prénom, langue).
        const SizedBox(height: 22),
        SuCard(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SuField(label: d.profil.prenom, controller: _prenom, error: fieldError(_fail, 'prenom')),
              const SizedBox(height: 14),
              SuField(label: d.profil.nom, controller: _nom, error: fieldError(_fail, 'nom')),
              const SizedBox(height: 18),
              Text(d.profil.langue, style: t.labelMedium?.copyWith(color: SuColors.ink)),
              const SizedBox(height: 4),
              Text(d.profil.langueAide, style: t.bodySmall),
              const SizedBox(height: 10),
              Segmented<String>(value: _langue, options: const ['FR', 'AR'], labelOf: (v) => v == 'FR' ? '${d.common.french} · →' : '${d.common.arabic} · ←', onChanged: (v) => setState(() => _langue = v)),
              const SizedBox(height: 18),
              FormError(_fail),
              if (_fail != null) const SizedBox(height: 12),
              SubmitButton(label: d.common.save, loading: _loading, onPressed: _save),
            ],
          ),
        ),
        // Identifiants : lignes à pastille (lecture seule, sans chevron).
        SectionHeader(d.profil.identifiants, subtitle: d.profil.identifiantsAide),
        CardList([
          ListRow(leading: const IconCircle(Icons.phone_rounded, tone: Tone.tosca), title: d.auth.phoneLabel, subtitle: formatTelephone(p.telephone)),
          ListRow(leading: const IconCircle(Icons.alternate_email_rounded, tone: Tone.tosca), title: d.auth.emailLabel, subtitle: p.email ?? '—'),
        ]),
        SectionHeader(d.profil.mesRoles),
        CardList([
          for (final r in p.roles)
            ListRow(leading: IconCircle(Icons.apartment_rounded, tone: r.actif ? Tone.lilac : Tone.neutral), title: libelleRole(context, r.role), subtitle: ctx.coproprietes.where((c) => c.id == r.coproprieteId).map((c) => c.nom).firstOrNull ?? r.coproprieteId.substring(0, 8), trailing: r.actif ? null : StatusBadge(d.membres.roleInactif, variant: BadgeVariant.outline, small: true)),
        ]),
        // Réglages : lignes Wise à pastille et chevron.
        SectionHeader(d.communication.preferences),
        CardList([
          ListRow(
            leading: const IconCircle(Icons.notifications_active_rounded, tone: Tone.sand),
            title: d.communication.preferences,
            subtitle: d.communication.preferencesAide,
            onTap: () async {
              final prefs = await ref.read(preferencesNotificationProvider.future);
              if (!context.mounted) return;
              await showFormSheet<void>(context, title: d.communication.preferences, builder: (_) => PreferencesNotificationSheet(initial: prefs));
            },
          ),
        ]),
        SectionHeader(d.profil.donnees),
        CardList([
          ListRow(leading: const IconCircle(Icons.shield_rounded, tone: Tone.sage), title: d.profil.donneesTitre, subtitle: d.profil.donneesCorps, onTap: () => context.push('/profil/donnees')),
        ]),
        SectionHeader(md.sessionTitle),
        CardList([
          ListRow(
            leading: const IconCircle(Icons.logout_rounded, tone: Tone.danger),
            title: d.common.logout,
            // Pas de chevron : action immédiate, pas une page.
            trailing: const SizedBox.shrink(),
            onTap: () async {
              await PushService.instance.unregisterToken(ref.read(apiClientProvider));
              await ref.read(sessionProvider.notifier).signOut();
            },
          ),
        ]),
        const SizedBox(height: 24),
        Text('${md.version} ${AppConfig.appVersion} · ${md.server} ${Uri.parse(AppConfig.apiBaseUrl).host}', style: t.labelSmall, textAlign: TextAlign.center),
      ],
    );
  }
}

/// J2 — mes données (loi 09-08) : export JSON (droit d'accès), texte sur la conservation.
class DonneesScreen extends ConsumerStatefulWidget {
  const DonneesScreen({super.key});
  @override
  ConsumerState<DonneesScreen> createState() => _DonneesScreenState();
}

class _DonneesScreenState extends ConsumerState<DonneesScreen> {
  bool _loading = false;
  ApiFail? _fail;

  Future<void> _exporter() async {
    setState(() {
      _loading = true;
      _fail = null;
    });
    final r = await ref.read(apiClientProvider).get<Map<String, dynamic>>('/users/me/export', parse: asMap);
    if (!mounted) return;
    setState(() => _loading = false);
    switch (r) {
      case ApiOk<Map<String, dynamic>>(:final data):
        final json = const JsonEncoder.withIndent('  ').convert(data);
        await Share.share(json, subject: 'SyndicUp — export CNDP');
      case ApiFail<Map<String, dynamic>>():
        setState(() => _fail = r);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    return SuPage(
      title: d.profil.donneesTitre,
      children: [
        // Carte-affiche « poster-securite » : explication + l'action d'export (désactivée pendant l'envoi).
        SuEnter(
          child: PosterCard(
            art: 'poster-securite',
            title: d.profil.donneesTitre,
            body: d.profil.donneesCorps,
            ctaLabel: d.profil.exporter,
            onCta: _loading ? null : _exporter,
          ),
        ),
        const SizedBox(height: 16),
        SuBanner(tone: BannerTone.info, body: d.profil.donneesConservation),
        const SizedBox(height: 16),
        Text(d.profil.exportFormat, style: t.bodySmall),
        if (_loading) const Padding(padding: EdgeInsets.only(top: 12), child: LinearProgressIndicator()),
        const SizedBox(height: 12),
        FormError(_fail),
        const SizedBox(height: 8),
        TextButton.icon(onPressed: () async {
          final r = await ref.read(apiClientProvider).get<Map<String, dynamic>>('/users/me/export', parse: asMap);
          if (!context.mounted) return;
          if (r is ApiOk<Map<String, dynamic>>) {
            await Clipboard.setData(ClipboardData(text: jsonEncode(r.data)));
            if (context.mounted) showToast(context, context.mdict.copied);
          }
        }, icon: const Icon(Icons.copy_rounded, size: 18), label: Text(d.common.copy)),
      ],
    );
  }
}
