"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, LazyMotion, MotionConfig, m, useDragControls } from "motion/react";
import { Brand, BrandTile } from "../brand";
import { LocaleSwitch } from "../locale-switch";
import { Avatar } from "../ui/avatar";
import { CBuilding, IconCircle } from "../ui/color-icons";
import { Illustration } from "../ui/illustration";
import { GuidedTour, type TourLabels } from "../onboarding/guided-tour";
import { Toaster } from "./toaster";
import { SuccessOverlay } from "./success-overlay";
import { useLive } from "./live";
import { seDeconnecter } from "../../lib/actions/session-actions";
import { DUR, EASE_IN, EASE_OUT, SPRING_LAYOUT } from "../../lib/motion";
import { armSounds, useSensations } from "../../lib/feel";
import { useBadgePop } from "./badge-pop";
import { ConnectivityBanner, useScrollReveal } from "./ambient";
import { SignatureOverlay } from "./signature-overlay";
import type { Dict } from "../../lib/i18n";
import type { NavSection, NavItem, IconKey, QuickAction } from "./nav";
import {
  IconBell,
  IconBuilding,
  IconCalendar,
  IconChart,
  IconChevronDown,
  IconChevronEnd,
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
  IconX, IconReceipt, IconPie, IconHandshake, IconMegaphone, IconTasks, IconCar, IconDownload } from "../ui/icons";

const loadMotionFeatures = () => import("../../lib/motion-features").then((mod) => mod.default);

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
  handshake: IconHandshake,
  megaphone: IconMegaphone,
  tasks: IconTasks,
  car: IconCar,
  download: IconDownload,
  briefcase: IconSuitcase,
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
  actions: string;
  quickTitle: string;
  done: string;
}

/**
 * Coque applicative (langage Wise, identique à l'app mobile).
 *  - Desktop (≥ lg) : barre latérale blanche à plat — logo, pill lime « Actions » (actions
 *    rapides du rôle), copropriété, navigation en lignes simples ; en-tête avec recherche.
 *  - Mobile/tablette : barre de titre compacte, barre d'onglets fixe (3 destinations, bouton
 *    d'action lime au centre, « Plus »), menu complet en feuille qui monte du bas.
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
  cabinetNom,
  userNom,
  userRole,
  unreadCount,
  labels,
  alive,
  tour,
  quick = [],
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
  /** M25 — cabinet de syndic dont l'utilisateur est membre (lien vers l'espace cabinet, au-dessus de la copropriété). */
  cabinetNom?: string | null;
  userNom: string;
  userRole: string;
  unreadCount: number;
  labels: FrameLabels;
  /** Textes de la couche Alive (bandeau de connexion, moments signature). */
  alive: Dict["alive"];
  tour: TourLabels;
  quick?: QuickAction[];
  children: React.ReactNode;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const pathname = usePathname();
  const unread = useLive(unreadCount, locale);
  // Couche Alive : réglage « Animations réduites » (en plus de la préférence système) et sons
  // préchargés au premier geste.
  const sensations = useSensations();
  useEffect(() => armSounds(), []);
  useBadgePop();
  useScrollReveal();
  const logoSrc = coproId && coproLogo ? `/api/copro-logo?id=${coproId}&v=${encodeURIComponent(coproLogo)}` : null;

  // Fermer le menu mobile à chaque navigation.
  useEffect(() => {
    setSheetOpen(false);
    setQuickOpen(false);
  }, [pathname]);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-[84px] shrink-0 items-center px-7">
        <Link href={`/${locale}/tableau-de-bord`} aria-label="SyndicUp">
          <Brand size={36} />
        </Link>
      </div>

      {/* Action principale (Wise « Send money ») : actions rapides du rôle. */}
      {quick.length > 0 ? (
        <div className="px-5 pb-4">
          <button
            type="button"
            onClick={() => setQuickOpen(true)}
            aria-haspopup="dialog"
            className="su-btn inline-flex h-11 w-full items-center justify-center gap-2 rounded-btn bg-cta text-[15px] font-semibold text-ink hover:bg-lime-hover"
          >
            <IconPlus />
            {labels.actions}
          </button>
        </div>
      ) : null}

      {/* M25 — Cabinet (portefeuille) au-dessus de la copropriété active */}
      {cabinetNom ? (
        <Link href={`/${locale}/cabinet`} className="mx-4 mb-2 flex items-center gap-2 rounded-full bg-wash px-3.5 py-2 text-[12.5px] font-semibold text-ink-strong transition-colors hover:bg-wash-strong">
          <IconSuitcase width={16} height={16} className="shrink-0 text-faint" />
          <span className="truncate">{cabinetNom}</span>
          <IconChevronDown width={14} height={14} className="ms-auto shrink-0 -rotate-90 rtl:rotate-90 text-faint" />
        </Link>
      ) : null}
      {/* Copropriété active */}
      {coproNom ? (
        multiCopro ? (
          <Link
            href={`/${locale}/choisir-copropriete`}
            title={labels.switchCopro}
            className="mx-4 mb-3 flex items-center gap-3 rounded-[20px] bg-tile px-3 py-2.5 transition-colors hover:bg-[#e3e2da]"
          >
            <CoproChip nom={coproNom} ville={coproVille} logo={logoSrc} />
            <IconChevronDown width={16} height={16} className="ms-auto shrink-0 text-faint" />
          </Link>
        ) : (
          <div className="mx-4 mb-3 flex items-center gap-3 rounded-[20px] bg-tile px-3 py-2.5">
            <CoproChip nom={coproNom} ville={coproVille} logo={logoSrc} />
          </div>
        )
      ) : null}

      <nav className="flex-1 overflow-y-auto px-3 pb-4 scroll-thin">
        {nav.map((section, i) => (
          <div key={i} className="mt-5 first:mt-1">
            {section.label ? (
              <p className="px-4 pb-1.5 text-[12px] font-semibold text-faint">
                {section.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item);
                const Icon = ICONS[item.icon];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      data-tour={`nav-${item.icon}`}
                      aria-current={active ? "page" : undefined}
                      className={`group/nav relative flex items-center gap-3.5 rounded-full px-4 py-2.5 text-[14.5px] transition-colors duration-200 ${
                        active ? "font-bold text-ink" : "font-medium text-ink-strong hover:bg-wash"
                      }`}
                    >
                      {/* Pastille active partagée : elle glisse d'une entrée à l'autre à chaque navigation. */}
                      {active ? (
                        <m.span
                          layoutId="nav-pill"
                          transition={SPRING_LAYOUT}
                          className="absolute inset-0 rounded-full bg-tile"
                          aria-hidden
                        />
                      ) : null}
                      <Icon
                        width={18}
                        height={18}
                        className={`relative shrink-0 transition-[color,scale] duration-300 ${
                          active ? "text-link" : "text-ink-strong group-hover/nav:scale-110"
                        }`}
                      />
                      <span className="relative truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Utilisateur */}
      <div className="p-3">
        <div className="flex items-center gap-3 rounded-[20px] bg-tile px-3 py-2.5">
          <Avatar nom={userNom} size={38} solid />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink">{userNom}</p>
            <p className="truncate text-[12px] text-soft">{userRole}</p>
          </div>
        </div>
        <div className="mt-1 space-y-0.5">
          <Link
            href={`/${locale}/profil`}
            className="flex h-9 items-center gap-2.5 rounded-full px-3 text-[13px] font-medium text-ink-strong transition-colors hover:bg-wash"
          >
            <IconSettings width={16} height={16} className="text-soft" />
            {labels.profil}
          </Link>
          <form action={seDeconnecter}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="flex h-9 w-full items-center gap-2.5 rounded-full px-3 text-[13px] font-medium text-ink-strong transition-colors hover:bg-danger-tint hover:text-danger"
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
    <LazyMotion features={loadMotionFeatures} strict>
    <MotionConfig reducedMotion={sensations.reducedMotion ? "always" : "user"}>
    <div className="min-h-screen bg-surface">
      {/* Barre latérale desktop — blanche, à plat (Wise) */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-[272px] overflow-hidden bg-surface lg:block">
        {sidebar}
      </aside>

      {/* Actions rapides — feuille (mobile) / fenêtre (desktop) */}
      <AnimatePresence>
        {quickOpen ? <QuickSheet key="quick" title={labels.quickTitle} close={labels.closeMenu} actions={quick} onClose={() => setQuickOpen(false)} /> : null}
      </AnimatePresence>

      {/* Menu complet mobile — feuille qui monte du bas */}
      <AnimatePresence>
      {sheetOpen ? (
        <MobileSheet
          key="sheet"
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
      </AnimatePresence>

      {/* Zone contenu */}
      <div className="lg:ps-[272px]">
        {/* En-tête desktop / tablette large */}
        <header className="sticky top-0 z-20 hidden bg-surface/90 backdrop-blur-md lg:block">
          <div className="mx-auto flex h-[84px] w-full max-w-[1180px] items-center gap-3 px-10">
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
                <BrandTile size={34} />
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

        <main className="app-main mx-auto w-full max-w-[1180px] px-4 pt-3 sm:px-6 lg:px-10 lg:pb-16 lg:pt-2">
          {children}
        </main>
      </div>

      {/* Barre d'onglets mobile */}
      <nav className="app-tabbar fixed inset-x-0 bottom-0 z-30 lg:hidden" aria-label={labels.menu}>
        <ul className="flex items-stretch justify-around px-1">
          {(quick.length > 0 ? tabs.slice(0, 3) : tabs).map((item, i, shown) => {
            const active = isActive(item) && !sheetOpen;
            const Icon = ICONS[item.icon];
            const tab = (
              <li key={item.href} className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`tab flex flex-col items-center gap-1 pb-1 pt-2 text-[10.5px] font-semibold ${active ? "is-active text-ink" : "text-soft"}`}
                >
                  <span className="tab-pill relative flex h-[30px] w-[52px] items-center justify-center rounded-full">
                    {active ? <TabPill /> : null}
                    <Icon width={21} height={21} className="relative" />
                  </span>
                  <span className="max-w-full truncate px-1">{item.label}</span>
                </Link>
              </li>
            );
            // Bouton d'action lime au centre (Wise), entre la 2e et la 3e destination.
            return quick.length > 0 && i === Math.min(1, shown.length - 1) ? [
              tab,
              <li key="__actions" className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setQuickOpen(true)}
                  aria-haspopup="dialog"
                  className="tab flex w-full flex-col items-center gap-1 pb-1 pt-1.5 text-[10.5px] font-semibold text-ink"
                >
                  <span className="flex size-[42px] items-center justify-center rounded-full bg-cta text-ink shadow-[0_6px_16px_-6px_rgb(18_18_18/0.35)] transition-transform active:scale-90">
                    <IconPlus size={24} />
                  </span>
                  <span className="max-w-full truncate px-1">{labels.actions}</span>
                </button>
              </li>,
            ] : tab;
          })}
          <li className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-expanded={sheetOpen}
              aria-label={labels.openMenu}
              className={`tab flex w-full flex-col items-center gap-1 pb-1 pt-2 text-[10.5px] font-semibold ${sheetOpen ? "is-active text-ink" : "text-soft"}`}
            >
              <span className="tab-pill relative flex h-[30px] w-[52px] items-center justify-center rounded-full">
                {sheetOpen ? <TabPill /> : null}
                <IconDots className="relative" />
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
      <SuccessOverlay doneLabel={labels.done} labels={alive} locale={locale} />
      <SignatureOverlay labels={alive} locale={locale} />
      <ConnectivityBanner offline={alive.horsLigne} online={alive.enLigne} />
    </div>
    </MotionConfig>
    </LazyMotion>
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
  const drag = useDragControls();
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
      <m.div
        className="absolute inset-0 bg-ink/45 backdrop-blur-[3px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: DUR.slow, ease: EASE_OUT } }}
        exit={{ opacity: 0, transition: { duration: DUR.base, ease: EASE_IN } }}
        onClick={onClose}
      />
      {/* La feuille se tire vers le bas par sa poignée/son en-tête pour se fermer. */}
      <m.div
        className="app-sheet absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-[28px] bg-surface shadow-pop"
        initial={{ y: "100%" }}
        animate={{ y: 0, transition: { type: "spring", stiffness: 420, damping: 40, mass: 0.9 } }}
        exit={{ y: "100%", transition: { duration: 0.26, ease: EASE_IN } }}
        drag="y"
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.02, bottom: 0.7 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 600) onClose();
        }}
      >
        <div
          className="cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={(e) => drag.start(e)}
        >
        <div className="sheet-handle" aria-hidden />
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-1">
          <p className="text-[22px] font-bold tracking-tight text-ink">{labels.menu}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.closeMenu}
            onPointerDown={(e) => e.stopPropagation()}
            className="su-btn flex size-9 items-center justify-center rounded-full bg-tile text-ink"
          >
            <IconX width={18} height={18} />
          </button>
        </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {coproNom ? (
            multiCopro ? (
              <Link
                href={`/${locale}/choisir-copropriete`}
                className="mb-3 flex items-center gap-3 rounded-[20px] bg-tile px-3 py-2.5"
              >
                <CoproChip nom={coproNom} ville={coproVille} logo={logo} />
                <span className="link ms-auto shrink-0 text-[12px]">{labels.switchCopro}</span>
              </Link>
            ) : (
              <div className="mb-3 flex items-center gap-3 rounded-[20px] bg-tile px-3 py-2.5">
                <CoproChip nom={coproNom} ville={coproVille} logo={logo} />
              </div>
            )
          ) : null}

          {nav.map((section, i) => (
            <div key={i} className="mt-4 first:mt-0">
              {section.label ? (
                <p className="px-1 pb-2 text-[12px] font-semibold text-faint">
                  {section.label}
                </p>
              ) : null}
              <ul className="stagger-grid grid grid-cols-3 gap-2">
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
                          active ? "bg-brand text-white" : "bg-tile text-ink-strong"
                        }`}
                      >
                        <Icon width={22} height={22} className={active ? "text-lime" : "text-link"} />
                        <span className="line-clamp-2">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="mt-5 rounded-[20px] bg-tile p-3">
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
      </m.div>
    </div>
  );
}

function BellLink({ href, label, count }: { href: string; label: string; count: number }) {
  // La cloche sonne quand le compteur MONTE (nouvelle notification), pas au premier rendu.
  const prev = useRef(count);
  const [ring, setRing] = useState(0);
  useEffect(() => {
    if (count > prev.current) setRing((r) => r + 1);
    prev.current = count;
  }, [count]);
  return (
    <Link
      href={href}
      data-tour="bell"
      aria-label={label}
      className="su-btn relative flex size-11 shrink-0 items-center justify-center rounded-full bg-tile text-ink hover:bg-[#e3e2da]"
    >
      <IconBell key={ring} width={18} height={18} className={ring > 0 ? "animate-ring" : undefined} />
      {count > 0 ? (
        <span
          key={count}
          dir="ltr"
          className="animate-pop absolute -top-0.5 -end-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white ring-2 ring-surface"
        >
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
      <div className="flex h-12 items-center rounded-full bg-tile pe-1.5 ps-5 focus-within:shadow-[inset_0_0_0_2px_var(--color-ink)]">
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
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink" aria-hidden>
          <IconSearch width={15} height={15} />
        </span>
      </div>
      <AnimatePresence>
        {open && matches.length > 0 ? (
          <m.ul
            key="results"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: DUR.base, ease: EASE_OUT } }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: DUR.fast, ease: EASE_IN } }}
            style={{ transformOrigin: "top center" }}
            className="absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl bg-surface py-1.5 shadow-pop"
          >
            {matches.map((it, i) => {
              const Icon = ICONS[it.icon];
              return (
                <m.li
                  key={it.href}
                  layout="position"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03, duration: DUR.base, ease: EASE_OUT } }}
                >
                  <button
                    type="button"
                    onClick={() => go(it.href)}
                    className="group/qs flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm font-medium text-ink-strong transition-colors hover:bg-wash"
                  >
                    <Icon width={16} height={16} className="text-soft transition-[color,scale] duration-200 group-hover/qs:scale-110 group-hover/qs:text-action" />
                    {it.label}
                  </button>
                </m.li>
              );
            })}
          </m.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function CoproChip({ nom, ville, logo }: { nom: string; ville: string | null; logo: string | null }) {
  return (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface">
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

/** Pastille greige de l'onglet actif — partagée (layoutId) : elle glisse vers l'onglet touché. */
function TabPill() {
  return (
    <m.span
      layoutId="tab-pill"
      transition={SPRING_LAYOUT}
      className="absolute inset-0 rounded-full bg-tile"
      aria-hidden
    />
  );
}

function IconDots({ className }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

/** Actions rapides (Wise) : feuille du bas sur mobile, fenêtre centrée sur desktop ; lignes à
 *  pastille teintée + chevron, comme `_QuickSheet` côté mobile. */
function QuickSheet({ title, close, actions, onClose }: { title: string; close: string; actions: QuickAction[]; onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center lg:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <m.div
        className="absolute inset-0 bg-ink/45 backdrop-blur-[3px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: DUR.slow, ease: EASE_OUT } }}
        exit={{ opacity: 0, transition: { duration: DUR.base, ease: EASE_IN } }}
        onClick={onClose}
      />
      <m.div
        className="app-sheet relative w-full rounded-t-[32px] bg-surface px-5 pb-6 pt-2 shadow-pop lg:max-w-[460px] lg:rounded-[32px] lg:px-7 lg:pb-7 lg:pt-6"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1, transition: { type: "spring", stiffness: 420, damping: 38 } }}
        exit={{ y: 30, opacity: 0, transition: { duration: 0.2, ease: EASE_IN } }}
      >
        <div className="sheet-handle lg:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-4 pb-3 pt-2 lg:pt-0">
          <p className="text-[24px] font-bold leading-tight tracking-tight text-ink">{title}</p>
          <button type="button" onClick={onClose} aria-label={close} className="su-btn flex size-10 shrink-0 items-center justify-center rounded-full bg-tile text-ink hover:rotate-90">
            <IconX width={18} height={18} />
          </button>
        </div>
        <ul className="stagger-grid -mx-2">
          {actions.map((a) => {
            const Icon = ICONS[a.icon];
            return (
              <li key={a.href}>
                <Link href={a.href} onClick={onClose} className="group/qa flex items-center gap-4 rounded-[20px] px-2 py-2.5 transition-colors hover:bg-wash">
                  <Illustration
                    name={a.art}
                    size={48}
                    fallback={
                      <IconCircle tone={a.tone} size={48}>
                        <Icon width={22} height={22} className="text-ink" />
                      </IconCircle>
                    }
                  />
                  <span className="min-w-0 flex-1 text-[16px] font-semibold text-ink">{a.label}</span>
                  <IconChevronEnd width={20} height={20} className="shrink-0 text-link transition-transform group-hover/qa:translate-x-0.5 rtl:group-hover/qa:-translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      </m.div>
    </div>
  );
}

function IconPlus({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
