import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:home_widget/home_widget.dart';
import 'package:quick_actions/quick_actions.dart';

import '../api/api_client.dart';
import '../api/api_result.dart';
import '../auth/app_state.dart';
import '../feel/haptics.dart';
import '../format/format.dart';
import '../i18n/i18n.dart';
import '../i18n/mobile_dict.dart';

/// Widgets d'écran d'accueil (Android AppWidget / iOS WidgetKit) + raccourcis d'icône.
///
/// Principe : l'app est la seule source. Elle lit `GET /users/me/widget`, met en forme les
/// chaînes dans la langue de l'app (FR/AR, chiffres, dates relatives) et dépose UN JSON dans le
/// stockage partagé (`HomeWidgetPreferences` sur Android, App Group sur iOS). Le code natif ne
/// fait qu'afficher — aucune logique métier, aucun réseau hors de l'app.
///
/// Rafraîchi : à l'ouverture, au retour au premier plan, après chaque événement temps réel qui
/// touche aux charges / AG / incidents / annonces / visites, et à la déconnexion (vidé).
class HomeWidgets {
  HomeWidgets._();
  static final HomeWidgets instance = HomeWidgets._();

  /// Identifiant de l'App Group iOS (à créer dans Xcode : Runner + extension).
  static const appGroup = 'group.ma.syndicup.app';
  static const _keySnapshot = 'w_snapshot';
  static const _keyMasquer = 'w_masquer';

  /// Noms des providers Android (ma.syndicup.app.widgets.*) et des widgets iOS.
  static const android = ['ChargesWidget', 'AgWidget', 'ResidenceWidget', 'AffichageWidget', 'GardienWidget'];
  static const ios = ['SyndicUpCharges', 'SyndicUpAg', 'SyndicUpResidence', 'SyndicUpAffichage', 'SyndicUpGardien'];

  bool _ready = false;
  String? _pending;
  DateTime _dernier = DateTime.fromMillisecondsSinceEpoch(0);
  void Function(String path)? onOpen;

  /// Appelé une fois au démarrage (avant runApp) : App Group + chemin de lancement.
  Future<void> init() async {
    if (kIsWeb) return;
    try {
      if (Platform.isIOS) await HomeWidget.setAppGroupId(appGroup);
      final uri = await HomeWidget.initiallyLaunchedFromHomeWidget();
      _pending = _routeOf(uri);
      HomeWidget.widgetClicked.listen((u) {
        final r = _routeOf(u);
        if (r == null) return;
        Haptics.tap();
        if (onOpen != null) {
          onOpen!(r);
        } else {
          _pending = r;
        }
      });
      HomeWidget.registerInteractivityCallback(widgetBackgroundCallback);
      _ready = true;
    } catch (e) {
      debugPrint('Widgets désactivés : $e');
    }
  }

  /// Chemin d'ouverture demandé par un widget ou un raccourci avant que le routeur existe.
  String? prendreCheminInitial() {
    final p = _pending;
    _pending = null;
    return p;
  }

  static String? _routeOf(Uri? u) {
    if (u == null) return null;
    final r = u.queryParameters['route'];
    if (r == null || !r.startsWith('/')) return null;
    return r;
  }

  /// Lit l'API, met en forme, dépose et redessine. Silencieux en cas d'échec (le widget garde
  /// la dernière valeur et son horodatage).
  Future<void> refresh(WidgetRef ref, {bool force = false}) async {
    if (!_ready) return;
    if (!force && DateTime.now().difference(_dernier) < const Duration(seconds: 20)) return;
    _dernier = DateTime.now();
    final ctx = ref.read(appContextProvider);
    if (ctx.isMembreCabinetSeul) return;
    final res = await ref.read(apiClientProvider).get<Map<String, dynamic>>('/users/me/widget', parse: (j) => asMap(j));
    if (res is! ApiOk<Map<String, dynamic>>) return;
    final locale = ref.read(localeProvider);
    final snapshot = mettreEnForme(res.data, locale: locale, dict: locale.dict, md: MobileDict.of(locale));
    try {
      await HomeWidget.saveWidgetData<String>(_keySnapshot, jsonEncode(snapshot));
      await _redessiner();
    } catch (e) {
      debugPrint('Widgets : écriture impossible ($e)');
    }
  }

  /// Déconnexion : plus aucune donnée personnelle sur l'écran d'accueil.
  Future<void> clear() async {
    if (!_ready) return;
    try {
      await HomeWidget.saveWidgetData<String>(_keySnapshot, jsonEncode({'vide': true}));
      await _redessiner();
      await QuickActions().clearShortcutItems();
    } catch (_) {}
  }

  static Future<void> _redessiner() async {
    for (var i = 0; i < android.length; i++) {
      await HomeWidget.updateWidget(qualifiedAndroidName: 'ma.syndicup.app.widgets.${android[i]}', iOSName: ios[i]);
    }
  }

  /// Raccourcis d'icône (appui long) selon le rôle — 4 au plus, dans l'ordre d'usage.
  Future<void> setQuickActions(AppContext ctx, MobileDict md, {required void Function(String path) open}) async {
    if (kIsWeb || ctx.isMembreCabinetSeul) return;
    final qa = const QuickActions();
    try {
      await qa.initialize((type) {
        final r = _quickRoutes[type];
        if (r == null) return;
        Haptics.tap();
        open(r);
      });
      final gestion = ctx.isSyndic || ctx.role == 'CONSEIL_SYNDICAL' || ctx.role == 'SYNDIC_COMPTABLE';
      final items = <ShortcutItem>[
        if (ctx.role == 'GARDIEN') ShortcutItem(type: 'visiteur', localizedTitle: md.quickVisiteur, icon: 'ic_quick_visiteur'),
        if (!gestion && ctx.role != 'GARDIEN' && ctx.role != 'LOCATAIRE' && ctx.role != 'PRESTATAIRE') ShortcutItem(type: 'payer', localizedTitle: md.quickPayer, icon: 'ic_quick_payer'),
        if (gestion) ShortcutItem(type: 'encaisser', localizedTitle: md.quickEncaisser, icon: 'ic_quick_payer'),
        ShortcutItem(type: 'signaler', localizedTitle: md.quickSignaler, icon: 'ic_quick_signaler'),
        if (ctx.role != 'GARDIEN' && ctx.role != 'PRESTATAIRE') ShortcutItem(type: 'ag', localizedTitle: md.quickAg, icon: 'ic_quick_ag'),
        ShortcutItem(type: 'affichage', localizedTitle: md.quickAffichage, icon: 'ic_quick_affichage'),
      ];
      await qa.setShortcutItems(items.take(4).toList());
    } catch (e) {
      debugPrint('Raccourcis : $e');
    }
  }

  static const _quickRoutes = {
    'payer': '/payer',
    'encaisser': '/finances/appels-de-fonds',
    'signaler': '/incidents/nouveau',
    'ag': '/ag',
    'affichage': '/affichage',
    'visiteur': '/visites?enregistrer=1',
  };

  /// Templates temps réel qui changent ce que les widgets montrent.
  static bool concerne(String template) =>
      template.startsWith('AG_') ||
      template.startsWith('APPEL_') ||
      template.startsWith('IMPAYE_') ||
      template == 'PAIEMENT_RECU' ||
      template == 'PAIEMENT_VALIDE' ||
      template.startsWith('INCIDENT_') ||
      template.startsWith('ANNONCE_') ||
      template.startsWith('VISITE_') ||
      template.startsWith('RESERVATION_') ||
      template.startsWith('LCD_');
}

/// Bouton « œil » du widget (Android : HomeWidgetBackgroundIntent ; iOS 17 : AppIntent) —
/// bascule le masquage des montants sans ouvrir l'app, puis redessine. Pas de réseau.
@pragma('vm:entry-point')
Future<void> widgetBackgroundCallback(Uri? uri) async {
  if (uri?.host != 'masquer') return;
  if (Platform.isIOS) await HomeWidget.setAppGroupId(HomeWidgets.appGroup);
  final actuel = await HomeWidget.getWidgetData<bool>(HomeWidgets._keyMasquer, defaultValue: false) ?? false;
  await HomeWidget.saveWidgetData<bool>(HomeWidgets._keyMasquer, !actuel);
  await HomeWidgets._redessiner();
}

/// Met en forme l'instantané API en chaînes prêtes à afficher (pure, testable).
/// Les valeurs numériques nécessaires au dessin (anneau, sparkline) restent en nombres.
Map<String, dynamic> mettreEnForme(Map<String, dynamic> j, {required Locale locale, required Dict dict, required MobileDict md}) {
  final rtl = locale.languageCode == 'ar';
  final now = DateTime.now();
  final maj = fill(md.widgetMisAJour, {'heure': formatHeure(now.toIso8601String(), locale)});
  final copro = j['copropriete'] is Map ? asMap(j['copropriete']) : null;
  final out = <String, dynamic>{
    'vide': false,
    'rtl': rtl,
    'langue': locale.languageCode,
    'nom': copro?['nom']?.toString() ?? 'SyndicUp',
    'maj': maj,
    'genere_le': j['genere_le'],
    'labels': {
      'ouvrir': md.widgetOuvrir,
      'masque': '•••• MAD',
    },
  };

  // ── Mes charges ────────────────────────────────────────────────────────────
  if (j['charges'] is Map) {
    final c = asMap(j['charges']);
    final solde = c['solde_du']?.toString() ?? '0.00';
    final aJour = solde == '0.00' || solde == '0';
    final echeance = c['prochaine_echeance']?.toString();
    String sousTitre;
    if (aJour) {
      sousTitre = md.widgetAJour;
    } else if (echeance != null) {
      final jr = joursRestants(echeance);
      sousTitre = jr < 0
          ? fill(md.widgetEnRetard, {'n': -jr})
          : jr == 0
              ? md.widgetEcheanceAujourdhui
              : fill(md.widgetEcheanceDans, {'n': jr, 'date': formatDateCourte(echeance, locale)});
    } else {
      sousTitre = '';
    }
    final lotId = c['lot_id']?.toString();
    out['charges'] = {
      'titre': md.widgetCharges,
      'montant': formatMAD(solde, locale),
      'montant_brut': solde,
      'a_jour': aJour,
      'sous_titre': sousTitre,
      'taux': (c['taux_paye'] as num?)?.toDouble() ?? 1.0,
      'nb_lots': c['nb_lots'] ?? 0,
      'payer': md.quickPayer,
      'route': aJour ? (lotId != null ? '/lots/$lotId?onglet=finances' : '/lots') : '/payer',
      'route_detail': lotId != null ? '/lots/$lotId?onglet=finances' : '/lots',
    };
  }

  // ── Assemblée ──────────────────────────────────────────────────────────────
  if (j['ag'] is Map) {
    final a = asMap(j['ag']);
    final id = a['id']?.toString() ?? '';
    final statut = a['statut']?.toString() ?? '';
    final date = a['date_ag']?.toString();
    final jr = date == null ? 0 : joursRestants(date);
    final enCours = statut == 'EN_COURS';
    final nbRes = (a['nb_resolutions'] as num?)?.toInt() ?? 0;
    final nbVot = (a['nb_votees'] as num?)?.toInt() ?? 0;
    out['ag'] = {
      'titre': md.widgetAg,
      'etat': enCours ? 'EN_COURS' : (statut == 'CONVOQUEE' ? 'CONVOQUEE' : 'PLANIFIEE'),
      'type': dict.enums.typeAg[a['type']] ?? a['type']?.toString() ?? '',
      'date': formatDateHeure(date, locale),
      'compte': enCours
          ? md.widgetEnDirect
          : jr == 0
              ? md.widgetAgAujourdhui
              : jr == 1
                  ? md.widgetAgDemain
                  : fill(md.widgetAgDans, {'n': jr}),
      'jours': jr,
      'progression': enCours ? fill(md.widgetVotees, {'v': nbVot, 'n': nbRes}) : fill(md.widgetResolutions, {'n': nbRes}),
      'cta': enCours ? md.widgetVoter : md.widgetOuvrir,
      'route': enCours ? '/ag/$id/seance' : '/ag/$id',
    };
  } else {
    out['ag'] = {'titre': md.widgetAg, 'etat': 'AUCUNE', 'compte': md.widgetAucuneAg, 'route': '/ag'};
  }

  // ── Résidence (syndic) ─────────────────────────────────────────────────────
  if (j['residence'] is Map) {
    final r = asMap(j['residence']);
    final taux = (r['taux_recouvrement'] as num?)?.toDouble() ?? 1.0;
    final sla = (r['incidents_sla_depasse'] as num?)?.toInt() ?? 0;
    out['residence'] = {
      'titre': md.widgetResidence,
      'taux': taux,
      'taux_fmt': formatPourcent(taux),
      'recouvrement': md.widgetRecouvrement,
      'impaye': formatMAD(r['impaye_total']?.toString(), locale),
      'impaye_label': md.widgetImpayes,
      'serie': [for (final v in (r['recouvrement_6'] as List? ?? const [])) (v as num).toDouble()],
      'incidents': r['incidents_ouverts'] ?? 0,
      'incidents_label': md.widgetIncidents,
      'sla': sla,
      'sla_label': sla > 0 ? fill(md.widgetSla, {'n': sla}) : '',
      'reservations': r['reservations_a_valider'] ?? 0,
      'reservations_label': md.widgetAValider,
      'route': '/tableau-de-bord',
      'route_impayes': '/finances/appels-de-fonds',
      'route_incidents': '/incidents',
      'route_reservations': '/reservations',
      'encaisser': md.quickEncaisser,
      'route_encaisser': '/finances/appels-de-fonds',
    };
  }

  // ── Affichage ──────────────────────────────────────────────────────────────
  if (j['affichage'] is Map) {
    final f = asMap(j['affichage']);
    final nonLues = (f['non_lues'] as num?)?.toInt() ?? 0;
    out['affichage'] = {
      'titre': md.widgetAffichage,
      'non_lues': nonLues,
      'non_lues_label': nonLues == 0 ? md.widgetToutLu : fill(md.widgetNonLues, {'n': nonLues}),
      'vide': md.widgetAucuneAnnonce,
      'annonces': [
        for (final a in (f['annonces'] as List? ?? const []))
          {
            'id': asMap(a)['id'],
            'titre': asMap(a)['titre'],
            'urgent': asMap(a)['urgent'] == true,
            'lu': asMap(a)['lu'] == true,
            'quand': _relatif(asMap(a)['publie_le']?.toString(), locale, md),
            'route': '/affichage/${asMap(a)['id']}',
          },
      ],
      'route': '/affichage',
    };
  }

  // ── Gardien ────────────────────────────────────────────────────────────────
  if (j['gardien'] is Map) {
    final g = asMap(j['gardien']);
    out['gardien'] = {
      'titre': md.widgetGardien,
      'visites': g['visites_en_attente'] ?? 0,
      'visites_label': md.widgetVisiteurs,
      'arrivees': g['arrivees_lcd_aujourdhui'] ?? 0,
      'arrivees_label': md.widgetArrivees,
      'departs': g['departs_lcd_aujourdhui'] ?? 0,
      'departs_label': md.widgetDeparts,
      'incidents': g['incidents_ouverts'] ?? 0,
      'incidents_label': md.widgetIncidents,
      'enregistrer': md.quickVisiteur,
      'signaler': md.quickSignaler,
      'route_visites': '/visites',
      'route_enregistrer': '/visites?enregistrer=1',
      'route_lcd': '/location-courte-duree',
      'route_signaler': '/incidents/nouveau',
    };
  }
  return out;
}

String _relatif(String? iso, Locale locale, MobileDict md) {
  if (iso == null) return '';
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return '';
  final diff = DateTime.now().difference(d);
  if (diff.inMinutes < 60) return fill(md.widgetIlYAMin, {'n': diff.inMinutes < 1 ? 1 : diff.inMinutes});
  if (diff.inHours < 24) return fill(md.widgetIlYAH, {'n': diff.inHours});
  if (diff.inDays < 7) return fill(md.widgetIlYAJ, {'n': diff.inDays});
  return formatDateCourte(iso, locale);
}
