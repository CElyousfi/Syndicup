/**
 * Parcours guidé de la comptabilité — pour un syndic qui découvre l'outil : les trois gestes
 * qui alimentent tout le reste (budget → appel → paiements), avec l'état réel de chacun et le
 * bouton qui mène directement à la bonne page. Disparaît de lui-même quand tout est en place.
 */
import type { Dict } from "../../lib/i18n";
import { Card, SectionHeader } from "../ui/card";
import { ButtonLink } from "../ui/button";
import { Badge } from "../ui/badge";
import { IconCircle, CChart, CCoins, CMoneyBag } from "../ui/color-icons";

export type EtatEtape = "fait" | "en_cours" | "a_faire";

export interface EtapeParcours {
  cle: "budget" | "appel" | "paiement";
  etat: EtatEtape;
  href: string;
}

const ICONES = {
  budget: { tone: "lilac" as const, Glyph: CChart },
  appel: { tone: "sand" as const, Glyph: CCoins },
  paiement: { tone: "sage" as const, Glyph: CMoneyBag },
};

export function ParcoursCompta({ dict, etapes }: { dict: Dict; etapes: EtapeParcours[] }) {
  const c = dict.comptabilite;
  const libelles = {
    budget: { titre: c.etapeBudget, aide: c.etapeBudgetAide, cta: c.ouvrirBudgets },
    appel: { titre: c.etapeAppel, aide: c.etapeAppelAide, cta: c.ouvrirAppels },
    paiement: { titre: c.etapePaiement, aide: c.etapePaiementAide, cta: c.enregistrerPaiement },
  };
  const etatBadge: Record<EtatEtape, { variant: "ok" | "warn" | "outline"; label: string }> = {
    fait: { variant: "ok", label: c.etapeFait },
    en_cours: { variant: "warn", label: c.etapeEnCours },
    a_faire: { variant: "outline", label: c.etapeAFaire },
  };
  // La prochaine étape à faire est la seule mise en avant (bouton plein) — un seul geste à la fois.
  const prochaine = etapes.find((e) => e.etat !== "fait")?.cle;

  return (
    <Card>
      <SectionHeader title={c.parcoursTitre} subtitle={c.parcoursSous} />
      <ol className="mt-5 grid gap-3 md:grid-cols-3">
        {etapes.map((e, i) => {
          const { tone, Glyph } = ICONES[e.cle];
          const l = libelles[e.cle];
          const badge = etatBadge[e.etat];
          const active = e.cle === prochaine;
          return (
            <li
              key={e.cle}
              className={`flex flex-col gap-3 rounded-[20px] bg-surface p-4 transition-colors ${
                active ? "ring-2 ring-inset ring-link" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <IconCircle tone={tone} size={44}>
                    <Glyph width={22} height={22} />
                  </IconCircle>
                  <span className="tnum text-[13px] font-semibold text-soft">
                    {i + 1}/3
                  </span>
                </div>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </div>
              <div className="min-w-0">
                <p className="text-[16px] font-bold text-ink">{l.titre}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-soft">{l.aide}</p>
              </div>
              <div className="mt-auto pt-1">
                <ButtonLink href={e.href} variant={active ? "primary" : "secondary"} size="sm" className="w-full sm:w-auto">
                  {l.cta}
                </ButtonLink>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/** Encart pédagogique côté résident : trois phrases, pas un manuel. */
export function AideReleveResident({ dict }: { dict: Dict }) {
  const c = dict.comptabilite;
  return (
    <Card>
      <SectionHeader title={c.residentAideTitre} />
      <ol className="mt-4 space-y-3 text-[14px] leading-relaxed text-body">
        {[c.residentAide1, c.residentAide2, c.residentAide3].map((t, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-px inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-bold text-lime">
              {i + 1}
            </span>
            <span>{t}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
