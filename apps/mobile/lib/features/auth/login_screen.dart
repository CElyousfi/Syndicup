import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_result.dart';
import '../../core/api/models.dart';
import '../../core/auth/session.dart';
import '../../core/format/format.dart';
import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/widgets.dart';
import 'welcome_screen.dart';

/// A1 — connexion : OTP téléphone par défaut (résidents/gardiens), e-mail + mot de passe pour
/// les MRE/syndics. `next` : chemin de retour (ex. /invitation/{code}).
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key, this.next});
  final String? next;
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  String _mode = 'phone';
  final _tel = TextEditingController();
  final _email = TextEditingController();
  final _pwd = TextEditingController();
  bool _loading = false;
  ApiFail? _fail;
  String? _telError;

  @override
  void dispose() {
    _tel.dispose();
    _email.dispose();
    _pwd.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    final d = context.dict;
    final tel = normaliserTelephone(_tel.text);
    if (tel == null) {
      setState(() => _telError = d.auth.invalidPhone);
      return;
    }
    setState(() {
      _loading = true;
      _fail = null;
      _telError = null;
    });
    final res = await ref.read(apiClientProvider).post<dynamic>('/auth/otp/request', body: {'telephone': tel}, auth: false);
    if (!mounted) return;
    setState(() => _loading = false);
    if (res is ApiFail) {
      setState(() => _fail = res);
      return;
    }
    context.push('/connexion/code?tel=${Uri.encodeComponent(tel)}${widget.next != null ? '&next=${Uri.encodeComponent(widget.next!)}' : ''}');
  }

  Future<void> _loginEmail() async {
    setState(() {
      _loading = true;
      _fail = null;
    });
    final res = await ref.read(apiClientProvider).post<SessionTokens>(
          '/auth/login',
          body: {'email': _email.text.trim(), 'mot_de_passe': _pwd.text},
          auth: false,
          parse: (j) => SessionTokens.fromJson(asMap(j)),
        );
    if (!mounted) return;
    switch (res) {
      case ApiOk<SessionTokens>(:final data):
        await ref.read(sessionProvider.notifier).signIn(data);
        if (!mounted) return;
        if (widget.next != null) context.go(widget.next!);
      case ApiFail<SessionTokens>():
        setState(() {
          _loading = false;
          _fail = res;
        });
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final md = context.mdict;
    final t = Theme.of(context).textTheme;
    return PublicScaffold(
      showBack: true,
      children: [
        Text(d.auth.loginTitle, style: t.displayMedium),
        const SizedBox(height: 4),
        Text(d.auth.loginSubtitle, style: t.bodyMedium?.copyWith(color: SuColors.soft)),
        const SizedBox(height: 24),
        SuCard(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Segmented<String>(value: _mode, options: const ['phone', 'email'], labelOf: (m) => m == 'phone' ? d.auth.tabPhone : d.auth.tabEmail, onChanged: (m) => setState(() { _mode = m; _fail = null; })),
              const SizedBox(height: 20),
              if (_mode == 'phone') ...[
                SuField(
                  label: d.auth.phoneLabel,
                  controller: _tel,
                  keyboardType: TextInputType.phone,
                  textDirection: TextDirection.ltr,
                  hint: '+212 6 00 00 00 00',
                  help: d.auth.phoneHint,
                  error: _telError ?? fieldError(_fail, 'telephone'),
                  autofocus: true,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _sendOtp(),
                  autofillHints: const [AutofillHints.telephoneNumber],
                  inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9+ ]'))],
                ),
                const SizedBox(height: 16),
                FormError(_fail),
                if (_fail != null) const SizedBox(height: 12),
                SubmitButton(label: d.auth.sendCode, loading: _loading, onPressed: _sendOtp),
              ] else ...[
                SuField(label: d.auth.emailLabel, controller: _email, keyboardType: TextInputType.emailAddress, textDirection: TextDirection.ltr, error: fieldError(_fail, 'email'), autofillHints: const [AutofillHints.email], textInputAction: TextInputAction.next),
                const SizedBox(height: 14),
                SuField(label: d.auth.passwordLabel, controller: _pwd, obscureText: true, textDirection: TextDirection.ltr, error: fieldError(_fail, 'mot_de_passe'), autofillHints: const [AutofillHints.password], textInputAction: TextInputAction.done, onSubmitted: (_) => _loginEmail()),
                const SizedBox(height: 16),
                if (_fail?.status == 401) SuBanner(tone: BannerTone.danger, body: d.auth.invalidCredentials) else FormError(_fail),
                if (_fail != null) const SizedBox(height: 12),
                SubmitButton(label: d.auth.signIn, loading: _loading, onPressed: _loginEmail),
              ],
            ],
          ),
        ),
        const SizedBox(height: 24),
        OutlinedButton.icon(onPressed: () => context.push('/invitation/scan'), icon: const Icon(Icons.qr_code_scanner_rounded, size: 18), label: Text(md.startScan)),
        const SizedBox(height: 12),
        Center(child: TextButton(onPressed: () => context.push('/invitation'), child: Text(d.auth.inviteEnterCode))),
      ],
    );
  }
}

/// A2 — code à 6 chiffres, auto-avance, coller supporté, renvoi avec compte à rebours.
class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.telephone, this.next});
  final String telephone;
  final String? next;
  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _code = TextEditingController();
  final _focus = FocusNode();
  bool _loading = false;
  ApiFail? _fail;
  int _countdown = 60;
  bool _resent = false;

  @override
  void initState() {
    super.initState();
    _tick();
    WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
  }

  void _tick() {
    Future.delayed(const Duration(seconds: 1), () {
      if (!mounted) return;
      if (_countdown > 0) {
        setState(() => _countdown--);
        _tick();
      }
    });
  }

  @override
  void dispose() {
    _code.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final code = _code.text.replaceAll(RegExp(r'\D'), '');
    if (code.length != 6) return;
    setState(() {
      _loading = true;
      _fail = null;
    });
    final res = await ref.read(apiClientProvider).post<SessionTokens>(
          '/auth/otp/verify',
          body: {'telephone': widget.telephone, 'code': code},
          auth: false,
          parse: (j) => SessionTokens.fromJson(asMap(j)),
        );
    if (!mounted) return;
    switch (res) {
      case ApiOk<SessionTokens>(:final data):
        await ref.read(sessionProvider.notifier).signIn(data);
        if (!mounted) return;
        if (widget.next != null) context.go(widget.next!);
      case ApiFail<SessionTokens>():
        setState(() {
          _loading = false;
          _fail = res;
          _code.clear();
        });
    }
  }

  Future<void> _resend() async {
    final res = await ref.read(apiClientProvider).post<dynamic>('/auth/otp/request', body: {'telephone': widget.telephone}, auth: false);
    if (!mounted) return;
    if (res is ApiFail) {
      setState(() => _fail = res);
    } else {
      setState(() {
        _countdown = 60;
        _resent = true;
        _fail = null;
      });
      _tick();
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final digits = _code.text.replaceAll(RegExp(r'\D'), '');
    return PublicScaffold(
      showBack: true,
      children: [
        Text(d.auth.otpTitle, style: t.displayMedium),
        const SizedBox(height: 4),
        Text(fill(d.auth.otpSubtitle, {'telephone': formatTelephone(widget.telephone)}), style: t.bodyMedium?.copyWith(color: SuColors.soft)),
        const SizedBox(height: 24),
        SuCard(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              GestureDetector(
                onTap: () => _focus.requestFocus(),
                child: Stack(
                  children: [
                    Directionality(
                      textDirection: TextDirection.ltr,
                      child: Row(
                        children: [
                          for (int i = 0; i < 6; i++) ...[
                            Expanded(
                              child: Semantics(
                                label: fill(d.a11y.otpDigit, {'n': i + 1}),
                                child: Container(
                                  height: 56,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: SuColors.surface,
                                    borderRadius: BorderRadius.circular(SuRadius.field),
                                    border: Border.all(color: i == digits.length ? SuColors.action : SuColors.hairlineStrong, width: i == digits.length ? 1.5 : 1),
                                  ),
                                  child: Text(i < digits.length ? digits[i] : '', style: t.headlineMedium?.copyWith(fontSize: 20, fontFeatures: const [FontFeature.tabularFigures()])),
                                ),
                              ),
                            ),
                            if (i < 5) const SizedBox(width: 6),
                          ],
                        ],
                      ),
                    ),
                    Opacity(
                      opacity: 0,
                      child: TextField(
                        controller: _code,
                        focusNode: _focus,
                        keyboardType: TextInputType.number,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
                        autofillHints: const [AutofillHints.oneTimeCode],
                        onChanged: (v) {
                          setState(() {});
                          if (v.length == 6) _verify();
                        },
                      ),
                    ),
                  ],
                ),
              ),
              if (_fail != null) ...[
                const SizedBox(height: 12),
                _fail!.status == 401 ? Text(d.auth.otpInvalid, style: t.bodySmall?.copyWith(color: SuColors.danger)) : FormError(_fail),
              ],
              if (_resent) ...[const SizedBox(height: 12), SuBanner(tone: BannerTone.ok, body: d.auth.otpResend)],
              const SizedBox(height: 20),
              SubmitButton(label: d.auth.signIn, loading: _loading, onPressed: digits.length == 6 ? _verify : null),
            ],
          ),
        ),
        const SizedBox(height: 20),
        Center(
          child: _countdown > 0
              ? Text(fill(d.auth.otpResendIn, {'s': _countdown}), style: t.labelSmall?.copyWith(fontSize: 13, fontWeight: FontWeight.w400))
              : TextButton(onPressed: _resend, child: Text(d.auth.otpResend)),
        ),
        Center(child: TextButton(onPressed: () => context.pop(), style: TextButton.styleFrom(foregroundColor: SuColors.soft), child: Text(d.auth.otpChangeNumber))),
      ],
    );
  }
}
