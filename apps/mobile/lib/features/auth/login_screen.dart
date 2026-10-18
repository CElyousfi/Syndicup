import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_result.dart';
import '../../core/api/models.dart';
import '../../core/auth/biometric_lock.dart';
import '../../core/auth/session.dart';
import '../../core/auth/session_events.dart';
import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/widgets.dart';
import 'welcome_screen.dart';

/// A1 — connexion : e-mail + mot de passe, un seul chemin (l'OTP SMS a été retiré — oct. 2026).
/// Après la première connexion réussie, propose d'activer Face ID / l'empreinte.
/// `next` : chemin de retour (ex. /invitation/{code}).
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key, this.next, this.expired = false});
  final String? next;

  /// Arrivée après une fin de session : on le dit (toast) au lieu d'un retour muet à la connexion.
  final bool expired;
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _pwd = TextEditingController();
  bool _loading = false;
  bool _showPwd = false;
  ApiFail? _fail;

  String? _emailError;
  String? _pwdError;

  @override
  void initState() {
    super.initState();
    if (widget.expired) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) showToast(context, context.mdict.ux.sessionExpired);
      });
    }
  }

  @override
  void dispose() {
    _email.dispose();
    _pwd.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (_loading) return;
    final ux = context.mdict.ux;
    final email = _email.text.trim();
    // Saisie incomplète : on le dit sous le champ (secousse + warning()), jamais un bouton muet.
    final emailError = email.isEmpty ? ux.emailRequired : (emailValide(email) ? null : ux.emailInvalid);
    final pwdError = _pwd.text.length < 8 ? ux.passwordShort : null;
    if (emailError != null || pwdError != null) {
      setState(() {
        _emailError = emailError;
        _pwdError = pwdError;
      });
      return;
    }
    setState(() {
      _emailError = null;
      _pwdError = null;
      _loading = true;
      _fail = null;
    });
    final res = await ref.read(apiClientProvider).post<SessionTokens>(
          '/auth/login',
          body: {'email': _email.text.trim().toLowerCase(), 'mot_de_passe': _pwd.text},
          auth: false,
          parse: (j) => SessionTokens.fromJson(asMap(j)),
        );
    if (!mounted) return;
    switch (res) {
      case ApiOk<SessionTokens>(:final data):
        // Chemin de retour posé AVANT la session : le routeur y va dès que le contexte est prêt.
        final next = widget.next;
        if (next != null && next.startsWith('/') && !next.startsWith('//')) SessionEvents.instance.rememberReturn(next);
        await ref.read(sessionProvider.notifier).signIn(data);
        if (!mounted) return;
        await _proposeBiometrics();
        if (!mounted) return;
        if (widget.next != null) context.go(widget.next!);
      case ApiFail<SessionTokens>():
        setState(() {
          _loading = false;
          _fail = res;
        });
    }
  }

  /// Une seule fois par installation, si l'appareil a une biométrie enrôlée.
  Future<void> _proposeBiometrics() async {
    final bio = ref.read(biometricLockProvider);
    if (bio.alreadyAsked || bio.enabled || !await bio.available) return;
    await bio.markAsked();
    if (!mounted) return;
    final md = context.mdict;
    final yes = await confirmDialog(context, title: md.bioEnableTitle, body: md.bioEnableBody, confirmLabel: md.bioEnableYes);
    if (yes && await bio.authenticate(md.bioUnlockReason)) await bio.setEnabled(true);
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final invalid = _fail?.error.code == 'UNAUTHENTICATED';
    return PublicScaffold(
      showBack: true,
      children: [
        Text(d.auth.loginTitle, style: t.displayMedium),
        const SizedBox(height: 8),
        Text(d.auth.loginSubtitle, style: t.bodyLarge?.copyWith(color: SuColors.soft)),
        const SizedBox(height: 28),
        AutofillGroup(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SuField(
                label: d.auth.emailLabel,
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                textDirection: TextDirection.ltr,
                hint: 'nom@exemple.ma',
                autofocus: true,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.email],
                error: _emailError ?? fieldError(_fail, 'email'),
                onChanged: (_) {
                  if (_emailError != null) setState(() => _emailError = null);
                },
              ),
              const SizedBox(height: 16),
              SuField(
                label: d.auth.passwordLabel,
                controller: _pwd,
                obscureText: !_showPwd,
                textDirection: TextDirection.ltr,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _login(),
                autofillHints: const [AutofillHints.password],
                error: _pwdError ?? (invalid ? d.auth.invalidCredentials : fieldError(_fail, 'mot_de_passe')),
                onChanged: (_) {
                  if (_pwdError != null) setState(() => _pwdError = null);
                },
                suffix: SuIconButton(
                  icon: _showPwd ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                  iconSize: 20,
                  color: SuColors.faint,
                  onPressed: () => setState(() => _showPwd = !_showPwd),
                ),
              ),
              const SizedBox(height: 10),
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: SuButton(
                  label: d.auth.forgotPassword,
                  variant: SuButtonVariant.ghost,
                  size: SuButtonSize.sm,
                  onPressed: () => context.push('/connexion/mot-de-passe-oublie${_email.text.trim().isEmpty ? '' : '?email=${Uri.encodeComponent(_email.text.trim())}'}'),
                ),
              ),
              const SizedBox(height: 16),
              if (!invalid) FormError(_fail),
              if (!invalid && _fail != null) const SizedBox(height: 12),
              SubmitButton(label: d.auth.signIn, loading: _loading, onPressed: _login, fail: _fail),
            ],
          ),
        ),
        const SizedBox(height: 28),
        Center(
          child: SuButton(
            label: d.auth.inviteEnterCode,
            variant: SuButtonVariant.ghost,
            onPressed: () => context.push('/invitation'),
            style: TextButton.styleFrom(foregroundColor: SuColors.soft),
          ),
        ),
      ],
    );
  }
}

/// Mot de passe oublié : un e-mail, et un lien part (réponse identique que le compte existe ou
/// non). Le lien ouvre app.syndicup.pro/{langue}/reinitialiser dans le navigateur.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key, this.email});
  final String? email;
  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  late final _email = TextEditingController(text: widget.email ?? '');
  bool _loading = false;
  bool _sent = false;
  ApiFail? _fail;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  String? _emailError;

  Future<void> _send() async {
    if (_loading) return;
    final email = _email.text.trim().toLowerCase();
    final ux = context.mdict.ux;
    final err = email.isEmpty ? ux.emailRequired : (emailValide(email) ? null : ux.emailInvalid);
    if (err != null) {
      setState(() => _emailError = err);
      return;
    }
    setState(() {
      _emailError = null;
      _loading = true;
      _fail = null;
    });
    final langue = Localizations.localeOf(context).languageCode == 'ar' ? 'ar' : 'fr';
    final res = await ref.read(apiClientProvider).post<dynamic>('/auth/password/forgot', body: {'email': email, 'langue': langue}, auth: false);
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res is ApiFail) {
        _fail = res;
      } else {
        _sent = true;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    if (_sent) {
      return PublicScaffold(
        showBack: true,
        children: [
          const Icon(Icons.mark_email_read_rounded, size: 44, color: SuColors.brand),
          const SizedBox(height: 16),
          Text(d.auth.forgotSentTitle, style: t.displayMedium),
          const SizedBox(height: 10),
          Text(fill(d.auth.forgotSentBody, {'email': _email.text.trim()}), style: t.bodyLarge?.copyWith(color: SuColors.soft)),
          const SizedBox(height: 28),
          SuButton(label: d.auth.backToLogin, onPressed: () => context.go('/connexion'), size: SuButtonSize.lg, expand: true),
        ],
      );
    }
    return PublicScaffold(
      showBack: true,
      children: [
        Text(d.auth.forgotTitle, style: t.displayMedium),
        const SizedBox(height: 8),
        Text(d.auth.forgotSubtitle, style: t.bodyLarge?.copyWith(color: SuColors.soft)),
        const SizedBox(height: 28),
        SuField(
          label: d.auth.emailLabel,
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          textDirection: TextDirection.ltr,
          hint: 'nom@exemple.ma',
          autofocus: true,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _send(),
          autofillHints: const [AutofillHints.email],
          error: _emailError ?? fieldError(_fail, 'email'),
          onChanged: (_) {
            if (_emailError != null) setState(() => _emailError = null);
          },
        ),
        const SizedBox(height: 16),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(label: d.auth.forgotSubmit, loading: _loading, onPressed: _send, fail: _fail),
      ],
    );
  }
}

/// Adresse e-mail plausible (contrôle de forme seulement — le serveur reste juge).
bool emailValide(String email) => RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$').hasMatch(email.trim());
