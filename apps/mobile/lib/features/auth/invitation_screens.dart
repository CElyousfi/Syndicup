import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_result.dart';
import '../../core/api/models.dart';
import '../../core/auth/app_state.dart';
import '../../core/auth/session.dart';
import '../../core/format/format.dart';
import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
import '../../core/theme/tokens.dart';
import '../../core/util/status.dart';
import '../../core/widgets/widgets.dart';
import 'welcome_screen.dart';

String _randomJeton() {
  final r = Random.secure();
  return List.generate(24, (_) => r.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
}

final invitationJetonProvider = FutureProvider<String>((ref) => ref.read(sessionStorageProvider).invitationJeton(_randomJeton));

/// Extrait un code d'invitation d'un QR : URL `/{locale}/invitation/{code}` ou code brut.
String? codeDepuisScan(String raw) {
  final s = raw.trim();
  final m = RegExp(r'/invitation/([A-Za-z0-9]{4,16})').firstMatch(s);
  if (m != null) return m.group(1)!.toUpperCase();
  if (RegExp(r'^[A-Za-z0-9]{4,16}$').hasMatch(s)) return s.toUpperCase();
  return null;
}

/// A3 (entrée) — saisir le code à 8 caractères ou scanner le QR.
class InvitationEntryScreen extends ConsumerStatefulWidget {
  const InvitationEntryScreen({super.key});
  @override
  ConsumerState<InvitationEntryScreen> createState() => _InvitationEntryScreenState();
}

class _InvitationEntryScreenState extends ConsumerState<InvitationEntryScreen> {
  final _code = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final md = context.mdict;
    final t = Theme.of(context).textTheme;
    final session = ref.watch(sessionProvider);
    return PublicScaffold(
      showBack: true,
      children: [
        const HeroImageCard(asset: 'assets/images/residence-entrance.jpg'),
        Text(d.auth.inviteTitle, style: t.displayMedium),
        const SizedBox(height: 8),
        Text(md.scanOrType, style: t.bodyLarge?.copyWith(color: SuColors.soft)),
        const SizedBox(height: 28),
        // Formulaire Wise à plat (comme la connexion) : champ, pill principale pleine largeur.
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SuField(
              label: d.auth.inviteCodeLabel,
              controller: _code,
              hint: 'SEED0001',
              help: d.auth.inviteCodeHint,
              mono: true,
              textDirection: TextDirection.ltr,
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9]')), LengthLimitingTextInputFormatter(16), _Upper()],
              textInputAction: TextInputAction.go,
              onSubmitted: (_) => _go(),
            ),
            const SizedBox(height: 20),
            SuButton(label: d.common.next, onPressed: _go),
          ],
        ),
        const SizedBox(height: 12),
        SuButton(label: d.auth.scanQr, icon: Icons.qr_code_scanner_rounded, variant: SuButtonVariant.secondary, onPressed: () => context.push('/invitation/scan')),
        const SizedBox(height: 12),
        Center(
          child: session != null
              ? SuButton(label: d.common.logout, variant: SuButtonVariant.ghost, onPressed: () => ref.read(sessionProvider.notifier).signOut(), style: TextButton.styleFrom(foregroundColor: SuColors.soft))
              : SuButton(label: d.auth.inviteDejaCompte, variant: SuButtonVariant.ghost, onPressed: () => context.push('/connexion')),
        ),
      ],
    );
  }

  void _go() {
    final c = _code.text.trim().toUpperCase();
    if (c.length < 4) return;
    context.push('/invitation/$c');
  }
}

class _Upper extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue o, TextEditingValue n) => n.copyWith(text: n.text.toUpperCase());
}

/// Scanner de QR (caméra) — brief §8.4.
class InvitationScanScreen extends StatefulWidget {
  const InvitationScanScreen({super.key});
  @override
  State<InvitationScanScreen> createState() => _InvitationScanScreenState();
}

class _InvitationScanScreenState extends State<InvitationScanScreen> {
  final _controller = MobileScannerController(detectionSpeed: DetectionSpeed.noDuplicates, formats: const [BarcodeFormat.qrCode]);
  bool _done = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    // Caméra plein écran ; bouton rond blanc de fermeture, titre blanc par-dessus (Wise).
    return Scaffold(
      backgroundColor: Colors.black,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        automaticallyImplyLeading: false,
        leadingWidth: 68,
        leading: Padding(
          padding: const EdgeInsetsDirectional.only(start: 16),
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            child: CircleIconButton(icon: Icons.close_rounded, color: SuColors.surface, iconColor: SuColors.ink, tooltip: MaterialLocalizations.of(context).closeButtonTooltip, onTap: () => Navigator.of(context).maybePop()),
          ),
        ),
        titleSpacing: 6,
        title: Text(d.auth.scanQr, style: t.titleLarge?.copyWith(color: Colors.white)),
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(
            controller: _controller,
            errorBuilder: (_, e, __) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(d.auth.scanDenied, style: t.bodyLarge?.copyWith(color: Colors.white), textAlign: TextAlign.center))),
            onDetect: (capture) {
              if (_done) return;
              for (final b in capture.barcodes) {
                final code = codeDepuisScan(b.rawValue ?? '');
                if (code != null) {
                  _done = true;
                  context.pushReplacement('/invitation/$code');
                  return;
                }
              }
              setState(() => _error = d.auth.scanInvalid);
            },
          ),
          Center(
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(border: Border.all(color: SuColors.cta, width: 3), borderRadius: BorderRadius.circular(32)),
            ),
          ),
          PositionedDirectional(
            start: 24,
            end: 24,
            bottom: 40,
            child: SafeArea(
              top: false,
              child: Column(
                children: [
                  // Consigne en pill encre (rouge profond si le QR n'est pas reconnu).
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                    decoration: BoxDecoration(color: _error != null ? SuColors.danger : SuColors.ink, borderRadius: BorderRadius.circular(SuRadius.pill)),
                    child: Text(_error ?? d.auth.scanHint, style: t.labelMedium?.copyWith(color: Colors.white, height: 1.35), textAlign: TextAlign.center),
                  ),
                  const SizedBox(height: 18),
                  CircleIconButton(icon: Icons.flashlight_on_rounded, size: 56, color: SuColors.surface, iconColor: SuColors.ink, onTap: () => _controller.toggleTorch()),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

final _apercuProvider = FutureProvider.autoDispose.family<InviteApercu, String>((ref, code) async {
  final jeton = await ref.watch(invitationJetonProvider.future);
  final r = await ref.watch(apiClientProvider).get<InviteApercu>('/auth/invite/${Uri.encodeComponent(code)}', query: {'jeton': jeton}, parse: (j) => InviteApercu.fromJson(asMap(j)));
  return r.dataOrNull ?? const InviteApercu(coproprieteNom: '', ville: '', roleCible: '', expireLe: '', statut: 'INVALIDE');
});

/// A3 — contexte de l'invitation (copropriété, rôle, validité) puis acceptation (connecté) ou
/// inscription en un geste (identité + e-mail + mot de passe).
class InvitationCodeScreen extends ConsumerStatefulWidget {
  const InvitationCodeScreen({super.key, required this.code});
  final String code;
  @override
  ConsumerState<InvitationCodeScreen> createState() => _InvitationCodeScreenState();
}

class _InvitationCodeScreenState extends ConsumerState<InvitationCodeScreen> {
  final _prenom = TextEditingController();
  final _nom = TextEditingController();
  final _email = TextEditingController();
  final _pwd = TextEditingController();
  String _langue = 'FR';
  bool _loading = false;
  ApiFail? _fail;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => setState(() => _langue = context.isRtl ? 'AR' : 'FR'));
  }

  /// Écran de succès Wise (« ok-invitation »), posé sur le navigateur racine UNE FOIS la
  /// session résolue et la redirection vers l'accueil appliquée (cet écran est alors démonté).
  /// Tout ce qui dépend du contexte (dictionnaire, navigateur, conteneur) est capturé AVANT les
  /// appels réseau.
  Future<void> _succes(Dict d, NavigatorState racine, ProviderContainer conteneur, String nom, String statutCompte) async {
    final titre = statutCompte == 'EN_VALIDATION' ? d.auth.inviteAccepted : fill(d.auth.inviteBienvenue, {'nom': nom});
    final AppState etat;
    try {
      etat = await conteneur.read(appStateProvider.future);
    } catch (_) {
      return; // erreur de résolution : l'écran d'amorçage l'affiche déjà
    }
    if (etat is! AppReady && etat is! AppEnValidation) return;
    await WidgetsBinding.instance.endOfFrame;
    if (racine.mounted) await showSuccess(racine.context, title: titre, illustration: 'ok-invitation');
  }

  Future<void> _accepter() async {
    setState(() {
      _loading = true;
      _fail = null;
    });
    final d = context.dict;
    final racine = Navigator.of(context, rootNavigator: true);
    final conteneur = ProviderScope.containerOf(context, listen: false);
    final nom = ref.read(_apercuProvider(widget.code)).valueOrNull?.coproprieteNom ?? '';
    final api = ref.read(apiClientProvider);
    final jeton = await ref.read(invitationJetonProvider.future);
    final res = await api.post<InviteAcceptResult>('/auth/invite/accept', body: {'code': widget.code, 'jeton': jeton}, parse: (j) => InviteAcceptResult.fromJson(asMap(j)));
    if (!mounted) return;
    if (res is ApiFail<InviteAcceptResult>) {
      setState(() {
        _loading = false;
        _fail = res;
      });
      return;
    }
    final data = (res as ApiOk<InviteAcceptResult>).data;
    // Le rôle vient d'être attribué : le jeton courant ne le porte pas encore → refresh.
    await api.refreshSession();
    await ref.read(sessionProvider.notifier).chooseCopropriete(data.coproprieteId);
    final infos = <String, String>{};
    if (_prenom.text.trim().isNotEmpty) infos['prenom'] = _prenom.text.trim();
    if (_nom.text.trim().isNotEmpty) infos['nom'] = _nom.text.trim();
    infos['langue_preferee'] = _langue;
    await api.patch<dynamic>('/users/me', body: infos, coproprieteId: data.coproprieteId);
    await ref.read(appStateProvider.notifier).reload();
    await _succes(d, racine, conteneur, nom, data.statutCompte);
  }

  Future<void> _inscrire() async {
    setState(() {
      _loading = true;
      _fail = null;
    });
    final racine = Navigator.of(context, rootNavigator: true);
    final conteneur = ProviderScope.containerOf(context, listen: false);
    final nom = ref.read(_apercuProvider(widget.code)).valueOrNull?.coproprieteNom ?? '';
    final api = ref.read(apiClientProvider);
    final jeton = await ref.read(invitationJetonProvider.future);
    final res = await api.post<InviteInscriptionResult>(
      '/auth/invite/inscription',
      auth: false,
      body: {
        'code': widget.code,
        'email': _email.text.trim(),
        'mot_de_passe': _pwd.text,
        'prenom': _prenom.text.trim(),
        'nom': _nom.text.trim(),
        'langue_preferee': _langue,
        'jeton': jeton,
      },
      parse: (j) => InviteInscriptionResult.fromJson(asMap(j)),
    );
    if (!mounted) return;
    if (res is ApiFail<InviteInscriptionResult>) {
      setState(() {
        _loading = false;
        _fail = res;
      });
      return;
    }
    final data = (res as ApiOk<InviteInscriptionResult>).data;
    await ref.read(localeProvider.notifier).set(Locale(_langue == 'AR' ? 'ar' : 'fr'));
    await ref.read(sessionProvider.notifier).signIn(data.tokens, coproprieteId: data.coproprieteId);
    // Succès dans la langue choisie à l'inscription.
    await _succes(Locale(_langue == 'AR' ? 'ar' : 'fr').dict, racine, conteneur, nom, data.statutCompte);
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final md = context.mdict;
    final t = Theme.of(context).textTheme;
    final apercu = ref.watch(_apercuProvider(widget.code));
    final session = ref.watch(sessionProvider);
    return PublicScaffold(
      showBack: true,
      children: [
        apercu.when(
          loading: () => const Padding(padding: EdgeInsets.only(top: 24), child: LoadingList(count: 3)),
          error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(_apercuProvider(widget.code))),
          data: (a) {
            if (a.statut != 'EN_ATTENTE') {
              final msg = switch (a.statut) {
                'ACCEPTEE' => d.auth.inviteAlreadyUsed,
                'OUVERTE' => d.auth.inviteOuverteAilleurs,
                'INVALIDE' => d.auth.inviteInvalide,
                _ => d.auth.inviteExpired,
              };
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(child: IconCircle(Icons.vpn_key_rounded, tone: a.statut == 'ACCEPTEE' ? Tone.sage : Tone.sand, size: 80)),
                  const SizedBox(height: 18),
                  Text(d.auth.inviteTitle, style: t.displayMedium, textAlign: TextAlign.center),
                  const SizedBox(height: 6),
                  Text(widget.code, textAlign: TextAlign.center, textDirection: TextDirection.ltr, style: t.titleLarge?.copyWith(fontFamily: 'GeistMono', letterSpacing: 4, color: SuColors.soft)),
                  const SizedBox(height: 20),
                  SuBanner(tone: a.statut == 'ACCEPTEE' ? BannerTone.info : BannerTone.warn, body: msg),
                  const SizedBox(height: 20),
                  SuButton(label: d.auth.signIn, onPressed: () => context.go(session == null ? '/connexion' : '/')),
                  const SizedBox(height: 10),
                  SuButton(label: d.auth.inviteEnterCode, variant: SuButtonVariant.secondary, onPressed: () => context.go('/invitation')),
                ],
              );
            }
            final role = d.roles[a.roleCible] ?? a.roleCible;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Center(child: IconCircle(Icons.handshake_rounded, tone: Tone.sand, size: 80)),
                const SizedBox(height: 18),
                Text(fill(d.auth.inviteRejoindre, {'nom': a.coproprieteNom}), style: t.displayMedium, textAlign: TextAlign.center),
                const SizedBox(height: 10),
                Wrap(
                  alignment: WrapAlignment.center,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    StatusBadge(fill(d.auth.inviteEnTantQue, {'role': role}), variant: BadgeVariant.info),
                    Text(a.ville, style: t.bodyMedium?.copyWith(color: SuColors.soft)),
                  ],
                ),
                const SizedBox(height: 6),
                Text(fill(d.auth.inviteExpireLe, {'date': formatDateHeure(a.expireLe, context.locale)}), style: t.labelSmall, textAlign: TextAlign.center),
                // Formulaire à plat (comme la connexion) sous un titre de section Wise.
                SectionHeader(d.auth.inviteVosInfos, subtitle: d.auth.inviteVosInfosAide),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SuField(label: d.profil.prenom, controller: _prenom, error: fieldError(_fail, 'prenom'), required: session == null, textInputAction: TextInputAction.next, autofillHints: const [AutofillHints.givenName]),
                    const SizedBox(height: 12),
                    SuField(label: d.profil.nom, controller: _nom, error: fieldError(_fail, 'nom'), required: session == null, textInputAction: TextInputAction.next, autofillHints: const [AutofillHints.familyName]),
                    const SizedBox(height: 12),
                    if (session == null) ...[
                      SuField(label: d.auth.emailLabel, controller: _email, keyboardType: TextInputType.emailAddress, textDirection: TextDirection.ltr, help: d.auth.inviteEmailAide, error: fieldError(_fail, 'email'), required: true, autofillHints: const [AutofillHints.email], textInputAction: TextInputAction.next),
                      const SizedBox(height: 12),
                      SuField(label: d.auth.passwordLabel, controller: _pwd, obscureText: true, textDirection: TextDirection.ltr, help: d.auth.inviteMotDePasseAide, error: fieldError(_fail, 'mot_de_passe'), required: true, autofillHints: const [AutofillHints.newPassword]),
                      const SizedBox(height: 12),
                    ],
                    Text(d.profil.langue, style: t.labelMedium?.copyWith(color: SuColors.ink)),
                    const SizedBox(height: 8),
                    Segmented<String>(value: _langue, options: const ['FR', 'AR'], labelOf: (l) => l == 'FR' ? d.common.french : d.common.arabic, onChanged: (l) => setState(() => _langue = l)),
                    const SizedBox(height: 20),
                    FormError(_fail),
                    if (_fail != null) const SizedBox(height: 12),
                    SubmitButton(label: session == null ? d.auth.inviteCreerCompte : d.auth.inviteAccept, loading: _loading, onPressed: session == null ? _inscrire : _accepter, fail: _fail),
                    if (session == null) ...[
                      const SizedBox(height: 8),
                      SuButton(label: d.auth.inviteDejaCompte, variant: SuButtonVariant.ghost, onPressed: () => context.push('/connexion?next=${Uri.encodeComponent('/invitation/${widget.code}')}')),
                    ],
                  ],
                ),
                const SizedBox(height: 20),
                Text(md.contactSyndic, style: t.labelSmall, textAlign: TextAlign.center),
              ],
            );
          },
        ),
      ],
    );
  }
}

/// A4 — sélecteur de copropriété (JWT multi-rôles).
class ChooseCoproScreen extends ConsumerWidget {
  const ChooseCoproScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final st = ref.watch(appStateProvider).valueOrNull;
    final List<Copropriete> copros;
    final Profil? profil;
    if (st is AppChooseCopro) {
      copros = st.coproprietes;
      profil = st.profil;
    } else if (st is AppReady) {
      final ids = st.ctx.profil.roles.where((r) => r.actif).map((r) => r.coproprieteId).toSet();
      copros = st.ctx.coproprietes.where((c) => ids.contains(c.id)).toList();
      profil = st.ctx.profil;
    } else {
      copros = const [];
      profil = null;
    }
    String roleDans(String coproId) => profil?.roles.where((r) => r.actif && r.coproprieteId == coproId).map((r) => d.roles[r.role] ?? r.role).join(' · ') ?? '';
    return PublicScaffold(
      showBack: true,
      children: [
        Text(d.auth.chooseCoproTitle, style: t.displayMedium),
        const SizedBox(height: 8),
        Text(d.auth.chooseCoproSubtitle, style: t.bodyLarge?.copyWith(color: SuColors.soft)),
        const SizedBox(height: 20),
        // Sélecteur de comptes Wise : lignes à plat, pastille-logo 48 (initiales), chevron vert.
        CardList([
          for (final c in copros)
            ListRow(
              key: ValueKey(c.id),
              leading: Avatar(c.nom, size: 48),
              title: c.nom,
              subtitle: [c.ville, roleDans(c.id)].where((x) => x.isNotEmpty).join(' · '),
              chevron: true,
              onTap: () async {
                await ref.read(sessionProvider.notifier).chooseCopropriete(c.id);
                await ref.read(appStateProvider.notifier).reload();
                if (context.mounted) context.go('/tableau-de-bord');
              },
            ),
        ]),
        const SizedBox(height: 16),
        Center(child: SuButton(label: d.common.logout, variant: SuButtonVariant.ghost, onPressed: () => ref.read(sessionProvider.notifier).signOut(), style: TextButton.styleFrom(foregroundColor: SuColors.soft))),
      ],
    );
  }
}

/// A5 — états de compte bloquants (suspendu, en validation, sans accès).
class CompteEtatScreen extends ConsumerWidget {
  const CompteEtatScreen({super.key, required this.kind});
  final String kind; // suspendu | validation | sans-acces
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final (String title, String body, IconData icon, Tone tone) = switch (kind) {
      'suspendu' => (d.auth.suspendedTitle, d.auth.suspendedBody, Icons.lock_outline_rounded, Tone.danger),
      'validation' => (d.auth.validationTitle, d.auth.validationBody, Icons.hourglass_top_rounded, Tone.warn),
      _ => (d.auth.inviteTitle, d.auth.inviteSignInFirst, Icons.vpn_key_rounded, Tone.sand),
    };
    return PublicScaffold(
      children: [
        const SizedBox(height: 24),
        Center(child: IconCircle(icon, tone: tone, size: 88)),
        const SizedBox(height: 24),
        Text(title, style: t.displayMedium, textAlign: TextAlign.center),
        const SizedBox(height: 10),
        Text(body, style: t.bodyLarge?.copyWith(color: SuColors.soft, height: 1.5), textAlign: TextAlign.center),
        const SizedBox(height: 32),
        if (kind == 'sans-acces') ...[SuButton(label: d.auth.inviteEnterCode, onPressed: () => context.go('/invitation')), const SizedBox(height: 10)],
        SuButton(label: d.common.retry, variant: SuButtonVariant.secondary, onPressed: () => ref.read(appStateProvider.notifier).reload()),
        const SizedBox(height: 8),
        Center(child: SuButton(label: d.common.logout, variant: SuButtonVariant.ghost, onPressed: () => ref.read(sessionProvider.notifier).signOut(), style: TextButton.styleFrom(foregroundColor: SuColors.soft))),
      ],
    );
  }
}

/// Écran d'amorçage (résolution de la session).
class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final st = ref.watch(appStateProvider);
    // Le logo du démarrage sera relayé vers l'en-tête de la coque (pas de coupure sèche).
    LaunchHandoff.arm();
    return Scaffold(
      backgroundColor: SuColors.surface,
      body: Center(
        child: st.hasError
            ? Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ErrorState(error: st.error!, onRetry: () => ref.read(appStateProvider.notifier).reload()),
                    const SizedBox(height: 12),
                    SuButton(label: context.dict.common.logout, variant: SuButtonVariant.ghost, onPressed: () => ref.read(sessionProvider.notifier).signOut(), style: TextButton.styleFrom(foregroundColor: SuColors.soft)),
                  ],
                ),
              )
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Marque qui éclot, puis orbe « vivant » pendant la résolution de session.
                  SuEnter(offset: 0.2, child: const Brand(size: 44)),
                  const SizedBox(height: 28),
                  const SuEnter(index: 4, child: LoadingOrb(size: 10)),
                ],
              ),
      ),
    );
  }
}
