/**
 * Briques de l'accueil (langage Wise, miroir de apps/mobile/.../dashboard_screen.dart) :
 * actions rondes, lignes de liste à plat, sections titrées, carte-affiche de la prochaine AG,
 * checklist de démarrage. Composants serveur, aucune logique métier.
 */
import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import type { AppContext } from "../../../../lib/app-context";
import type { AssembleeGenerale, OnboardingChecklist } from "../../../../lib/api/types";
import type { Dict, Locale } from "../../../../lib/i18n";
import { fill } from "../../../../lib/i18n";
import { formatDate, formatHeure, joursRestants } from "../../../../lib/format";
import { buildNav, buildQuickActions, type IconKey } from "../../../../components/shell/nav";
import { SectionHeader } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { PosterCard } from "../../../../components/ui/poster-card";
import { PosterArt } from "../../../../components/ui/poster-art";
import { ProgressBar } from "../../../../components/ui/progress";
import { IconCircle, type IconTone } from "../../../../components/ui/color-icons";
import {
  IconBuilding,
  IconCalendar,
  IconCheck,
  IconChevronEnd,
  IconCoins,
  IconDoor,
  IconKey as IconKeyGlyph,
  IconPlus,
  IconSuitcase,
  IconVote,
  IconWallet,
  IconWrench,
} from "../../../../components/ui/icons";

type Glyph = ComponentType<SVGProps<SVGSVGElement>>;

const GLYPHES: Partial<Record<IconKey, Glyph>> = {
  wallet: IconWallet,
  coins: IconCoins,
  key: IconKeyGlyph,
  wrench: IconWrench,
  suitcase: IconSuitcase,
  calendar: IconCalendar,
  vote: IconVote,
  door: IconDoor,
  building: IconBuilding,
};

/** Actions rondes (Wise « Send / Add money / Request ») : mêmes entrées, mêmes droits que
 *  le bouton « Actions » de la coque — la première est pleine (lime). */
export function RoundActions({ ctx, max = 4 }: { ctx: AppContext; max?: number }) {
  const nav = buildNav(ctx.role, ctx.dict, ctx.locale);
  const actions = buildQuickActions(nav, ctx.role, ctx.roles, ctx.dict, ctx.locale).slice(0, max);
  if (actions.length === 0) return null;
  return (
    <div className="mt-7 grid grid-cols-4 gap-2 sm:flex sm:gap-7">
      {actions.map((a, i) => {
        const G = GLYPHES[a.icon] ?? IconPlus;
        return (
          <Link
            key={a.href}
            href={a.href}
            className="group flex min-w-0 flex-col items-center gap-2 text-center sm:w-[108px]"
          >
            <span
              className={`flex size-[58px] items-center justify-center rounded-full text-ink transition-[transform,background-color] duration-200 group-hover:scale-[1.06] group-active:scale-95 ${
                i === 0 ? "bg-cta group-hover:bg-lime-hover" : "bg-tile group-hover:bg-hairline-strong"
              }`}
            >
              <G width={24} height={24} />
            </span>
            <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-ink">{a.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

/** Lien « Où va mon argent » s'il figure dans la navigation du rôle, sinon null. */
export function transparenceDansNav(ctx: AppContext): string | null {
  const href = `/${ctx.locale}/rapports/transparence`;
  const nav = buildNav(ctx.role, ctx.dict, ctx.locale);
  return nav.some((s) => s.items.some((i) => i.href === href)) ? href : null;
}

/** Section de l'accueil : grand titre gras, lien souligné « Tout voir » à l'extrémité. */
export function Section({
  title,
  subtitle,
  href,
  linkLabel,
  className = "",
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  href?: string;
  linkLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`min-w-0 ${className}`}>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        action={
          href && linkLabel ? (
            <Link href={href} className="link text-[14px]">
              {linkLabel}
            </Link>
          ) : undefined
        }
        className="mb-3"
      />
      {children}
    </section>
  );
}

/** Liste à plat (transactions Wise) : lignes arrondies, voile au survol. */
export function FlatList({ children }: { children: ReactNode }) {
  return <ul className="-mx-3 space-y-0.5">{children}</ul>;
}

/** Ligne Wise : pastille ronde, titre gras, sous-titre gris, valeur/badge, chevron vert. */
export function Row({
  href,
  icon,
  title,
  subtitle,
  trailing,
  strong = true,
}: {
  href?: string;
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  /** Titre en gras (non lu, élément actif) — sinon medium. */
  strong?: boolean;
}) {
  const body = (
    <>
      {icon}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[15px] text-ink ${strong ? "font-bold" : "font-medium"}`}>{title}</p>
        {subtitle ? <p className="mt-0.5 truncate text-[13px] text-soft">{subtitle}</p> : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2 text-end">{trailing}</div> : null}
      {href ? <IconChevronEnd width={18} height={18} className="shrink-0 text-link" /> : null}
    </>
  );
  const cls = "flex items-center gap-3.5 rounded-[20px] px-3 py-2.5";
  return (
    <li>
      {href ? (
        <Link href={href} className={`${cls} transition-colors hover:bg-wash`}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}

/** Pastille d'icône des lignes (46 px). */
export function RowIcon({ tone, children }: { tone: IconTone; children: ReactNode }) {
  return (
    <IconCircle tone={tone} size={46}>
      {children}
    </IconCircle>
  );
}

/** Section vide compacte : pastille voilée et ligne grise — jamais une tuile de texte. */
export function EmptyLine({ text, icon, action }: { text: ReactNode; icon: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 py-2">
      <span className="flex size-[46px] shrink-0 items-center justify-center rounded-full bg-wash text-soft">{icon}</span>
      <p className="min-w-0 flex-1 text-[14px] text-soft">{text}</p>
      {action}
    </div>
  );
}

/** Échéance relative d'une AG (« dans 3 jours ») — chaîne ou null. */
export function echeanceTexte(iso: string, dict: Dict): string | null {
  const jours = joursRestants(iso);
  return jours === 0
    ? dict.ag.aujourdhui
    : jours === 1
      ? dict.ag.demain
      : jours > 1
        ? fill(dict.ag.dansJours, { n: jours })
        : null;
}

/** Prochaine AG en carte-affiche (salle verte, date en capitales lime). */
export function AgPoster({
  ag,
  dict,
  locale,
  href,
  ctaLabel,
  actions,
}: {
  ag: AssembleeGenerale;
  dict: Dict;
  locale: Locale;
  href?: string;
  ctaLabel?: string;
  /** Actions propres (résident) — rendues sous l'accroche, la carte n'est alors pas un lien. */
  actions?: ReactNode;
}) {
  const rel = echeanceTexte(ag.dateAg, dict);
  const nbResolutions = ag.resolutions?.length ?? 0;
  const accroche = [
    formatHeure(ag.dateAg, locale),
    dict.enums.statutAg[ag.statut],
    nbResolutions > 0 ? `${nbResolutions} ${dict.ag.resolutions.toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <PosterCard
      kicker={`${dict.enums.typeAg[ag.type]}${rel ? ` · ${rel}` : ""}`}
      title={formatDate(ag.dateAg, locale)}
      body={
        <>
          <p>{accroche}</p>
          {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
        </>
      }
      href={href}
      ctaLabel={ctaLabel}
      poster="poster-ag"
    />
  );
}

/** Checklist de démarrage (Wise « Finish setting up ») : tuile greige, jauge, puis les étapes
 *  restantes en sous-lignes BLANCHES (jamais greige sur greige). */
export function ChecklistTile({
  checklist,
  dict,
  locale,
}: {
  checklist: OnboardingChecklist;
  dict: Dict;
  locale: Locale;
}) {
  const t = dict.importation;
  const restantes = checklist.etapes.filter((e) => !e.fait);
  return (
    <div className="card overflow-hidden">
      {/* Bandeau d'affiche (fond encre) en tête de tuile : l'affiche entière, calée à l'extrémité
          (sa moitié vide se fond dans l'encre), miroitée en arabe. */}
      <div aria-hidden className="relative h-[120px] overflow-hidden bg-ink sm:h-[140px]">
        <PosterArt name="poster-onboarding" ratio className="absolute end-0 top-1/2 h-[118%] -translate-y-1/2" />
      </div>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[19px] font-bold tracking-tight text-ink">{t.onboarding}</h2>
            <p className="mt-1 text-[14px] text-soft">{t.onboardingAide}</p>
          </div>
          <Badge variant="info" className="shrink-0">
            {fill(t.progressionOnboarding, { faites: checklist.faites, total: checklist.total })}
          </Badge>
        </div>
        <ProgressBar ratio={checklist.progression / 100} className="mt-4" />
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {restantes.map((e) => (
            <li key={e.cle}>
              <Link
                href={`/${locale}${e.lien}`}
                className="group flex items-center gap-3 rounded-[16px] bg-surface px-4 py-3 transition-colors hover:bg-action-wash"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-link text-link">
                  <IconCheck width={12} height={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-ink">{t.etapesOnboarding[e.cle]}</span>
                  {e.detail ? (
                    <span className="block text-[12px] text-soft" dir="auto">
                      {e.detail}
                    </span>
                  ) : null}
                </span>
                <IconChevronEnd width={16} height={16} className="shrink-0 text-link" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
