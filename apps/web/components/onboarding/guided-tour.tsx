"use client";

/**
 * Visite guidée du premier lancement — parcours INTERACTIF à travers l'application :
 * chaque étape met en lumière un élément réel de l'interface (projecteur + carte
 * explicative), navigue de page en page (tableau de bord → appels de fonds →
 * incidents → documents) et montre où cliquer.
 *
 *  - S'affiche UNE SEULE FOIS (drapeau localStorage), puis plus jamais.
 *  - Rôles : une étape dont la cible n'existe pas pour le rôle courant est sautée
 *    automatiquement (la navigation est construite par rôle).
 *  - Mobile : le tiroir de navigation s'ouvre tout seul pour les étapes du menu,
 *    et la carte se pose en bas de l'écran ; sur bureau elle flotte près de la cible.
 *  - FR/AR : textes du dictionnaire, RTL automatique (positionnement en
 *    coordonnées mesurées, indépendant de la direction).
 *
 * Les cibles sont marquées par des attributs `data-tour="…"` posés dans l'interface.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BrandMark } from "../brand";
import { Button } from "../ui/button";
import { fill } from "../../lib/i18n";

const CLE_STOCKAGE = "syndicup:onboarding:v2";

export interface TourLabels {
  skip: string;
  next: string;
  back: string;
  start: string;
  finish: string;
  stepOf: string;
  welcomeTitle: string;
  welcomeBody: string;
  navDashTitle: string;
  navDashBody: string;
  statsTitle: string;
  statsBody: string;
  navFinancesTitle: string;
  navFinancesBody: string;
  appelsPageTitle: string;
  appelsPageBody: string;
  navAgTitle: string;
  navAgBody: string;
  navIncidentsTitle: string;
  navIncidentsBody: string;
  incidentsPageTitle: string;
  incidentsPageBody: string;
  navDocsTitle: string;
  navDocsBody: string;
  docViewTitle: string;
  docViewBody: string;
  searchTitle: string;
  searchBody: string;
  bellTitle: string;
  bellBody: string;
  doneTitle: string;
  doneBody: string;
  clickHint: string;
  adminNavTitle: string;
  adminNavBody: string;
  adminNewTitle: string;
  adminNewBody: string;
}

interface Etape {
  /** Valeur de data-tour à viser ; absente → carte centrée (accueil / fin). */
  cible?: string;
  /** Chemin (relatif à la locale) à atteindre avant de montrer l'étape. */
  route?: string;
  /** data-tour qui doit EXISTER dans le DOM (visible ou non) — filtre par rôle. */
  requiert?: string;
  /** La cible vit dans la barre latérale : sur mobile, ouvrir le tiroir. */
  tiroir?: boolean;
  /**
   * Étape ACTIONNABLE : la cible reste cliquable à travers le projecteur (anneau
   * pulsé + indice « cliquez ») et le clic réel de l'utilisateur fait avancer la
   * visite — il utilise vraiment l'application pendant la visite.
   */
  action?: boolean;
  titre: string;
  corps: string;
}

interface Zone {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function GuidedTour({
  locale,
  labels,
  onDrawer,
}: {
  locale: "fr" | "ar";
  labels: TourLabels;
  onDrawer: (open: boolean) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ouvert, setOuvert] = useState(false);
  const [idx, setIdx] = useState(0);
  const [zone, setZone] = useState<Zone | null>(null);
  const [prete, setPrete] = useState(false);
  const direction = useRef<1 | -1>(1);
  const derniereNav = useRef<string | null>(null);
  const retireClic = useRef<(() => void) | null>(null);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(CLE_STOCKAGE)) setOuvert(true);
    } catch {
      // stockage indisponible : ne jamais bloquer l'app
    }
  }, []);

  const etapes: Etape[] = [
    { titre: labels.welcomeTitle, corps: labels.welcomeBody },
    // Opérateur plateforme (super admin) — ces deux étapes n'existent que pour lui ;
    // pour les autres rôles la cible est absente et l'étape est sautée instantanément.
    { cible: "nav-shield", tiroir: true, action: true, titre: labels.adminNavTitle, corps: labels.adminNavBody },
    { cible: "admin-new", route: "/admin", requiert: "nav-shield", action: true, titre: labels.adminNewTitle, corps: labels.adminNewBody },
    { cible: "nav-grid", tiroir: true, route: "/tableau-de-bord", action: true, titre: labels.navDashTitle, corps: labels.navDashBody },
    { cible: "dash-stats", route: "/tableau-de-bord", titre: labels.statsTitle, corps: labels.statsBody },
    { cible: "nav-coins", tiroir: true, action: true, titre: labels.navFinancesTitle, corps: labels.navFinancesBody },
    { cible: "page-title", route: "/finances/appels-de-fonds", requiert: "nav-coins", titre: labels.appelsPageTitle, corps: labels.appelsPageBody },
    { cible: "nav-vote", tiroir: true, action: true, titre: labels.navAgTitle, corps: labels.navAgBody },
    { cible: "nav-wrench", tiroir: true, action: true, titre: labels.navIncidentsTitle, corps: labels.navIncidentsBody },
    { cible: "page-title", route: "/incidents", requiert: "nav-wrench", titre: labels.incidentsPageTitle, corps: labels.incidentsPageBody },
    { cible: "nav-file", tiroir: true, action: true, titre: labels.navDocsTitle, corps: labels.navDocsBody },
    { cible: "doc-view", route: "/documents", requiert: "nav-file", action: true, titre: labels.docViewTitle, corps: labels.docViewBody },
    { cible: "search", titre: labels.searchTitle, corps: labels.searchBody },
    { cible: "bell", titre: labels.bellTitle, corps: labels.bellBody },
    { titre: labels.doneTitle, corps: labels.doneBody },
  ];
  const etape = etapes[idx]!;
  const derniere = idx === etapes.length - 1;

  const terminer = useCallback(() => {
    try {
      window.localStorage.setItem(CLE_STOCKAGE, new Date().toISOString());
    } catch {
      // sans stockage : fermeture pour la session
    }
    onDrawer(false);
    setOuvert(false);
    router.push(`/${locale}/tableau-de-bord`);
  }, [locale, onDrawer, router]);

  const aller = (dir: 1 | -1) => {
    direction.current = dir;
    setPrete(false);
    setZone(null);
    setIdx((i) => Math.min(etapes.length - 1, Math.max(0, i + dir)));
  };

  /** Élément visible correspondant à la cible (le DOM peut en contenir deux : bureau + tiroir). */
  const trouver = (cible: string): HTMLElement | null => {
    const tous = document.querySelectorAll<HTMLElement>(`[data-tour="${cible}"]`);
    for (const el of tous) if (el.getClientRects().length > 0) return el;
    return null;
  };

  const mesurer = useCallback((el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const marge = 6;
    setZone({
      top: r.top - marge,
      left: r.left - marge,
      width: r.width + marge * 2,
      height: r.height + marge * 2,
    });
  }, []);

  // Résolution d'une étape : filtre par rôle → navigation → tiroir → repérage → mesure.
  useEffect(() => {
    if (!ouvert) return;
    let annule = false;

    (async () => {
      // 1. Filtre par rôle : la cible requise n'existe pas dans la navigation → sauter.
      if (etape.requiert && !document.querySelector(`[data-tour="${etape.requiert}"]`)) {
        if (!annule) aller(direction.current);
        return;
      }

      // 2. Navigation si l'étape vit sur une autre page.
      const cheminVoulu = etape.route ? `/${locale}${etape.route}` : null;
      if (cheminVoulu && pathname !== cheminVoulu) {
        if (derniereNav.current !== `${idx}:${cheminVoulu}`) {
          derniereNav.current = `${idx}:${cheminVoulu}`;
          onDrawer(false);
          router.push(cheminVoulu);
        }
        return; // le changement de pathname relancera cet effet
      }

      // 3. Étape centrée (accueil / fin) : rien à viser.
      if (!etape.cible) {
        onDrawer(false);
        if (!annule) {
          setZone(null);
          setPrete(true);
        }
        return;
      }

      // 4. Tiroir mobile pour les cibles du menu.
      const bureau = window.matchMedia("(min-width: 1024px)").matches;
      if (etape.tiroir && !bureau) {
        onDrawer(true);
        await new Promise((r) => setTimeout(r, 420)); // fin de l'animation du tiroir
      } else if (!etape.tiroir) {
        onDrawer(false);
      }

      // 5. Attendre la cible (rendu asynchrone après navigation), puis mesurer.
      //    Présente dans le DOM mais jamais visible (élément masqué sur ce format
      //    d'écran, ex. recherche sur mobile) → saut rapide.
      let cachee = 0;
      for (let essai = 0; essai < 40 && !annule; essai++) {
        const el = trouver(etape.cible);
        if (el) {
          el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
          await new Promise((r) => setTimeout(r, 120));
          if (annule) return;
          mesurer(el);
          setPrete(true);
          // Étape actionnable : le clic RÉEL de l'utilisateur sur la cible fait
          // avancer la visite (l'action native — navigation, ouverture — s'exécute).
          if (etape.action) {
            const surClic = () => setTimeout(() => aller(1), 120);
            el.addEventListener("click", surClic, { once: true });
            retireClic.current = () => el.removeEventListener("click", surClic);
          }
          return;
        }
        const existe = document.querySelectorAll(`[data-tour="${etape.cible}"]`).length > 0;
        if (existe) {
          // Présente mais jamais visible (masquée sur ce format d'écran) → saut rapide.
          cachee++;
          if (cachee >= 5) break;
        } else if (!etape.route && essai >= 8) {
          // Absente du DOM sans navigation en cours : le rôle courant n'a pas cet
          // écran (la barre latérale est déjà rendue) → saut rapide, pas d'attente.
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      // Introuvable (rôle sans cet écran, page vide…) : sauter dans le sens du parcours.
      if (!annule) aller(direction.current);
    })();

    return () => {
      annule = true;
      retireClic.current?.();
      retireClic.current = null;
    };
  }, [ouvert, idx, pathname]);

  // Échap ferme la visite (le conteneur laisse passer les événements de pointeur).
  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") terminer();
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouvert, terminer]);

  // Suivre redimensionnements et défilement pendant qu'une cible est en lumière.
  useEffect(() => {
    if (!ouvert || !etape.cible || !prete) return;
    const recaler = () => {
      const el = trouver(etape.cible!);
      if (el) mesurer(el);
    };
    window.addEventListener("resize", recaler);
    window.addEventListener("scroll", recaler, true);
    return () => {
      window.removeEventListener("resize", recaler);
      window.removeEventListener("scroll", recaler, true);
    };
  }, [ouvert, idx, prete]);

  if (!ouvert) return null;

  const centree = !etape.cible;

  /* Position de la carte près de la zone (bureau) — dessous si possible, sinon dessus. */
  const LARGEUR_CARTE = 340;
  let carteStyle: React.CSSProperties | undefined;
  if (!centree && zone && typeof window !== "undefined" && window.innerWidth >= 640) {
    const dessous = zone.top + zone.height + 12;
    const hautDispo = zone.top - 12;
    const preferer =
      dessous + 220 < window.innerHeight ? "dessous" : hautDispo > 220 ? "dessus" : "dessous";
    const left = Math.max(
      12,
      Math.min(zone.left + zone.width / 2 - LARGEUR_CARTE / 2, window.innerWidth - LARGEUR_CARTE - 12)
    );
    carteStyle =
      preferer === "dessous"
        ? { top: dessous, left, width: LARGEUR_CARTE }
        : { bottom: window.innerHeight - hautDispo, left, width: LARGEUR_CARTE };
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={etape.titre}
      className="pointer-events-none fixed inset-0 z-[80]"
    >
      {/* Fond : voile complet (étapes centrées) ou projecteur découpé autour de la cible. */}
      {centree || !zone ? (
        <div className="pointer-events-auto absolute inset-0 bg-ink/55 backdrop-blur-[2px] animate-fade" />
      ) : (
        <>
          <div
            aria-hidden
            className="absolute rounded-2xl ring-2 ring-sage transition-all duration-300 ease-out"
            style={{
              top: zone.top,
              left: zone.left,
              width: zone.width,
              height: zone.height,
              boxShadow: "0 0 0 9999px rgb(18 18 18 / 0.55)",
            }}
          >
            {etape.action ? (
              <div className="absolute inset-0 rounded-2xl animate-tour-pulse" />
            ) : null}
          </div>
          {/* Panneaux bloquants autour du trou — la cible reste la SEULE zone cliquable
              (étapes actionnables) ; sinon un couvercle bloque aussi le trou. */}
          <div aria-hidden className="pointer-events-auto absolute inset-x-0 top-0" style={{ height: Math.max(0, zone.top) }} />
          <div aria-hidden className="pointer-events-auto absolute inset-x-0 bottom-0" style={{ top: zone.top + zone.height }} />
          <div aria-hidden className="pointer-events-auto absolute left-0" style={{ top: zone.top, height: zone.height, width: Math.max(0, zone.left) }} />
          <div aria-hidden className="pointer-events-auto absolute right-0" style={{ top: zone.top, height: zone.height, left: zone.left + zone.width }} />
          {!etape.action ? (
            <div
              aria-hidden
              className="pointer-events-auto absolute"
              style={{ top: zone.top, left: zone.left, width: zone.width, height: zone.height }}
            />
          ) : null}
        </>
      )}

      {/* Carte d'étape */}
      {centree ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
          <div className="pointer-events-auto w-full max-w-md rounded-card bg-surface p-6 shadow-pop animate-in-up sm:p-8">
            <div className="flex flex-col items-center text-center">
              <span className="flex size-[72px] items-center justify-center rounded-full bg-ground">
                <BrandMark size={52} />
              </span>
              <h2 className="mt-5 text-xl font-semibold tracking-tight text-ink">{etape.titre}</h2>
              <p className="mt-2.5 text-sm leading-relaxed text-soft">{etape.corps}</p>
            </div>
            <PiedDeCarte
              idx={idx}
              total={etapes.length}
              labels={labels}
              derniere={derniere}
              onBack={() => aller(-1)}
              onNext={() => (derniere ? terminer() : aller(1))}
              onSkip={terminer}
            />
          </div>
        </div>
      ) : !prete ? null : (
        <div
          className="pointer-events-auto absolute inset-x-3 bottom-3 rounded-card bg-surface p-5 shadow-pop animate-in-up sm:inset-auto sm:p-5"
          style={carteStyle}
        >
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">{etape.titre}</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-soft">{etape.corps}</p>
          {etape.action ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sage-tint px-2.5 py-1 text-[12px] font-medium text-action">
              <span className="size-1.5 rounded-full bg-action animate-pulse-dot" aria-hidden />
              {labels.clickHint}
            </p>
          ) : null}
          <PiedDeCarte
            idx={idx}
            total={etapes.length}
            labels={labels}
            derniere={derniere}
            onBack={() => aller(-1)}
            onNext={() => (derniere ? terminer() : aller(1))}
            onSkip={terminer}
            compacte
          />
        </div>
      )}
    </div>
  );
}

function PiedDeCarte({
  idx,
  total,
  labels,
  derniere,
  onBack,
  onNext,
  onSkip,
  compacte = false,
}: {
  idx: number;
  total: number;
  labels: TourLabels;
  derniere: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  compacte?: boolean;
}) {
  return (
    <div className={compacte ? "mt-4" : "mt-6"}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium text-faint">
          {fill(labels.stepOf, { n: idx + 1, total })}
        </p>
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === idx ? "w-4 bg-action" : "w-1 bg-hairline-strong"
              }`}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onSkip}
          className="rounded-full px-2.5 py-1.5 text-[13px] font-medium text-soft transition-colors hover:bg-ground hover:text-ink"
        >
          {labels.skip}
        </button>
        <span className="ms-auto" />
        {idx > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            {labels.back}
          </Button>
        ) : null}
        <Button type="button" variant="primary" size="sm" className="min-w-24" autoFocus onClick={onNext}>
          {idx === 0 ? labels.start : derniere ? labels.finish : labels.next}
        </Button>
      </div>
    </div>
  );
}
