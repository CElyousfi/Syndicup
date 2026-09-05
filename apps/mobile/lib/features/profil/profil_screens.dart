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
    await ref.read(appStateProvider.notifier).reload();
    if (!mounted) return;
    setState(() => _loading = false);
    showToast(context, context.dict.profil.enregistre);
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final md = context.mdict;
    final t = Theme.of(context).textTheme;
    final p = ctx.profil;
    return SuPage(
      title: d.profil.titre,
      children: [
        Row(
          children: [
            Avatar(nomCompletProfil(ctx) ?? p.email ?? '?', size: 64),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(nomCompletProfil(ctx) ?? '—', style: t.titleLarge), Text('${libelleRole(context, ctx.role)}${ctx.copropriete != null ? ' · ${ctx.copropriete!.nom}' : ''}', style: t.bodySmall), const SizedBox(height: 4), StatusBadge(d.enums.statutCompte[p.statutCompte] ?? p.statutCompte, variant: compteVariant[p.statutCompte] ?? BadgeVariant.neutral, small: true)])),
          ],
        ),
        const SizedBox(height: 20),
        SuField(label: d.profil.prenom, controller: _prenom, error: fieldError(_fail, 'prenom')),
        const SizedBox(height: 12),
        SuField(label: d.profil.nom, controller: _nom, error: fieldError(_fail, 'nom')),
        const SizedBox(height: 14),
        Text(d.profil.langue, style: t.labelMedium?.copyWith(color: SuColors.ink)),
        const SizedBox(height: 4),
        Text(d.profil.langueAide, style: t.bodySmall),
        const SizedBox(height: 8),
        Segmented<String>(value: _langue, options: const ['FR', 'AR'], labelOf: (v) => v == 'FR' ? '${d.common.french} · →' : '${d.common.arabic} · ←', onChanged: (v) => setState(() => _langue = v)),
        const SizedBox(height: 16),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(label: d.common.save, loading: _loading, onPressed: _save),
        SectionHeader(d.profil.identifiants, subtitle: d.profil.identifiantsAide),
        SuCard(child: Column(children: [KeyValueRow(d.auth.phoneLabel, formatTelephone(p.telephone), mono: true), KeyValueRow(d.auth.emailLabel, p.email ?? '—')])),
        SectionHeader(d.profil.mesRoles),
        CardList([
          for (final r in p.roles)
            ListRow(leading: const IconCircle(Icons.apartment_rounded, tone: Tone.lilac, size: 36), title: libelleRole(context, r.role), subtitle: ctx.coproprietes.where((c) => c.id == r.coproprieteId).map((c) => c.nom).firstOrNull ?? r.coproprieteId.substring(0, 8), trailing: r.actif ? null : StatusBadge(d.membres.roleInactif, variant: BadgeVariant.outline, small: true)),
        ]),
        SectionHeader(d.profil.donnees),
        SuCard(onTap: () => context.push('/profil/donnees'), child: Row(children: [const IconCircle(Icons.shield_outlined, tone: Tone.sage, size: 40), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(d.profil.donneesTitre, style: t.titleSmall), Text(d.profil.donneesCorps, style: t.bodySmall, maxLines: 2, overflow: TextOverflow.ellipsis)])), const ChevronEnd()])),
        const SizedBox(height: 24),
        OutlinedButton.icon(
          onPressed: () async {
            await PushService.instance.unregisterToken(ref.read(apiClientProvider));
            await ref.read(sessionProvider.notifier).signOut();
          },
          style: OutlinedButton.styleFrom(foregroundColor: SuColors.danger),
          icon: const Icon(Icons.logout_rounded),
          label: Text(d.common.logout),
        ),
        const SizedBox(height: 16),
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
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    return SuPage(
      title: d.profil.donneesTitre,
      children: [
        const IconCircle(Icons.shield_outlined, tone: Tone.sage, size: 64),
        const SizedBox(height: 16),
        Text(d.profil.donneesCorps, style: t.bodyMedium),
        const SizedBox(height: 10),
        SuBanner(tone: BannerTone.info, body: d.profil.donneesConservation),
        const SizedBox(height: 16),
        Text(d.profil.exportFormat, style: t.labelSmall),
        const SizedBox(height: 10),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: d.profil.exporter,
          icon: Icons.download_rounded,
          loading: _loading,
          onPressed: () async {
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
          },
        ),
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
