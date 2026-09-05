/**
 * Navigation PAR RÔLE (brief §5) — construite côté serveur, jamais une navigation unique avec
 * des entrées grisées. Les icônes voyagent par clé (composants non sérialisables).
 */
import type { RoleType } from "../../lib/api/types";
import type { Dict, Locale } from "../../lib/i18n";

export type IconKey =
  | "grid"
  | "building"
  | "coins"
  | "wallet"
  | "vote"
  | "wrench"
  | "calendar"
  | "door"
  | "users"
  | "key"
  | "file"
  | "scale"
  | "settings"
  | "home"
  | "shield"
  | "send"
  | "chart"
  | "suitcase"
  | "receipt";

export interface NavItem {
  href: string;
  label: string;
  icon: IconKey;
  /** Marque active aussi les sous-routes (/lots/xyz). */
  exact?: boolean;
}

export interface NavSection {
  label: string | null;
  items: NavItem[];
}

export function buildNav(role: RoleType, dict: Dict, locale: Locale): NavSection[] {
  const p = (path: string) => `/${locale}${path}`;
  const d = dict.nav;

  const dashboard: NavItem = {
    href: p(role === "SUPER_ADMIN" ? "/admin" : "/tableau-de-bord"),
    label: d.dashboard,
    icon: "grid",
    exact: true,
  };

  const lots = (label = d.lots): NavItem => ({ href: p("/lots"), label, icon: "building" });
  const budgets: NavItem = { href: p("/finances/budgets"), label: d.budgets, icon: "wallet" };
  const appels: NavItem = { href: p("/finances/appels-de-fonds"), label: d.appels, icon: "coins" };
  // M16 — dépenses : l'argent qui sort (syndic gère, conseil approuve/contrôle).
  const depenses: NavItem = { href: p("/finances/depenses"), label: d.depenses, icon: "receipt" };
  const contestations: NavItem = {
    href: p("/finances/contestations"),
    label: d.contestations,
    icon: "scale",
  };
  const comptabilite = (label = d.comptabilite): NavItem => ({
    href: p("/finances/comptabilite"),
    label,
    icon: "chart",
  });
  const ag: NavItem = { href: p("/ag"), label: d.ag, icon: "vote" };
  const incidents = (label = d.incidents): NavItem => ({
    href: p("/incidents"),
    label,
    icon: "wrench",
  });
  const prestataires: NavItem = { href: p("/prestataires"), label: d.prestataires, icon: "send" };
  const espaces: NavItem = { href: p("/espaces-communs"), label: d.espaces, icon: "home" };
  const reservations: NavItem = {
    href: p("/reservations"),
    label: d.reservations,
    icon: "calendar",
  };
  const visites: NavItem = { href: p("/visites"), label: d.visites, icon: "door" };
  const personnel: NavItem = { href: p("/personnel"), label: d.personnel, icon: "users" };
  const documents: NavItem = { href: p("/documents"), label: d.documents, icon: "file" };
  const litiges: NavItem = { href: p("/litiges"), label: d.litiges, icon: "scale" };
  const invitations: NavItem = { href: p("/invitations"), label: d.invitations, icon: "key" };
  const membres: NavItem = { href: p("/membres"), label: d.membres, icon: "users" };
  const parametres: NavItem = { href: p("/parametres"), label: d.parametres, icon: "settings" };
  // M15 — location courte durée : régime, déclarations de lots, séjours (Doc A §10.2).
  const lcd: NavItem = {
    href: p("/location-courte-duree"),
    label: d.locationCourteDuree,
    icon: "suitcase",
  };

  const s = d.sections;

  switch (role) {
    case "SUPER_ADMIN":
      // Opérateur plateforme : crée les copropriétés et invite leur premier syndic —
      // le syndic gère ensuite tout le reste (lots, résidents, finances…). Aucun accès
      // à l'application « résidence » : la console est son application (voir middleware).
      return [
        {
          label: s.plateforme,
          items: [
            { href: p("/admin"), label: d.coproprietes, icon: "shield", exact: true },
            {
              href: p("/admin/coproprietes/nouvelle"),
              label: dict.admin.creer,
              icon: "building",
              exact: true,
            },
          ],
        },
      ];
    case "SYNDIC":
      return [
        { label: null, items: [dashboard] },
        { label: s.finances, items: [budgets, appels, depenses, comptabilite(), contestations] },
        { label: s.vieCollective, items: [ag, incidents(), reservations, litiges] },
        {
          label: s.quotidien,
          items: [lots(), espaces, personnel, visites, lcd, prestataires, documents],
        },
        { label: s.administration, items: [membres, invitations, parametres] },
      ];
    case "CONSEIL_SYNDICAL":
      return [
        { label: null, items: [dashboard] },
        { label: s.finances, items: [budgets, appels, depenses, comptabilite(), contestations] },
        { label: s.vieCollective, items: [ag, incidents(), reservations, litiges] },
        {
          label: s.quotidien,
          items: [lots(), espaces, personnel, visites, lcd, prestataires, documents],
        },
      ];
    case "PROPRIETAIRE":
    case "INDIVISAIRE":
    case "PERSONNE_MORALE_REPRESENTANT":
      return [
        { label: null, items: [dashboard] },
        { label: s.finances, items: [lots(dict.lots.mesLots), comptabilite(d.monReleve), budgets] },
        { label: s.vieCollective, items: [ag, incidents(dict.incidents.mesSignalements), litiges] },
        { label: s.quotidien, items: [espaces, reservations, visites, lcd, documents] },
      ];
    case "GESTIONNAIRE_LCD":
      // Gestionnaire désigné sur un lot : le module LCD, les incidents (nuisances pendant un
      // séjour) et les documents — jamais les finances, l'AG ni les lots.
      return [
        { label: null, items: [dashboard] },
        { label: s.quotidien, items: [lcd, incidents(dict.incidents.mesSignalements), documents] },
      ];
    case "LOCATAIRE":
      return [
        { label: null, items: [dashboard] },
        {
          label: s.vieCollective,
          items: [incidents(dict.incidents.mesSignalements), litiges],
        },
        { label: s.quotidien, items: [lots(dict.lots.mesLots), espaces, reservations, visites, documents] },
      ];
    case "GARDIEN":
      return [
        { label: null, items: [dashboard] },
        {
          label: s.quotidien,
          items: [visites, lcd, incidents(), lots(), espaces, personnel, prestataires, documents],
        },
      ];
    case "PRESTATAIRE":
      return [
        { label: null, items: [dashboard, incidents(dict.incidents.mesTickets)] },
      ];
  }
}

/**
 * Barre d'onglets mobile : 4 destinations au plus par rôle (les plus fréquentes), le 5e onglet
 * « Plus » ouvre la navigation complète. Sélection par clé d'icône dans la navigation déjà
 * construite — mêmes libellés, mêmes liens, aucune duplication de règles.
 */
const TABS_PAR_ROLE: Record<RoleType, IconKey[]> = {
  SUPER_ADMIN: ["shield", "building"],
  SYNDIC: ["grid", "coins", "wrench", "building"],
  CONSEIL_SYNDICAL: ["grid", "coins", "wrench", "building"],
  PROPRIETAIRE: ["grid", "chart", "wrench", "home"],
  INDIVISAIRE: ["grid", "chart", "wrench", "home"],
  PERSONNE_MORALE_REPRESENTANT: ["grid", "chart", "wrench", "home"],
  GESTIONNAIRE_LCD: ["grid", "suitcase", "wrench", "file"],
  LOCATAIRE: ["grid", "wrench", "calendar", "file"],
  GARDIEN: ["grid", "door", "wrench", "building"],
  PRESTATAIRE: ["grid", "wrench"],
};

export function buildMobileTabs(nav: NavSection[], role: RoleType, dict: Dict): NavItem[] {
  const items = nav.flatMap((s) => s.items);
  const tabs: NavItem[] = [];
  const court = dict.nav.court as Partial<Record<IconKey, string>>;
  for (const icon of TABS_PAR_ROLE[role]) {
    const item = items.find((it) => it.icon === icon);
    // Libellé court sous l'icône (« Accueil », « Appels »…) — jamais tronqué.
    if (item && !tabs.some((t) => t.href === item.href)) tabs.push({ ...item, label: court[icon] ?? item.label });
  }
  return tabs.slice(0, 4);
}
