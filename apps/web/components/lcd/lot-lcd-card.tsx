import Link from "next/link";
import { apiFetch } from "../../lib/api/client";
import type { LcdSynthese } from "../../lib/api/types";
import { fill, type Dict, type Locale } from "../../lib/i18n";
import { declarationLcdVariant, regimeLcdVariant } from "../../lib/status";
import { Badge } from "../ui/badge";
import { Card, SectionHeader } from "../ui/card";
import { CCalendar, CWrench, CKey, IconCircle } from "../ui/color-icons";
import { SejourListe } from "./sejour-list";

/**
 * Fiche lot — bloc « Location courte durée » (M15). Ne s'affiche que si l'API répond 200 :
 * un propriétaire d'un autre lot reçoit 403/404 → rien (jamais un état d'erreur).
 */
export async function LotLcdCard({
  lotId,
  dict,
  locale,
}: {
  lotId: string;
  dict: Dict;
  locale: Locale;
}) {
  const res = await apiFetch<LcdSynthese>(`/lcd/lots/${lotId}/synthese`);
  if (!res.ok) return null;
  const s = res.data;
  const l = dict.lcd;
  const p = (path: string) => `/${locale}${path}`;

  return (
    <Card>
      <SectionHeader
        title={l.syntheseLot}
        subtitle={l.regimeAide}
        action={
          <Link
            href={p("/location-courte-duree")}
            className="link text-[14px]"
          >
            {l.ouvrirModule}
          </Link>
        }
      />
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl bg-surface p-4">
          <IconCircle tone={s.regimeLcd === "INTERDITE" ? "danger" : "sage"} size={44}>
            <CKey width={20} height={20} />
          </IconCircle>
          <div className="min-w-0">
            <p className="text-[13px] text-soft">{l.regime}</p>
            <Badge variant={regimeLcdVariant[s.regimeLcd]} className="mt-1">
              {dict.enums.regimeLcd[s.regimeLcd]}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-surface p-4">
          <IconCircle tone={s.declaration?.statut === "VALIDEE" ? "ok" : "sand"} size={44}>
            <CCalendar width={20} height={20} />
          </IconCircle>
          <div className="min-w-0">
            <p className="text-[13px] text-soft">{l.declaration}</p>
            {s.declaration ? (
              <Link href={p(`/location-courte-duree/declarations/${s.declaration.id}`)} className="mt-1 inline-block">
                <Badge variant={declarationLcdVariant[s.declaration.statut]}>
                  {dict.enums.statutDeclarationLcd[s.declaration.statut]}
                </Badge>
              </Link>
            ) : (
              <p className="mt-1 text-[13px] text-soft">{l.aucuneDeclarationLot}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-surface p-4">
          <IconCircle tone={s.incidentsLies > 0 ? "warn" : "tosca"} size={44}>
            <CWrench width={20} height={20} />
          </IconCircle>
          <div className="min-w-0">
            <p className="text-[13px] text-soft">
              {fill(l.nuitsUtilisees, { annee: s.annee })}
            </p>
            <p className="tnum mt-1 text-[15px] font-bold text-ink">
              {s.nuitsQuota !== null
                ? fill(l.nuitsSurQuota, { utilisees: s.nuitsUtilisees, quota: s.nuitsQuota })
                : `${s.nuitsUtilisees} · ${l.sansQuota}`}
            </p>
            <p className="tnum text-[13px] text-soft">
              {l.incidentsLies} : {s.incidentsLies}
            </p>
          </div>
        </div>
      </div>
      {s.derniersSejours.length > 0 ? (
        <div className="mt-5">
          <p className="mb-2 text-[13px] font-semibold text-soft">{l.derniersSejours}</p>
          <SejourListe sejours={s.derniersSejours.slice(0, 5)} dict={dict} locale={locale} />
        </div>
      ) : null}
    </Card>
  );
}
