import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/biometric_lock.dart';
import '../../core/auth/session.dart';
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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _tryUnlock());
  }

  Future<void> _tryUnlock() async {
    if (_busy) return;
    setState(() => _busy = true);
    final ok = await ref.read(biometricLockProvider).authenticate(context.mdict.bioUnlockReason);
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) ref.read(lockedProvider.notifier).unlock();
  }

  Future<void> _usePassword() async {
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
            child: Padding(
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
                  const SizedBox(height: 28),
                  SuButton(label: md.bioUnlockButton, loading: _busy, onPressed: _tryUnlock, size: SuButtonSize.lg, expand: true),
                  const SizedBox(height: 8),
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
