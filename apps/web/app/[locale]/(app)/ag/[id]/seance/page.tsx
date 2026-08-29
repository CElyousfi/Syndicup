import { redirect, notFound } from "next/navigation";
import { getAppContext } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import { annuaireMembres } from "../../../../../../lib/membres";
import { getLots } from "../../../../../../lib/finances-data";
import type { AgProcuration, AssembleeGenerale } from "../../../../../../lib/api/types";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { Badge } from "../../../../../../components/ui/badge";
import { CVote, IconCircle } from "../../../../../../components/ui/color-icons";
import { agVariant } from "../../../../../../lib/status";
import { Pupitre } from "./pupitre";
import { VueVotant } from "./vue-votant";

export default async function SeancePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const votant = ["PROPRIETAIRE", "INDIVISAIRE"].some((r) => ctx.roles.includes(r as never));

  const agRes = await apiFetch<AssembleeGenerale>(`/ag/${id}`);
  if (!agRes.ok) notFound();
  const ag = agRes.data;
  if (ag.statut !== "EN_COURS") redirect(`/${locale}/ag/${id}`);
  if (!gestion && !votant) redirect(`/${locale}/ag/${id}`);

  const [procsRes, lotsRes, membres] = await Promise.all([
    apiFetch<AgProcuration[]>(`/ag/${id}/procurations`),
    getLots(),
    annuaireMembres(),
  ]);
  const lots = lotsRes;
  const membreParId = new Map(membres.map((m) => [m.id, m.nom]));
  const lotParId = new Map(lots.map((l) => [l.id, l.numero]));

  const mesLots = lots.filter((l) =>
    (l.proprietaires ?? []).some(
      (p) =>
        !p.dateFin &&
        p.utilisateurId === ctx.profil.id &&
        // En indivision, seul le représentant vote (Doc A §2.4) — reflété dans l'UI,
        // l'API re-vérifie de toute façon.
        (p.typePropriete !== "INDIVISION" || p.estRepresentantIndivision)
    )
  );
  const mesProcurations = (procsRes.ok ? procsRes.data : [])
    .filter((p) => !p.revoqueeLe && p.mandataireId === ctx.profil.id)
    .map((p) => ({
      id: p.id,
      lotNumero: lotParId.get(p.lotId) ?? "—",
      mandantNom: membreParId.get(p.mandantId) ?? dict.ag.mandant,
    }));

  return (
    <div className="animate-fade">
      <PageHeader
        back={<BackLink href={`/${locale}/ag/${id}`} label={dict.nav.ag} />}
        title={
          <span className="flex items-center gap-3">
            <IconCircle tone="lilac" size={44}>
              <CVote />
            </IconCircle>
            {gestion ? dict.ag.pupitre : dict.ag.seance}
          </span>
        }
        badge={
          <Badge variant={agVariant.EN_COURS} pulse>
            {dict.enums.statutAg.EN_COURS}
          </Badge>
        }
        subtitle={dict.enums.typeAg[ag.type]}
      />
      {gestion ? (
        <Pupitre
          dict={dict}
          locale={ctx.locale}
          agId={id}
          resolutions={ag.resolutions ?? []}
        />
      ) : (
        <VueVotant
          dict={dict}
          locale={ctx.locale}
          agId={id}
          resolutions={ag.resolutions ?? []}
          mesLots={mesLots.map((l) => ({ id: l.id, numero: l.numero }))}
          procurations={mesProcurations}
        />
      )}
    </div>
  );
}
