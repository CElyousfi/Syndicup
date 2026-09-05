"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brand, BrandMark } from "../brand";
import { LocaleSwitch } from "../locale-switch";
import { Avatar } from "../ui/avatar";
import { CBuilding } from "../ui/color-icons";
import { GuidedTour, type TourLabels } from "../onboarding/guided-tour";
import { Toaster } from "./toaster";
import { useLive } from "./live";
import { seDeconnecter } from "../../lib/actions/session-actions";
import type { NavSection, NavItem, IconKey } from "./nav";
import {
  IconBell,
  IconBuilding,
  IconCalendar,
  IconChart,
  IconChevronDown,
  IconCoins,
  IconDoor,
  IconFile,
  IconGrid,
  IconHome,
  IconKey as IconKeyGlyph,
  IconLogout,
  IconScale,
  IconSearch,
  IconSend,
  IconSettings,
  IconShield,
  IconUsers,
  IconVote,
  IconWallet,
  IconSuitcase,
  IconWrench,
  IconX, IconReceipt, IconPie } from "../ui/icons";

const ICONS: Record<IconKey, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  grid: IconGrid,
  building: IconBuilding,
  coins: IconCoins,
  wallet: IconWallet,
  vote: IconVote,
  wrench: IconWrench,
  calendar: IconCalendar,
  door: IconDoor,
  users: IconUsers,
  key: IconKeyGlyph,
  file: IconFile,
  scale: IconScale,
  settings: IconSettings,
  home: IconHome,
  shield: IconShield,
  send: IconSend,
  chart: IconChart,
  suitcase: IconSuitcase,
  receipt: IconReceipt,
  pie: IconPie,
};

export interface FrameLabels {
  logout: string;
  profil: string;
  donnees: string;
  notifications: string;
  switchCopro: string;
  openMenu: string;
  closeMenu: string;
  search: string;
  plus: string;
  menu: string;
}

/**
 * Coque applicative.
 *  - Desktop (≥ lg) : barre latérale flottante + en-tête avec recherche — inchangé.
 *  - Mobile/tablette : une vraie coque d'application — barre de titre compacte, barre
 *    d'onglets fixe en bas (4 destinations + « Plus »), menu complet en feuille qui
 *    monte du bas. Aucun tiroir latéral : le pouce fait tout depuis le bas de l'écran.
 */
export function AppFrame({
  locale,
  nav,
  tabs,
  coproId,
  coproNom,
  coproVille,
  coproLogo,
  multiCopro,
  userNom,
  userRole,
  unreadCount,
  labels,
  tour,
  children,
}: {
  locale: "fr" | "ar";
  nav: NavSection[];
  tabs: NavItem[];
  coproId: string | null;
  coproNom: string | null;
  coproVille: string | null;
  /** Cache-buster du logo (chemin storage) — null : pas de logo, icône générique. */
  coproLogo: string | null;
  multiCopro: boolean;
  userNom: string;
  userRole: string;
  unreadCount: number;
  labels: FrameLabels;
  tour: TourLabels;
  children: React.ReactNode;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const pathname = usePathname();
  const unread = useLive(unreadCount, locale);
  const logoSrc = coproId && coproLogo ? `/api/copro-logo?id=${coproId}&v=${encodeURIComponent(coproLogo)}` : null;

  // Fermer le menu mobile à chaque navigation.
  useEffect(() => setSheetOpen(false), [pathname]);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-[76px] shrink-0 items-center justify-between px-6">
        <Link href={`/${locale}/tableau-de-bord`}>
          <Brand size={32} />
        </Link>
      </div>

      {/* Copropriété active */}
      {coproNom ? (
        multiCopro ? (
          <Link
            href={`/${locale}/choisir-copropriete`}
            title={labels.switchCopro}
            className="mx-4 mb-3 flex items-center gap-3 rounded-2xl bg-action-wash px-3 py-2.5 ring-1 ring-inset ring-action/10 transition-colors hover:bg-action-tint"
          >
            <CoproChip nom={coproNom} ville={coproVille} logo={logoSrc} />
            <IconChevronDown width={16} height={16} className="ms-auto shrink-0 text-faint" />
          </Link>
        ) : (
          <div className="mx-4 mb-3 flex items-center gap-3 rounded-2xl bg-action-wash px-3 py-2.5 ring-1 ring-inset ring-action/10">
            <CoproChip nom={coproNom} ville={coproVille} logo={logoSrc} />
          </div>
        )
      ) : null}

      <nav className="flex-1 overflow-y-auto px-3 pb-4 scroll-thin">
        {nav.map((section, i) => (
          <div key={i} className="mt-5 first:mt-1">
            {section.label ? (
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
                {section.label}
              </p>
            ) : null}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(item);
                const Icon = ICONS[item.icon];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      data-tour={`nav-${item.icon}`}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-all ${
                        active
                          ? "bg-ink text-white shadow-[0_10px_20px_-10px_rgb(18_18_18/0.5)]"
                          : "text-body hover:bg-ground hover:text-ink"
                      }`}
                    >
                      <Icon width={18} height={18} className={active ? "text-sage" : "text-soft"} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Utilisateur */}
      <div className="border-t border-hairline p-3">
        <div className="flex items-center gap-3 rounded-2xl px-2 py-2">
          <Avatar nom={userNom} size={38} solid />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink">{userNom}</p>
            <p className="truncate text-[12px] text-soft">{userRole}</p>
          </div>
        </div>
        <div className="mt-1 space-y-0.5">
          <Link
            href={`/${locale}/profil`}
            className="flex h-9 items-center gap-2.5 rounded-2xl px-3 text-[13px] font-medium text-body transition-colors hover:bg-ground hover:text-ink"
          >
            <IconSettings width={16} height={16} className="text-soft" />
            {labels.profil}
          </Link>
          <form action={seDeconnecter}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="flex h-9 w-full items-center gap-2.5 rounded-2xl px-3 text-[13px] font-medium text-body transition-colors hover:bg-danger-tint hover:text-danger"
            >
              <IconLogout width={16} height={16} />
              {labels.logout}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-ground">
      {/* Barre latérale desktop — panneau flottant arrondi */}
      <aside className="fixed inset-y-3 start-3 z-30 hidden w-[268px] overflow-hidden rounded-[26px] bg-surface shadow-float lg:block">
        {sidebar}
      </aside>

      {/* Menu complet mobile — feuille qui monte du bas */}
      {sheetOpen ? (
        <MobileSheet
          locale={locale}
          nav={nav}
          logo={logoSrc}
          coproNom={coproNom}
          coproVille={coproVille}
          multiCopro={multiCopro}
          userNom={userNom}
          userRole={userRole}
          labels={labels}
          isActive={isActive}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}

      {/* Zone contenu */}
      <div className="lg:ps-[288px]">
        {/* En-tête desktop / tablette large */}
        <header className="sticky top-0 z-20 hidden bg-ground/85 backdrop-blur-md lg:block">
          <div className="mx-auto flex h-[68px] w-full max-w-[1240px] items-center gap-3 px-8">
            <QuickSearch nav={nav} placeholder={labels.search} />
            <div className="ms-auto flex shrink-0 items-center gap-2">
              <LocaleSwitch locale={locale} subtle />
              <BellLink href={`/${locale}/notifications`} label={labels.notifications} count={unread} />
            </div>
          </div>
        </header>

        {/* Barre de titre mobile — compacte, bord à bord, sous l'encoche */}
        <header className="app-topbar sticky top-0 z-20 lg:hidden">
          <div className="flex h-[56px] items-center gap-3 px-4">
            <Link href={`/${locale}/tableau-de-bord`} className="shrink-0" aria-label={coproNom ?? "SyndicUp"}>
              {logoSrc ? (
                <img src={logoSrc} alt="" width={36} height={36} className="size-9 rounded-xl object-cover ring-1 ring-black/5" />
              ) : (
                <BrandMark size={30} />
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold leading-tight text-ink">
                {coproNom ?? "SyndicUp"}
              </p>
              {coproVille ? (
                <p className="truncate text-[11px] leading-tight text-soft">{coproVille}</p>
              ) : null}
            </div>
            <BellLink href={`/${locale}/notifications`} label={labels.notifications} count={unread} />
          </div>
        </header>

        <main className="app-main mx-auto w-full max-w-[1240px] px-4 pt-3 sm:px-6 lg:px-8 lg:pb-12 lg:pt-4">
          {children}
        </main>
      </div>

      {/* Barre d'onglets mobile */}
      <nav className="app-tabbar fixed inset-x-0 bottom-0 z-30 lg:hidden" aria-label={labels.menu}>
        <ul className="flex items-stretch justify-around px-1">
          {tabs.map((item) => {
            const active = isActive(item) && !sheetOpen;
            const Icon = ICONS[item.icon];
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`tab flex flex-col items-center gap-1 pb-1 pt-2 text-[10.5px] font-semibold ${active ? "is-active text-ink" : "text-soft"}`}
                >
                  <span className="tab-pill flex h-[30px] w-[52px] items-center justify-center rounded-full transition-colors">
                    <Icon width={21} height={21} />
                  </span>
                  <span className="max-w-full truncate px-1">{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-expanded={sheetOpen}
              aria-label={labels.openMenu}
              className={`tab flex w-full flex-col items-center gap-1 pb-1 pt-2 text-[10.5px] font-semibold ${sheetOpen ? "is-active text-ink" : "text-soft"}`}
            >
              <span className="tab-pill flex h-[30px] w-[52px] items-center justify-center rounded-full transition-colors">
                <IconDots />
              </span>
              <span className="max-w-full truncate px-1">{labels.plus}</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Visite guidée interactive — premier lancement uniquement. Sur mobile, les étapes
          « menu » ouvrent la feuille de navigation à la place de l'ancien tiroir. */}
      <GuidedTour locale={locale} labels={tour} onDrawer={setSheetOpen} />
      <Toaster />
    </div>
  );
}

/** Feuille « Plus » : toute la navigation en tuiles, compte, langue, déconnexion. */
function MobileSheet({
  locale,
  nav,
  logo,
  coproNom,
  coproVille,
  multiCopro,
  userNom,
  userRole,
  labels,
  isActive,
  onClose,
}: {
  locale: "fr" | "ar";
  nav: NavSection[];
  logo: string | null;
  coproNom: string | null;
  coproVille: string | null;
  multiCopro: boolean;
  userNom: string;
  userRole: string;
  labels: FrameLabels;
  isActive: (item: NavItem) => boolean;
  onClose: () => void;
}) {
  // Verrouille le défilement de la page derrière la feuille.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={labels.menu}>
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-[3px] animate-fade" onClick={onClose} />
      <div className="app-sheet absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-[28px] bg-surface shadow-pop animate-sheet-up">
        <div className="sheet-handle" aria-hidden />
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-1">
          <p className="text-[17px] font-semibold text-ink">{labels.menu}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.closeMenu}
            className="flex size-9 items-center justify-center rounded-full bg-ground text-body"
          >
            <IconX width={18} height={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {coproNom ? (
            multiCopro ? (
              <Link
                href={`/${locale}/choisir-copropriete`}
                className="mb-3 flex items-center gap-3 rounded-2xl bg-action-wash px-3 py-2.5 ring-1 ring-inset ring-action/10"
              >
                <CoproChip nom={coproNom} ville={coproVille} logo={logo} />
                <span className="ms-auto shrink-0 text-[12px] font-medium text-action">{labels.switchCopro}</span>
              </Link>
            ) : (
              <div className="mb-3 flex items-center gap-3 rounded-2xl bg-action-wash px-3 py-2.5 ring-1 ring-inset ring-action/10">
                <CoproChip nom={coproNom} ville={coproVille} logo={logo} />
              </div>
            )
          ) : null}

          {nav.map((section, i) => (
            <div key={i} className="mt-4 first:mt-0">
              {section.label ? (
                <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
                  {section.label}
                </p>
              ) : null}
              <ul className="grid grid-cols-3 gap-2">
                {section.items.map((item) => {
                  const active = isActive(item);
                  const Icon = ICONS[item.icon];
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        data-tour={`nav-${item.icon}`}
                        aria-current={active ? "page" : undefined}
                        className={`tile flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-[18px] px-2 py-3 text-center text-[12px] font-medium leading-tight ${
                          active ? "bg-ink text-white" : "bg-ground text-ink-strong"
                        }`}
                      >
                        <Icon width={22} height={22} className={active ? "text-sage" : "text-action"} />
                        <span className="line-clamp-2">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="mt-5 rounded-[20px] bg-ground p-3">
            <div className="flex items-center gap-3 px-1 py-1">
              <Avatar nom={userNom} size={40} solid />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink">{userNom}</p>
                <p className="truncate text-[12px] text-soft">{userRole}</p>
              </div>
              <LocaleSwitch locale={locale} subtle />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link
                href={`/${locale}/profil`}
                className="flex h-11 items-center justify-center gap-2 rounded-full bg-surface text-[13px] font-medium text-ink-strong"
              >
                <IconSettings width={16} height={16} className="text-soft" />
                {labels.profil}
              </Link>
              <form action={seDeconnecter}>
                <input type="hidden" name="locale" value={locale} />
                <button
                  type="submit"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-surface text-[13px] font-medium text-danger"
                >
                  <IconLogout width={16} height={16} />
                  {labels.logout}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BellLink({ href, label, count }: { href: string; label: string; count: number }) {
  return (
    <Link
      href={href}
      data-tour="bell"
      aria-label={label}
      className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-body shadow-[0_1px_3px_rgb(32_31_35/0.08)] transition-colors hover:text-ink"
    >
      <IconBell width={18} height={18} />
      {count > 0 ? (
        <span className="absolute -top-0.5 -end-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white ring-2 ring-ground">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Recherche rapide — filtre les entrées de navigation du rôle courant et navigue.
 * Entièrement locale (aucun appel réseau) : elle rend la barre vivante ET honnête.
 */
function QuickSearch({ nav, placeholder }: { nav: NavSection[]; placeholder: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => nav.flatMap((s) => s.items), [nav]);
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return items.filter((it) => it.label.toLowerCase().includes(needle)).slice(0, 6);
  }, [q, items]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const go = (href: string) => {
    setQ("");
    setOpen(false);
    router.push(href);
  };

  return (
    <div ref={rootRef} data-tour="search" className="relative ms-1 w-full max-w-[400px]">
      <div className="flex h-11 items-center rounded-full bg-surface pe-1.5 ps-4 shadow-[0_1px_3px_rgb(32_31_35/0.08)] focus-within:ring-2 focus-within:ring-action/25">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) go(matches[0].href);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={`${placeholder}…`}
          className="h-full w-full bg-transparent text-sm text-ink-strong outline-none placeholder:text-faint"
          role="combobox"
          aria-expanded={open && matches.length > 0}
          aria-label={placeholder}
        />
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-white" aria-hidden>
          <IconSearch width={15} height={15} />
        </span>
      </div>
      {open && matches.length > 0 ? (
        <ul className="absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl bg-surface py-1.5 shadow-pop">
          {matches.map((m) => {
            const Icon = ICONS[m.icon];
            return (
              <li key={m.href}>
                <button
                  type="button"
                  onClick={() => go(m.href)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm font-medium text-body transition-colors hover:bg-ground hover:text-ink"
                >
                  <Icon width={16} height={16} className="text-soft" />
                  {m.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function CoproChip({ nom, ville, logo }: { nom: string; ville: string | null; logo: string | null }) {
  return (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface shadow-[0_1px_3px_rgb(32_31_35/0.08)]">
        {logo ? (
          <img src={logo} alt="" width={40} height={40} className="size-10 object-cover" />
        ) : (
          <CBuilding width={22} height={22} />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-ink">{nom}</span>
        {ville ? <span className="block truncate text-[12px] text-soft">{ville}</span> : null}
      </span>
    </>
  );
}

function IconDots() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}
