import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/session.dart';
import '../../core/i18n/i18n.dart';
import '../../core/theme/motion.dart';
import '../../core/theme/tokens.dart';

/// Dari — la mascotte de l'assistant SyndicUp (une maison-bulle avec son casque), animée.
///
/// Boucles WebP transparentes (assets/dari), image fixe en mouvement réduit. Mêmes dessins que
/// le web et le site vitrine.
enum DariClip { wave, think, talk, head }

class DariMotion extends StatelessWidget {
  const DariMotion(this.clip, {super.key, this.size = 120, this.semanticLabel});
  final DariClip clip;

  /// Largeur affichée (pixels logiques).
  final double size;
  final String? semanticLabel;

  static const _ratio = {DariClip.wave: 360 / 388, DariClip.think: 360 / 388, DariClip.talk: 360 / 388, DariClip.head: 272 / 296};

  @override
  Widget build(BuildContext context) {
    final fixe = SuMotion.reduced(context);
    final asset = 'assets/dari/dari-${clip.name}${fixe ? '-poster.png' : '.webp'}';
    final image = Image.asset(
      asset,
      key: ValueKey(asset),
      width: size,
      height: size * _ratio[clip]!,
      fit: BoxFit.contain,
      gaplessPlayback: true,
      filterQuality: FilterQuality.medium,
      excludeFromSemantics: semanticLabel == null,
      semanticLabel: semanticLabel,
    );
    return AnimatedSwitcher(
      duration: SuMotion.of(context, const Duration(milliseconds: 260)),
      transitionBuilder: (child, a) => ScaleTransition(scale: Tween(begin: 0.94, end: 1.0).animate(CurvedAnimation(parent: a, curve: SuMotion.spring)), child: FadeTransition(opacity: a, child: child)),
      child: image,
    );
  }
}

/// Dari en médaillon rond (tête animée sur le vert de la marque) — avatar des réponses.
class DariAvatar extends StatelessWidget {
  const DariAvatar({super.key, this.size = 34, this.ring = false});
  final double size;
  final bool ring;
  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: SuColors.brand, shape: BoxShape.circle, border: ring ? Border.all(color: SuColors.surface, width: 2) : null),
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.bottomCenter,
      child: Transform.translate(offset: Offset(0, size * 0.1), child: DariMotion(DariClip.head, size: size * 0.95)),
    );
  }
}

// ── Données : GET /assistant, POST /assistant/messages (packages/api-contract) ──────────────

class AssistantEcran {
  const AssistantEcran({required this.cle, required this.libelle, required this.web, this.mobile});
  final String cle, libelle, web;
  final String? mobile;
  factory AssistantEcran.fromJson(Map<String, dynamic> j) =>
      AssistantEcran(cle: j['cle'] as String, libelle: j['libelle'] as String, web: j['web'] as String, mobile: j['mobile'] as String?);
}

class AssistantInsight {
  const AssistantInsight({required this.cle, required this.niveau, required this.texte, this.ecran});
  final String cle, niveau, texte;
  final AssistantEcran? ecran;
  factory AssistantInsight.fromJson(Map<String, dynamic> j) => AssistantInsight(
        cle: j['cle'] as String,
        niveau: j['niveau'] as String,
        texte: j['texte'] as String,
        ecran: j['ecran'] is Map ? AssistantEcran.fromJson(asMap(j['ecran'])) : null,
      );
}

class AssistantMoi {
  const AssistantMoi({this.prenom, required this.role, this.residence, this.lots = const []});
  final String? prenom, residence;
  final String role;
  final List<String> lots;
  factory AssistantMoi.fromJson(Map<String, dynamic> j) => AssistantMoi(
        prenom: j['prenom'] as String?,
        role: (j['role'] as String?) ?? '',
        residence: j['residence'] as String?,
        lots: ((j['lots'] as List?) ?? const []).whereType<String>().toList(),
      );
}

class AssistantEtat {
  const AssistantEtat({required this.disponible, this.moi, required this.insights, required this.suggestions});
  final bool disponible;
  final AssistantMoi? moi;
  final List<AssistantInsight> insights;
  final List<String> suggestions;
  factory AssistantEtat.fromJson(Map<String, dynamic> j) => AssistantEtat(
        disponible: j['disponible'] == true,
        moi: j['moi'] is Map ? AssistantMoi.fromJson(asMap(j['moi'])) : null,
        insights: parseList(j['insights'], AssistantInsight.fromJson),
        suggestions: ((j['suggestions'] as List?) ?? const []).whereType<String>().toList(),
      );
  int get attention => insights.where((i) => i.niveau == 'attention').length;
}

class AssistantReponse {
  const AssistantReponse({required this.reponse, required this.ecrans});
  final String reponse;
  final List<AssistantEcran> ecrans;
  factory AssistantReponse.fromJson(Map<String, dynamic> j) =>
      AssistantReponse(reponse: j['reponse'] as String, ecrans: parseList(j['ecrans'], AssistantEcran.fromJson));
}

/// Repères de Dari pour l'utilisateur connecté, dans la langue de l'interface.
/// Conservé entre les écrans (pas autoDispose) : l'ouverture de Dari est instantanée, l'écran
/// rafraîchit derrière (`ref.invalidate`). Dépend du client API (session, copropriété) : à la
/// déconnexion ou au changement de résidence il est recalculé, rien ne survit à la session.
final assistantEtatProvider = FutureProvider<AssistantEtat>((ref) async {
  final langue = ref.watch(localeProvider).languageCode == 'ar' ? 'ar' : 'fr';
  return unwrap(await ref.watch(apiClientProvider).get('/assistant', query: {'langue': langue}, parse: (j) => AssistantEtat.fromJson(asMap(j))));
});

// ── Textes (FR/AR) ──────────────────────────────────────────────────────────────────────────

class DariDict {
  const DariDict({
    required this.nom,
    required this.sousTitre,
    required this.ouvrir,
    required this.nouvelle,
    required this.bonjour,
    required this.intro,
    required this.rienAFaire,
    required this.suggestionsTitre,
    required this.placeholder,
    required this.envoyer,
    required this.reflechit,
    required this.ecrit,
    required this.indisponible,
    required this.sature,
    required this.trop,
    required this.erreur,
    required this.reessayer,
    required this.avertissement,
    required this.webSeulement,
    required this.carteTitre,
    required this.carteVide,
    required this.carteQuestion,
    required this.obBulle,
    required this.retour,
    required this.introMoi,
  });
  final String nom, sousTitre, ouvrir, nouvelle, bonjour, intro, introMoi, rienAFaire, suggestionsTitre, placeholder, envoyer, reflechit, ecrit, indisponible, sature, trop, erreur, reessayer, avertissement, webSeulement, carteTitre, carteVide, carteQuestion, retour;

  /// Bulles de Dari sur les écrans d'onboarding (une par étape).
  final List<String> obBulle;

  static const fr = DariDict(
    nom: 'Dari',
    sousTitre: 'Votre assistant SyndicUp',
    ouvrir: 'Demander à Dari',
    nouvelle: 'Nouvelle conversation',
    bonjour: 'Bonjour {prenom} ! Je suis Dari.',
    intro: 'Je connais votre résidence et l\'application. Voici ce qui compte aujourd\'hui :',
    rienAFaire: 'Rien d\'urgent pour le moment — tout est en ordre.',
    suggestionsTitre: 'Vous pouvez me demander',
    placeholder: 'Posez votre question…',
    envoyer: 'Envoyer',
    reflechit: 'Dari réfléchit…',
    ecrit: 'Dari écrit…',
    indisponible: 'La conversation n\'est pas encore activée sur cet espace. Les repères ci-dessus restent à jour.',
    sature: 'Je suis très sollicité en ce moment — réessayez dans quelques secondes.',
    trop: 'Vous m\'avez posé beaucoup de questions : faisons une petite pause de quelques minutes.',
    erreur: 'Je n\'ai pas pu répondre. Vérifiez votre connexion et réessayez.',
    reessayer: 'Réessayer',
    avertissement: 'Dari peut se tromper : vérifiez les montants dans l\'écran concerné.',
    webSeulement: 'Sur ordinateur',
    carteTitre: 'Dari a regardé votre résidence',
    carteVide: 'Rien d\'urgent aujourd\'hui. Une question ? Je suis là.',
    carteQuestion: 'Poser une question',
    retour: 'Retour',
    introMoi: '{role} · {residence} ({lots}). Je connais votre dossier et chaque écran de l\'application — voici ce qui compte aujourd\'hui :',
    obBulle: [
      'Bonjour, je suis Dari ! Je vous accompagne partout dans l\'application.',
      'Une question sur vos charges ? Demandez-moi, je vous réponds au dirham près.',
      'Je vous emmène directement au bon écran pour signaler un problème.',
      'Le jour de l\'AG, je vous rappelle où voter. On y va ?',
    ],
  );

  static const ar = DariDict(
    nom: 'داري',
    sousTitre: 'مساعدكم في SyndicUp',
    ouvrir: 'اسألوا داري',
    nouvelle: 'محادثة جديدة',
    bonjour: 'مرحبًا {prenom}! أنا داري.',
    intro: 'أعرف إقامتكم والتطبيق. إليكم ما يهم اليوم:',
    rienAFaire: 'لا شيء مستعجل حاليًا — كل شيء على ما يرام.',
    suggestionsTitre: 'يمكنكم أن تسألوني',
    placeholder: 'اكتبوا سؤالكم…',
    envoyer: 'إرسال',
    reflechit: 'داري يفكر…',
    ecrit: 'داري يكتب…',
    indisponible: 'المحادثة غير مفعّلة بعد في هذا الفضاء. تبقى المؤشرات أعلاه محيَّنة.',
    sature: 'أنا مشغول جدًا الآن — أعيدوا المحاولة بعد ثوانٍ.',
    trop: 'طرحتم عليّ أسئلة كثيرة: لنأخذ استراحة قصيرة لبضع دقائق.',
    erreur: 'تعذر عليّ الرد. تحققوا من اتصالكم وأعيدوا المحاولة.',
    reessayer: 'إعادة المحاولة',
    avertissement: 'قد يخطئ داري: تحققوا من المبالغ في الشاشة المعنية.',
    webSeulement: 'على الحاسوب',
    carteTitre: 'اطّلع داري على إقامتكم',
    carteVide: 'لا شيء مستعجل اليوم. لديكم سؤال؟ أنا هنا.',
    carteQuestion: 'طرح سؤال',
    retour: 'رجوع',
    introMoi: '{role} · {residence} ({lots}). أعرف ملفكم وكل شاشة في التطبيق — إليكم ما يهم اليوم:',
    obBulle: [
      'مرحبًا، أنا داري! أرافقكم في كل أنحاء التطبيق.',
      'سؤال عن رسومكم؟ اسألوني، أجيبكم حتى آخر درهم.',
      'آخذكم مباشرة إلى الشاشة المناسبة للإبلاغ عن مشكلة.',
      'يوم الجمع العام، أذكّركم أين تصوّتون. هيا بنا؟',
    ],
  );

  static DariDict of(Locale l) => l.languageCode == 'ar' ? ar : fr;
}

extension DariDictContext on BuildContext {
  DariDict get dari => DariDict.of(Localizations.localeOf(this));
}

/// Couleur du point d'un repère.
Color couleurNiveau(String niveau) => switch (niveau) {
      'attention' => SuColors.danger,
      'succes' => SuColors.ok,
      _ => SuColors.link,
    };
