import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/i18n/mobile_dict.dart';
import '../../core/theme/tokens.dart';
import '../../core/update/update_gate.dart';
import '../../core/widgets/widgets.dart';

Future<void> _openStore(String? url) async {
  if (url == null) return;
  final uri = Uri.parse(url);
  if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) await launchUrl(uri);
}

/// Écran plein, sans issue : la version est sous la minimale. Le seul bouton ouvre le store.
class UpdateRequiredScreen extends StatelessWidget {
  const UpdateRequiredScreen({super.key, required this.verdict});
  final UpdateVerdict verdict;

  @override
  Widget build(BuildContext context) {
    final md = context.mdict;
    final t = Theme.of(context).textTheme;
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: SuColors.surface,
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 380),
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Center(child: Brand(size: 44)),
                    const SizedBox(height: 40),
                    const Icon(Icons.system_update_rounded, size: 56, color: SuColors.brand),
                    const SizedBox(height: 16),
                    Text(md.updateRequiredTitle, textAlign: TextAlign.center, style: t.displayMedium),
                    const SizedBox(height: 10),
                    Text(md.updateRequiredBody, textAlign: TextAlign.center, style: t.bodyLarge?.copyWith(color: SuColors.soft)),
                    const SizedBox(height: 28),
                    SuButton(label: md.updateButton, onPressed: () => _openStore(verdict.storeUrl), size: SuButtonSize.lg, expand: true),
                    const SizedBox(height: 14),
                    Text('v${verdict.versionClient}', textAlign: TextAlign.center, style: t.labelSmall?.copyWith(color: SuColors.faint)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Bandeau refermable : une version plus récente existe, mais celle-ci fonctionne encore.
class UpdateBanner extends ConsumerWidget {
  const UpdateBanner({super.key, required this.verdict});
  final UpdateVerdict verdict;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(updateBannerDismissedProvider)) return const SizedBox.shrink();
    final md = context.mdict;
    return Material(
      color: SuColors.lime,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(16, 10, 6, 10),
          child: Row(
            children: [
              const Icon(Icons.system_update_rounded, size: 20, color: SuColors.ink),
              const SizedBox(width: 10),
              Expanded(child: Text(md.updateAvailable, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: SuColors.ink, fontWeight: FontWeight.w600))),
              SuButton(label: md.updateButton, variant: SuButtonVariant.ghost, size: SuButtonSize.sm, onPressed: () => _openStore(verdict.storeUrl)),
              SuIconButton(
                icon: Icons.close_rounded,
                iconSize: 20,
                tooltip: md.updateLater,
                onPressed: () => ref.read(updateBannerDismissedProvider.notifier).state = true,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
