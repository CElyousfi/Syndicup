/**
 * Parcours guidé de la comptabilité — pour un syndic qui découvre l'outil : les trois gestes
 * qui alimentent tout le reste (budget → appel → paiements), avec l'état réel de chacun et le
 * bouton qui mène directement à la bonne page. Disparaît de lui-même quand tout est en place.
 */
import type { Dict } from "../../lib/i18n";
import { Card } from "../ui/card";
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
    <Card className="border-action/20 bg-gradient-to-br from-surface to-sage-tint/60">
      <div className="flex flex-col gap-1">
        <h2 className="text-[17px] font-semibold text-ink">{c.parcoursTitre}</h2>
        <p className="text-[13px] text-soft">{c.parcoursSous}</p>
      </div>
      <ol className="mt-5 grid gap-3 md:grid-cols-3">
        {etapes.map((e, i) => {
          const { tone, Glyph } = ICONES[e.cle];
          const l = libelles[e.cle];
          const badge = etatBadge[e.etat];
          const active = e.cle === prochaine;
          return (
            <li
              key={e.cle}
              className={`flex flex-col gap-3 rounded-[18px] border p-4 transition-colors ${
                active ? "border-action/40 bg-surface shadow-[0_6px_18px_rgb(32_31_35/0.06)]" : "border-hairline bg-surface/70"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <IconCircle tone={tone} size={40}>
                    <Glyph width={20} height={20} />
                  </IconCircle>
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-faint">
                    {i + 1}/3
                  </span>
                </div>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-ink">{l.titre}</p>
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
    <Card className="bg-sage-tint/50">
      <h2 className="text-[15px] font-semibold text-ink">{c.residentAideTitre}</h2>
      <ol className="mt-3 space-y-2 text-[13px] leading-relaxed text-body">
        {[c.residentAide1, c.residentAide2, c.residentAide3].map((t, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-action text-[11px] font-bold text-white">
              {i + 1}
            </span>
            <span>{t}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
