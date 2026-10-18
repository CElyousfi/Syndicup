import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_result.dart';
import '../../core/api/refresh.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/app_state.dart';
import '../../core/auth/session.dart';
import '../../core/feel/feel.dart';
import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
import '../../core/theme/motion.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/widgets.dart';
import 'dari.dart';

/// Dari — l'assistant, en plein écran (mobile).
///
/// Repères du moment (GET /assistant), questions proposées, conversation (POST
/// /assistant/messages). Dari connaît l'écran d'où l'on vient (`depuis`) et propose des écrans
/// où agir — toujours autorisés pour le rôle (revalidés par l'API). Rien n'est stocké côté
/// serveur ; la conversation vit le temps de la session de l'app.
class AssistantScreen extends ConsumerStatefulWidget {
  const AssistantScreen({super.key, this.question, this.depuis});

  /// Question posée d'emblée (raccourci depuis une carte ou une puce).
  final String? question;

  /// Chemin de l'écran d'où l'utilisateur a ouvert Dari.
  final String? depuis;

  @override
  ConsumerState<AssistantScreen> createState() => _AssistantScreenState();
}

class _Message {
  const _Message(this.role, this.contenu, {this.ecrans = const [], this.erreur = false});
  final String role;
  final String contenu;
  final List<AssistantEcran> ecrans;
  final bool erreur;
}

/// Conversation conservée pendant la session de l'app (quitter / rouvrir Dari la retrouve).
final _conversationProvider = StateProvider<List<_Message>>((ref) => const []);

class _AssistantScreenState extends ConsumerState<AssistantScreen> {
  final _champ = TextEditingController();
  final _scroll = ScrollController();
  final _focus = FocusNode();
  bool _enCours = false;
  bool _ecrit = false;
  DariClip _hero = DariClip.wave;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    final q = widget.question;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Le dernier état connu s'affiche tout de suite ; le réseau rafraîchit derrière.
      if (mounted) ref.invalidate(assistantEtatProvider);
      if (q != null && q.trim().isNotEmpty) _envoyer(q);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _champ.dispose();
    _scroll.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _defiler() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(_scroll.position.maxScrollExtent, duration: SuMotion.of(context, const Duration(milliseconds: 320)), curve: SuMotion.easeOut);
    });
  }

  Future<void> _envoyer(String question) async {
    final q = question.trim();
    if (q.isEmpty || _enCours) return;
    final dd = context.dari;
    final langue = Localizations.localeOf(context).languageCode == 'ar' ? 'ar' : 'fr';
    final conv = ref.read(_conversationProvider.notifier);
    final historique = [...conv.state.where((m) => !m.erreur), _Message('user', q)];
    conv.state = historique;
    _champ.clear();
    Haptics.select();
    setState(() {
      _enCours = true;
      _ecrit = false;
      _hero = DariClip.think;
    });
    _timer?.cancel();
    _timer = Timer(const Duration(milliseconds: 1400), () {
      if (mounted) setState(() => _ecrit = true);
    });
    _defiler();
    final r = await ref.read(apiClientProvider).post<AssistantReponse>(
          '/assistant/messages',
          body: {
            'messages': [
              for (final m in historique.length > 10 ? historique.sublist(historique.length - 10) : historique)
                {'role': m.role, 'contenu': m.contenu.length > 2000 ? m.contenu.substring(0, 2000) : m.contenu},
            ],
            if (widget.depuis != null) 'page': widget.depuis,
            'langue': langue,
          },
          parse: (j) => AssistantReponse.fromJson(asMap(j)),
        );
    if (!mounted) return;
    _timer?.cancel();
    switch (r) {
      case ApiOk<AssistantReponse>(:final data):
        conv.state = [...conv.state, _Message('assistant', data.reponse, ecrans: data.ecrans)];
        Haptics.success();
        setState(() => _hero = DariClip.talk);
        _timer = Timer(const Duration(milliseconds: 2600), () {
          if (mounted) setState(() => _hero = DariClip.wave);
        });
      case ApiFail<AssistantReponse>(:final status):
        final texte = switch (status) { 501 => dd.indisponible, 429 => dd.trop, 503 => dd.sature, _ => dd.erreur };
        conv.state = [...conv.state, _Message('assistant', texte, erreur: true)];
        setState(() => _hero = DariClip.wave);
    }
    setState(() => _enCours = false);
    _defiler();
  }

  void _ouvrir(AssistantEcran e) {
    final chemin = e.mobile;
    if (chemin == null) return;
    Haptics.select();
    context.push(chemin);
  }

  @override
  Widget build(BuildContext context) {
    final dd = context.dari;
    final t = Theme.of(context).textTheme;
    final etat = ref.watch(assistantEtatProvider);
    final messages = ref.watch(_conversationProvider);
    final appCtx = ref.watch(appContextProvider);
    final moi = etat.valueOrNull?.moi;
    final prenom = moi?.prenom ?? appCtx.profil.prenom ?? '';
    final bonjour = prenom.isEmpty ? dd.bonjour.replaceAll(RegExp(r' ?\{prenom\}'), '') : fill(dd.bonjour, {'prenom': prenom});
    final intro = moi == null
        ? dd.intro
        : fill(dd.introMoi, {'role': libelleRole(context, moi.role), 'residence': moi.residence ?? '', 'lots': moi.lots.join(', ')}).replaceAll(RegExp(r'\s*\(\s*\)'), '').replaceAll(RegExp(r' {2,}'), ' ');
    final disponible = etat.valueOrNull?.disponible ?? true;

    return Scaffold(
      backgroundColor: SuColors.ground,
      body: Column(
        children: [
          // En-tête : Dari en grand, sur le vert de la marque.
          Material(
            color: SuColors.brand,
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(8, 4, 8, 0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 30),
                      child: CircleIconButton(icon: Icons.arrow_back_rounded, mirror: true, tooltip: dd.retour, color: const Color(0x26FFFFFF), iconColor: Colors.white, onTap: () => context.pop()),
                    ),
                    const SizedBox(width: 4),
                    DariMotion(_enCours ? DariClip.think : _hero, size: 98, semanticLabel: dd.nom),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 26),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(dd.nom, style: t.headlineSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w700)),
                            const SizedBox(height: 2),
                            Row(children: [
                              Container(width: 8, height: 8, decoration: const BoxDecoration(color: SuColors.lime, shape: BoxShape.circle)),
                              const SizedBox(width: 6),
                              Flexible(
                                child: SuFadeSwitch(
                                  value: _enCours ? (_ecrit ? 1 : 2) : 0,
                                  slide: false,
                                  alignment: AlignmentDirectional.centerStart,
                                  child: Text(_enCours ? (_ecrit ? dd.ecrit : dd.reflechit) : dd.sousTitre, maxLines: 1, overflow: TextOverflow.ellipsis, style: t.bodySmall?.copyWith(color: Colors.white.withValues(alpha: 0.85))),
                                ),
                              ),
                            ]),
                          ],
                        ),
                      ),
                    ),
                    if (messages.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 30),
                        child: CircleIconButton(
                          icon: Icons.edit_outlined,
                          tooltip: dd.nouvelle,
                          color: const Color(0x26FFFFFF),
                          iconColor: Colors.white,
                          onTap: () {
                            Haptics.select();
                            ref.read(_conversationProvider.notifier).state = const [];
                          },
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: SuRefresh(
              onRefresh: () => refreshing(ref, [assistantEtatProvider]),
              child: ListView(
                controller: _scroll,
                padding: const EdgeInsets.fromLTRB(14, 18, 14, 24),
                children: [
                  _BulleDari(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(bonjour, style: t.titleSmall?.copyWith(color: SuColors.ink, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(intro, style: t.bodyMedium?.copyWith(color: SuColors.body, height: 1.45)),
                    ]),
                  ),
                  const SizedBox(height: 10),
                  Padding(
                    padding: const EdgeInsetsDirectional.only(start: 42),
                    child: etat.when(
                      loading: () => const Padding(padding: EdgeInsets.all(14), child: Align(alignment: AlignmentDirectional.centerStart, child: LoadingOrb())),
                      error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(assistantEtatProvider)),
                      data: (s) => Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (s.insights.isEmpty)
                            _Carte(child: Text(dd.rienAFaire, style: t.bodyMedium?.copyWith(color: SuColors.soft)))
                          else
                            for (final (i, ins) in s.insights.indexed)
                              SuEnter(
                                index: i,
                                child: Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: _InsightTile(insight: ins, onTap: ins.ecran?.mobile == null ? null : () => _ouvrir(ins.ecran!)),
                                ),
                              ),
                          if (messages.isEmpty && s.suggestions.isNotEmpty) ...[
                            const SizedBox(height: 14),
                            Text(dd.suggestionsTitre.toUpperCase(), style: t.labelSmall?.copyWith(color: SuColors.faint, letterSpacing: 0.6, fontWeight: FontWeight.w700)),
                            const SizedBox(height: 8),
                            Wrap(spacing: 8, runSpacing: 8, children: [
                              for (final q in s.suggestions) _Puce(label: q, onTap: _enCours || !s.disponible ? null : () => _envoyer(q)),
                            ]),
                          ],
                          if (!s.disponible) Padding(padding: const EdgeInsets.only(top: 10), child: Text(dd.indisponible, style: t.bodySmall?.copyWith(color: SuColors.soft))),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  for (final (i, m) in messages.indexed)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: m.role == 'user'
                          ? Align(
                              alignment: AlignmentDirectional.centerEnd,
                              child: ConstrainedBox(
                                constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.8),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                                  decoration: const BoxDecoration(
                                    color: SuColors.ink,
                                    borderRadius: BorderRadiusDirectional.only(topStart: Radius.circular(20), topEnd: Radius.circular(20), bottomStart: Radius.circular(20), bottomEnd: Radius.circular(6)),
                                  ),
                                  child: Text(m.contenu, style: t.bodyMedium?.copyWith(color: Colors.white, height: 1.45)),
                                ),
                              ),
                            )
                          : _BulleDari(
                              erreur: m.erreur,
                              apres: [
                                if (m.erreur && i == messages.length - 1)
                                  _Puce(
                                    label: dd.reessayer,
                                    onTap: () {
                                      final derniere = messages.lastWhere((x) => x.role == 'user', orElse: () => const _Message('user', ''));
                                      ref.read(_conversationProvider.notifier).state = [for (final x in messages) if (!x.erreur && !identical(x, derniere)) x];
                                      _envoyer(derniere.contenu);
                                    },
                                  ),
                                if (m.ecrans.isNotEmpty)
                                  Wrap(spacing: 8, runSpacing: 8, children: [
                                    for (final e in m.ecrans) _Puce(label: e.mobile == null ? '${e.libelle} · ${dd.webSeulement}' : e.libelle, accent: e.mobile != null, onTap: e.mobile == null ? null : () => _ouvrir(e)),
                                  ]),
                              ],
                              child: _TexteRiche(m.contenu, style: t.bodyMedium?.copyWith(color: m.erreur ? SuColors.warn : SuColors.body, height: 1.5), onEcran: _ouvrir),
                            ),
                    ),
                  if (_enCours) _BulleDari(child: Semantics(label: _ecrit ? dd.ecrit : dd.reflechit, child: const LoadingOrb(size: 9, color: SuColors.faint))),
                ],
              ),
            ),
          ),
          // Saisie
          Material(
            color: SuColors.surface,
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 8, 6),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          // alive:allow champ de conversation en bulle (sans libellé de formulaire)
                          child: TextField(
                            controller: _champ,
                            focusNode: _focus,
                            enabled: disponible,
                            minLines: 1,
                            maxLines: 4,
                            maxLength: 2000,
                            textInputAction: TextInputAction.send,
                            onSubmitted: _envoyer,
                            style: t.bodyLarge,
                            decoration: InputDecoration(
                              hintText: dd.placeholder,
                              counterText: '',
                              filled: true,
                              fillColor: SuColors.ground,
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: BorderSide.none),
                              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: BorderSide.none),
                              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: const BorderSide(color: SuColors.ink, width: 1.2)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        ValueListenableBuilder<TextEditingValue>(
                          valueListenable: _champ,
                          builder: (context, v, _) => CircleIconButton(
                            icon: Icons.arrow_upward_rounded,
                            tooltip: dd.envoyer,
                            size: 46,
                            color: v.text.trim().isEmpty || _enCours ? SuColors.washStrong : SuColors.brand,
                            iconColor: Colors.white,
                            onTap: () => _envoyer(_champ.text),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(dd.avertissement, textAlign: TextAlign.center, style: t.labelSmall?.copyWith(color: SuColors.faint)),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Bulle de réponse de Dari : avatar animé + carte blanche, contenu additionnel dessous.
class _BulleDari extends StatelessWidget {
  const _BulleDari({required this.child, this.apres = const [], this.erreur = false});
  final Widget child;
  final List<Widget> apres;
  final bool erreur;
  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const DariAvatar(size: 32),
        const SizedBox(width: 10),
        Flexible(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: erreur ? SuColors.warnTint : SuColors.surface,
                  borderRadius: const BorderRadiusDirectional.only(topStart: Radius.circular(6), topEnd: Radius.circular(20), bottomStart: Radius.circular(20), bottomEnd: Radius.circular(20)),
                ),
                child: child,
              ),
              for (final w in apres) Padding(padding: const EdgeInsets.only(top: 8), child: w),
            ],
          ),
        ),
      ],
    );
  }
}

class _Carte extends StatelessWidget {
  const _Carte({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        decoration: BoxDecoration(color: SuColors.surface, borderRadius: BorderRadius.circular(18)),
        child: child,
      );
}

class _InsightTile extends StatelessWidget {
  const _InsightTile({required this.insight, this.onTap});
  final AssistantInsight insight;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return SuTap(
      onTap: onTap,
      enabled: onTap != null,
      borderRadius: BorderRadius.circular(18),
      child: _Carte(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(padding: const EdgeInsets.only(top: 6), child: Container(width: 8, height: 8, decoration: BoxDecoration(color: couleurNiveau(insight.niveau), shape: BoxShape.circle))),
            const SizedBox(width: 12),
            Expanded(child: Text(insight.texte, style: t.bodyMedium?.copyWith(color: SuColors.inkStrong, height: 1.4))),
            if (onTap != null) ...[
              const SizedBox(width: 8),
              Padding(padding: const EdgeInsets.only(top: 1), child: Icon(Directionality.of(context) == TextDirection.rtl ? Icons.chevron_left_rounded : Icons.chevron_right_rounded, color: SuColors.link, size: 22)),
            ],
          ],
        ),
      ),
    );
  }
}

class _Puce extends StatelessWidget {
  const _Puce({required this.label, this.onTap, this.accent = false});
  final String label;
  final VoidCallback? onTap;
  final bool accent;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return SuTap(
      onTap: onTap,
      enabled: onTap != null,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: accent ? SuColors.cta : SuColors.surface,
          borderRadius: BorderRadius.circular(999),
          border: accent ? null : Border.all(color: SuColors.hairlineStrong),
        ),
        child: Text(label, style: t.bodySmall?.copyWith(color: onTap == null && !accent ? SuColors.faint : SuColors.ink, fontWeight: FontWeight.w600)),
      ),
    );
  }
}

/// Texte de Dari : **gras**, retours à la ligne et liens d'écran `[[cle|Libellé|/web|/mobile]]`
/// (toujours autorisés pour le rôle — revalidés par l'API) ; rien d'autre n'est interprété.
class _TexteRiche extends StatefulWidget {
  const _TexteRiche(this.texte, {this.style, required this.onEcran});
  final String texte;
  final TextStyle? style;
  final void Function(AssistantEcran) onEcran;
  @override
  State<_TexteRiche> createState() => _TexteRicheState();
}

class _TexteRicheState extends State<_TexteRiche> {
  final _recognizers = <TapGestureRecognizer>[];

  @override
  void dispose() {
    for (final r in _recognizers) {
      r.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    for (final r in _recognizers) {
      r.dispose();
    }
    _recognizers.clear();
    final spans = <InlineSpan>[];
    final re = RegExp(r'\*\*([^*]+)\*\*|\[\[([a-z0-9_]+)\|([^\]|]+)\|([^\]|]*)\|([^\]|]*)\]\]');
    var i = 0;
    for (final m in re.allMatches(widget.texte)) {
      if (m.start > i) spans.add(TextSpan(text: widget.texte.substring(i, m.start)));
      if (m.group(1) != null) {
        spans.add(TextSpan(text: m.group(1), style: const TextStyle(fontWeight: FontWeight.w700, color: SuColors.ink)));
      } else {
        final ecran = AssistantEcran(cle: m.group(2)!, libelle: m.group(3)!, web: m.group(4)!, mobile: (m.group(5) ?? '').isEmpty ? null : m.group(5));
        final r = TapGestureRecognizer()..onTap = ecran.mobile == null ? null : () => widget.onEcran(ecran);
        _recognizers.add(r);
        spans.add(WidgetSpan(
          alignment: PlaceholderAlignment.middle,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: SuColors.actionTint, borderRadius: BorderRadius.circular(999)),
              child: Text.rich(TextSpan(
                recognizer: r,
                text: '${ecran.libelle} ${Directionality.of(context) == TextDirection.rtl ? '←' : '→'}',
                style: (widget.style ?? const TextStyle()).copyWith(color: SuColors.brandDeep, fontWeight: FontWeight.w700, fontSize: 13),
              )),
            ),
          ),
        ));
      }
      i = m.end;
    }
    if (i < widget.texte.length) spans.add(TextSpan(text: widget.texte.substring(i)));
    return Text.rich(TextSpan(style: widget.style, children: spans));
  }
}

/// Carte « Dari » du tableau de bord : le repère le plus important + accès direct à Dari.
class DariDashboardCard extends ConsumerWidget {
  const DariDashboardCard({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dd = context.dari;
    final t = Theme.of(context).textTheme;
    final etat = ref.watch(assistantEtatProvider).valueOrNull;
    final premier = (etat?.insights.isNotEmpty ?? false) ? etat!.insights.first : null;
    final autres = (etat?.insights.length ?? 0) - 1;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: SuTap(
        onTap: () {
          Haptics.select();
          context.push('/assistant?depuis=${Uri.encodeComponent('/tableau-de-bord')}');
        },
        borderRadius: BorderRadius.circular(24),
        semanticLabel: dd.ouvrir,
        child: Container(
          padding: const EdgeInsetsDirectional.fromSTEB(6, 10, 16, 12),
          decoration: BoxDecoration(color: SuColors.actionTint, borderRadius: BorderRadius.circular(24)),
          child: Row(
            children: [
              const DariMotion(DariClip.wave, size: 78),
              const SizedBox(width: 6),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(dd.carteTitre, style: t.labelMedium?.copyWith(color: SuColors.brandDeep, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      if (premier != null) Padding(padding: const EdgeInsetsDirectional.only(top: 6, end: 8), child: Container(width: 8, height: 8, decoration: BoxDecoration(color: couleurNiveau(premier.niveau), shape: BoxShape.circle))),
                      Expanded(child: Text(premier?.texte ?? dd.carteVide, maxLines: 3, overflow: TextOverflow.ellipsis, style: t.bodyMedium?.copyWith(color: SuColors.inkStrong, height: 1.4))),
                    ]),
                    const SizedBox(height: 8),
                    Row(children: [
                      Text(dd.carteQuestion, style: t.labelLarge?.copyWith(color: SuColors.link, fontWeight: FontWeight.w700)),
                      Icon(Directionality.of(context) == TextDirection.rtl ? Icons.chevron_left_rounded : Icons.chevron_right_rounded, size: 18, color: SuColors.link),
                      const Spacer(),
                      if (autres > 0)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(color: SuColors.surface, borderRadius: BorderRadius.circular(999)),
                          child: Text('+$autres', style: t.labelSmall?.copyWith(color: SuColors.soft, fontWeight: FontWeight.w700)),
                        ),
                    ]),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
