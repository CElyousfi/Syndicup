import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/biometric_lock.dart';
import '../../core/auth/session.dart';
import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/widgets.dart';

/// Voile de verrouillage biométrique : couvre toute l'app tant que `lockedProvider` est vrai.
/// Lance la biométrie dès l'affichage ; « Utiliser mon mot de passe » déconnecte proprement.
class LockScreen extends ConsumerStatefulWidget {
  const LockScreen({super.key});
  @override
  ConsumerState<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends ConsumerState<LockScreen> {
  bool _busy = false;

  /// Message après un échec (non reconnu, trop d'essais, biométrie indisponible).
  String? _message;
  Object? _fail;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _tryUnlock());
  }

  Future<void> _tryUnlock() async {
    if (_busy) return;
    final ux = context.mdict.ux;
    setState(() {
      _busy = true;
      _message = null;
    });
    final r = await ref.read(biometricLockProvider).authenticateDetailed(context.mdict.bioUnlockReason);
    if (!mounted) return;
    setState(() {
      _busy = false;
      _message = switch (r) {
        BioResult.ok => null,
        BioResult.failed => ux.bioFailed,
        BioResult.lockedOut => ux.bioLockedOut,
        BioResult.unavailable => ux.bioUnavailable,
      };
      if (r != BioResult.ok) _fail = Object();
    });
    if (r == BioResult.ok) ref.read(lockedProvider.notifier).unlock();
  }

  /// Confirmation en ligne : le voile est posé AU-DESSUS du navigateur (MaterialApp.builder),
  /// un dialogue n'y aurait pas de Navigator — la question s'affiche donc dans l'écran même.
  bool _confirmLogout = false;

  Future<void> _usePassword() async {
    // Se déconnecter n'est pas anodin : premier appui = on explique, second = on déconnecte.
    if (!_confirmLogout) {
      setState(() => _confirmLogout = true);
      return;
    }
    await ref.read(biometricLockProvider).setEnabled(false);
    ref.read(lockedProvider.notifier).unlock();
    await ref.read(sessionProvider.notifier).signOut();
  }

  @override
  Widget build(BuildContext context) {
    final md = context.mdict;
    return Scaffold(
      backgroundColor: SuColors.surface,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Center(child: Brand(size: 44)),
                  const SizedBox(height: 40),
                  const Icon(Icons.fingerprint_rounded, size: 56, color: SuColors.brand),
                  const SizedBox(height: 16),
                  Text(md.bioUnlockReason, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge),
                  if (_message != null) ...[
                    const SizedBox(height: 16),
                    SuBanner(tone: BannerTone.warn, body: _message!),
                  ],
                  const SizedBox(height: 28),
                  SuButton(label: md.bioUnlockButton, loading: _busy, fail: _fail, onPressed: _tryUnlock, size: SuButtonSize.lg, expand: true),
                  const SizedBox(height: 8),
                  if (_confirmLogout) ...[
                    SuBanner(tone: BannerTone.info, title: md.ux.bioUsePasswordTitle, body: md.ux.bioUsePasswordBody),
                    const SizedBox(height: 10),
                    SuButton(label: md.ux.bioUsePasswordConfirm, variant: SuButtonVariant.danger, onPressed: _usePassword, expand: true),
                    SuButton(label: context.dict.common.cancel, variant: SuButtonVariant.ghost, onPressed: () => setState(() => _confirmLogout = false)),
                  ] else
                    SuButton(label: md.bioUseOther, variant: SuButtonVariant.ghost, onPressed: _usePassword, style: TextButton.styleFrom(foregroundColor: SuColors.soft)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
