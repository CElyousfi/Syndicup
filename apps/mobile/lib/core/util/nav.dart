import 'package:flutter/material.dart';

import '../auth/app_state.dart';
import '../i18n/dict.dart';

/// Navigation PAR RÔLE (brief §5) — port de apps/web/components/shell/nav.ts : mêmes sections,
/// mêmes libellés, mêmes 4 onglets + « Plus ». Jamais une navigation unique avec des entrées
/// grisées.
class NavItem {
  final String path;
  final String label;
  final String icon;
  final bool exact;
  const NavItem(this.path, this.label, this.icon, {this.exact = false});
}

class NavSection {
  final String? label;
  final List<NavItem> items;
  const NavSection(this.label, this.items);
}

IconData navIcon(String key) => switch (key) {
      'grid' => Icons.grid_view_rounded,
      'building' => Icons.apartment_rounded,
      'coins' => Icons.payments_rounded,
      'wallet' => Icons.account_balance_wallet_rounded,
      'vote' => Icons.how_to_vote_rounded,
      'wrench' => Icons.build_rounded,
      'calendar' => Icons.calendar_month_rounded,
      'door' => Icons.meeting_room_rounded,
      'users' => Icons.group_rounded,
      'key' => Icons.vpn_key_rounded,
      'file' => Icons.description_rounded,
      'scale' => Icons.balance_rounded,
      'settings' => Icons.settings_rounded,
      'home' => Icons.deck_rounded,
      'shield' => Icons.admin_panel_settings_rounded,
      'send' => Icons.engineering_rounded,
      'chart' => Icons.insights_rounded,
      'bell' => Icons.notifications_rounded,
      'person' => Icons.person_rounded,
      _ => Icons.circle_outlined,
    };

List<NavSection> buildNav(AppContext ctx, Dict dict) {
  final d = dict.nav;
  final s = d.sections;
  final dashboard = NavItem(ctx.isSuperAdmin ? '/admin' : '/tableau-de-bord', d.dashboard, 'grid', exact: true);
  NavItem lots([String? label]) => NavItem('/lots', label ?? d.lots, 'building');
  final budgets = NavItem('/finances/budgets', d.budgets, 'wallet');
  final appels = NavItem('/finances/appels-de-fonds', d.appels, 'coins');
  final contestations = NavItem('/finances/contestations', d.contestations, 'scale');
  NavItem comptabilite([String? label]) => NavItem('/finances/comptabilite', label ?? d.comptabilite, 'chart');
  final ag = NavItem('/ag', d.ag, 'vote');
  NavItem incidents([String? label]) => NavItem('/incidents', label ?? d.incidents, 'wrench');
  final prestataires = NavItem('/prestataires', d.prestataires, 'send');
  final espaces = NavItem('/espaces-communs', d.espaces, 'home');
  final reservations = NavItem('/reservations', d.reservations, 'calendar');
  final visites = NavItem('/visites', d.visites, 'door');
  final personnel = NavItem('/personnel', d.personnel, 'users');
  final documents = NavItem('/documents', d.documents, 'file');
  final litiges = NavItem('/litiges', d.litiges, 'scale');
  final invitations = NavItem('/invitations', d.invitations, 'key');
  final membres = NavItem('/membres', d.membres, 'users');
  final parametres = NavItem('/parametres', d.parametres, 'settings');

  switch (ctx.role) {
    case 'SUPER_ADMIN':
      return [
        NavSection(s.plateforme, [
          NavItem('/admin', d.coproprietes, 'shield', exact: true),
          NavItem('/admin/coproprietes/nouvelle', dict.admin.creer, 'building', exact: true),
        ]),
      ];
    case 'SYNDIC':
      return [
        NavSection(null, [dashboard]),
        NavSection(s.finances, [budgets, appels, comptabilite(), contestations]),
        NavSection(s.vieCollective, [ag, incidents(), reservations, litiges]),
        NavSection(s.quotidien, [lots(), espaces, personnel, visites, prestataires, documents]),
        NavSection(s.administration, [membres, invitations, parametres]),
      ];
    case 'CONSEIL_SYNDICAL':
      return [
        NavSection(null, [dashboard]),
        NavSection(s.finances, [budgets, appels, comptabilite(), contestations]),
        NavSection(s.vieCollective, [ag, incidents(), reservations, litiges]),
        NavSection(s.quotidien, [lots(), espaces, personnel, visites, prestataires, documents]),
      ];
    case 'PROPRIETAIRE':
    case 'INDIVISAIRE':
    case 'PERSONNE_MORALE_REPRESENTANT':
      return [
        NavSection(null, [dashboard]),
        NavSection(s.finances, [lots(dict.lots.mesLots), comptabilite(d.monReleve), budgets]),
        NavSection(s.vieCollective, [ag, incidents(dict.incidents.mesSignalements), litiges]),
        NavSection(s.quotidien, [espaces, reservations, visites, documents]),
      ];
    case 'LOCATAIRE':
      return [
        NavSection(null, [dashboard]),
        NavSection(s.vieCollective, [incidents(dict.incidents.mesSignalements), litiges]),
        NavSection(s.quotidien, [lots(dict.lots.mesLots), espaces, reservations, visites, documents]),
      ];
    case 'GARDIEN':
      return [
        NavSection(null, [dashboard]),
        NavSection(s.quotidien, [visites, incidents(), lots(), espaces, personnel, prestataires, documents]),
      ];
    default: // PRESTATAIRE
      return [
        NavSection(null, [dashboard, incidents(dict.incidents.mesTickets)]),
      ];
  }
}

const Map<String, List<String>> _tabsParRole = {
  'SUPER_ADMIN': ['shield', 'building'],
  'SYNDIC': ['grid', 'coins', 'wrench', 'building'],
  'CONSEIL_SYNDICAL': ['grid', 'coins', 'wrench', 'building'],
  'PROPRIETAIRE': ['grid', 'chart', 'wrench', 'home'],
  'INDIVISAIRE': ['grid', 'chart', 'wrench', 'home'],
  'PERSONNE_MORALE_REPRESENTANT': ['grid', 'chart', 'wrench', 'home'],
  'LOCATAIRE': ['grid', 'wrench', 'calendar', 'file'],
  'GARDIEN': ['grid', 'door', 'wrench', 'building'],
  'PRESTATAIRE': ['grid', 'wrench'],
};

/// Barre d'onglets : 4 destinations au plus (libellé court), le 5e « Plus » ouvre le menu.
List<NavItem> buildTabs(List<NavSection> nav, AppContext ctx, Dict dict) {
  final items = nav.expand((s) => s.items).toList();
  final court = <String, String>{
    'grid': dict.nav.court.grid, 'coins': dict.nav.court.coins, 'wrench': dict.nav.court.wrench, 'building': dict.nav.court.building,
    'chart': dict.nav.court.chart, 'home': dict.nav.court.home, 'calendar': dict.nav.court.calendar, 'file': dict.nav.court.file,
    'door': dict.nav.court.door, 'shield': dict.nav.court.shield, 'wallet': dict.nav.court.wallet, 'vote': dict.nav.court.vote,
    'users': dict.nav.court.users, 'key': dict.nav.court.key, 'scale': dict.nav.court.scale, 'settings': dict.nav.court.settings, 'send': dict.nav.court.send,
  };
  final tabs = <NavItem>[];
  for (final icon in _tabsParRole[ctx.role] ?? const ['grid']) {
    final it = items.where((i) => i.icon == icon).firstOrNull;
    if (it != null && !tabs.any((t) => t.path == it.path)) {
      tabs.add(NavItem(it.path, court[icon] ?? it.label, it.icon, exact: it.exact));
    }
  }
  return tabs.take(4).toList();
}
