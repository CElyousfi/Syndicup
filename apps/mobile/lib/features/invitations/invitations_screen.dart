import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_result.dart';
import '../../core/api/models.dart';
import '../../core/api/providers.dart';
import '../../core/auth/session.dart';
import '../../core/config/app_config.dart';
import '../../core/format/format.dart';
import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
import '../../core/theme/tokens.dart';
import '../../core/util/status.dart';
import '../../core/widgets/widgets.dart';

/// J4 — invitations (syndic) : créer (rôle, lot, canal) → code 8 caractères + QR à transmettre.
class InvitationsScreen extends ConsumerStatefulWidget {
  const InvitationsScreen({super.key, this.nouvelle = false});
  final bool nouvelle;
  @override
  ConsumerState<InvitationsScreen> createState() => _InvitationsScreenState();
}

class _InvitationsScreenState extends ConsumerState<InvitationsScreen> {
  @override
  void initState() {
    super.initState();
    if (widget.nouvelle) WidgetsBinding.instance.addPostFrameCallback((_) => _nouvelle());
  }

  Future<void> _nouvelle() => showFormSheet<void>(context, title: context.dict.invitations.nouvelle, builder: (_) => const _InvitationForm());

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final invitations = ref.watch(invitationsProvider);
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    return SuPage(
      title: d.invitations.titre,
      subtitle: d.invitations.subtitle,
      onRefresh: () async => ref.invalidate(invitationsProvider),
      fab: FloatingActionButton.extended(onPressed: _nouvelle, backgroundColor: SuColors.ink, foregroundColor: Colors.white, icon: const Icon(Icons.add_rounded), label: Text(d.invitations.nouvelle)),
      children: [
        SuBanner(tone: BannerTone.info, body: d.invitations.envoiManuel),
        const SizedBox(height: 12),
        AsyncView(invitations, onRetry: () => ref.invalidate(invitationsProvider), data: (list) {
          if (list.isEmpty) return EmptyState(title: d.invitations.aucune, hint: d.invitations.aucuneAide, icon: Icons.vpn_key_rounded, actionLabel: d.invitations.nouvelle, onAction: _nouvelle);
          final sorted = [...list]..sort((a, b) => b.creeLe.compareTo(a.creeLe));
          return CardList([
            for (final i in sorted)
              ListRow(
                leading: IconCircle(Icons.vpn_key_rounded, tone: i.statut == 'EN_ATTENTE' ? Tone.action : Tone.neutral, size: 40),
                title: '${d.roles[i.roleCible] ?? i.roleCible}${i.lotId != null ? ' · ${lots.where((x) => x.id == i.lotId).map((x) => x.numero).firstOrNull ?? ''}' : ''}',
                subtitle: '${i.code} · ${d.enums.canal[i.canal] ?? i.canal} · ${d.invitations.expiration} ${formatDateCourte(i.expireLe, l)}${i.ouverteLe != null ? ' · ${d.invitations.ouverte}' : ''}',
                trailing: StatusBadge(d.enums.statutInvitation[i.statut] ?? i.statut, variant: invitationVariant[i.statut] ?? BadgeVariant.neutral, small: true),
                onTap: () => _detail(context, i),
              ),
          ]);
        }),
        const SizedBox(height: 8),
        Text(d.invitations.usageUniqueAide, style: t.labelSmall),
      ],
    );
  }

  Future<void> _detail(BuildContext context, Invitation i) async {
    final d = context.dict;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheet) => SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(d.invitations.transmettre, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 12),
            CodeCard(invitation: i),
            const SizedBox(height: 12),
            if (i.statut == 'EXPIREE' || i.statut == 'EN_ATTENTE')
              OutlinedButton.icon(
                onPressed: () async {
                  final r = await ref.read(apiClientProvider).post<Invitation>('/invitations/${i.id}/regenerer', parse: (j) => Invitation.fromJson(asMap(j)));
                  if (!sheet.mounted) return;
                  if (r is ApiFail) showToast(sheet, (r as ApiFail).error.message, error: true); else {
                    ref.invalidate(invitationsProvider);
                    Navigator.pop(sheet);
                    showToast(context, d.invitations.regeneree);
                  }
                },
                icon: const Icon(Icons.refresh_rounded),
                label: Text(d.invitations.regenerer),
              ),
            if (i.statut == 'EN_ATTENTE')
              TextButton(
                onPressed: () async {
                  final ok = await confirmDialog(sheet, title: d.gestion.invitationAnnuler, body: d.gestion.invitationAnnulerAide, danger: true);
                  if (!ok) return;
                  final r = await ref.read(apiClientProvider).delete<dynamic>('/invitations/${i.id}');
                  if (!sheet.mounted) return;
                  if (r is ApiFail) showToast(sheet, r.error.message, error: true); else {
                    ref.invalidate(invitationsProvider);
                    Navigator.pop(sheet);
                    showToast(context, d.gestion.invitationAnnulee);
                  }
                },
                style: TextButton.styleFrom(foregroundColor: SuColors.danger),
                child: Text(d.gestion.invitationAnnuler),
              ),
          ],
        ),
      ),
    );
  }
}

/// Code à 8 caractères + QR (cible : `/{locale}/invitation/{code}` du web, lisible aussi par
/// l'app) + copier / partager.
class CodeCard extends StatelessWidget {
  const CodeCard({super.key, required this.invitation});
  final Invitation invitation;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final md = context.mdict;
    final t = Theme.of(context).textTheme;
    final lien = '${AppConfig.webBaseUrl}/${context.locale.languageCode}/invitation/${invitation.code}';
    return SuCard(
      child: Column(
        children: [
          Text(d.invitations.code, style: t.labelSmall),
          const SizedBox(height: 4),
          SelectableText(invitation.code, textDirection: TextDirection.ltr, style: t.displayMedium?.copyWith(fontFamily: 'GeistMono', letterSpacing: 6)),
          const SizedBox(height: 12),
          Text(d.invitations.ouQr, style: t.labelSmall),
          const SizedBox(height: 8),
          Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: SuColors.hairline)), child: QrImageView(data: lien, size: 190, backgroundColor: Colors.white)),
          const SizedBox(height: 6),
          Text(lien, style: t.labelSmall?.copyWith(fontFamily: 'GeistMono'), textAlign: TextAlign.center, textDirection: TextDirection.ltr),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: OutlinedButton.icon(onPressed: () {
                Clipboard.setData(ClipboardData(text: invitation.code));
                showToast(context, md.copied);
              }, icon: const Icon(Icons.copy_rounded, size: 18), label: Text(d.common.copy))),
              const SizedBox(width: 8),
              Expanded(child: FilledButton.icon(onPressed: () => Share.share('${d.invitations.transmettre} : ${invitation.code}\n$lien'), style: FilledButton.styleFrom(minimumSize: const Size(0, 50)), icon: const Icon(Icons.share_rounded, size: 18), label: Text(d.common.share))),
            ],
          ),
        ],
      ),
    );
  }
}

class _InvitationForm extends ConsumerStatefulWidget {
  const _InvitationForm();
  @override
  ConsumerState<_InvitationForm> createState() => _InvitationFormState();
}

class _InvitationFormState extends ConsumerState<_InvitationForm> {
  String _role = 'PROPRIETAIRE';
  String _canal = 'QR_CODE';
  String? _lot;
  bool _loading = false;
  ApiFail? _fail;
  Invitation? _creee;
  static const _sansLot = ['SYNDIC', 'GARDIEN', 'PRESTATAIRE'];

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    final c = _creee;
    if (c != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SuBanner(tone: BannerTone.ok, title: d.invitations.creee, body: d.invitations.envoiManuel),
          const SizedBox(height: 12),
          CodeCard(invitation: c),
          const SizedBox(height: 12),
          FilledButton(onPressed: () => Navigator.pop(context), child: Text(d.common.close)),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SuSelect<String>(label: d.invitations.role, value: _role, options: d.roles.keys.where((r) => r != 'SUPER_ADMIN').toList(), labelOf: (v) => d.roles[v]!, onChanged: (v) => setState(() => _role = v), help: d.invitations.roleAide, required: true),
        const SizedBox(height: 12),
        if (!_sansLot.contains(_role)) ...[
          SuSelect<String>(label: d.invitations.lot, value: _lot, options: lots.map((x) => x.id).toList(), labelOf: (id) => lots.firstWhere((x) => x.id == id).numero, onChanged: (v) => setState(() => _lot = v), required: true, error: fieldError(_fail, 'lot_id'), placeholder: context.mdict.selectLot),
          const SizedBox(height: 12),
        ],
        SuSelect<String>(label: d.invitations.canal, value: _canal, options: const ['QR_CODE', 'SMS', 'EMAIL', 'WHATSAPP'], labelOf: (v) => d.enums.canal[v] ?? v, onChanged: (v) => setState(() => _canal = v)),
        const SizedBox(height: 16),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: d.common.create,
          loading: _loading,
          onPressed: (!_sansLot.contains(_role) && _lot == null)
              ? null
              : () async {
                  setState(() {
                    _loading = true;
                    _fail = null;
                  });
                  final r = await ref.read(apiClientProvider).post<Invitation>('/invitations', body: {'role_cible': _role, 'canal': _canal, 'lot_id': _sansLot.contains(_role) ? null : _lot}, parse: (j) => Invitation.fromJson(asMap(j)));
                  if (!mounted) return;
                  switch (r) {
                    case ApiOk<Invitation>(:final data):
                      ref.invalidate(invitationsProvider);
                      setState(() {
                        _loading = false;
                        _creee = data;
                      });
                    case ApiFail<Invitation>():
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
