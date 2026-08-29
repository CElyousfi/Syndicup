import { notFound } from "next/navigation";
import { getAppContext, exigerRole } from "../../../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../../../lib/api/client";
import { annuaireMembres } from "../../../../../../../../lib/membres";
import type {
  AgVote,
  AssembleeGenerale,
  Lot,
} from "../../../../../../../../lib/api/types";
import { formatDateHeure, formatEntier } from "../../../../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../../../../components/page-header";
import { Badge } from "../../../../../../../../components/ui/badge";
import { Banner } from "../../../../../../../../components/ui/banner";
import { EmptyState } from "../../../../../../../../components/ui/empty-state";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../../../../components/ui/table";
import { Avatar } from "../../../../../../../../components/ui/avatar";

/** E6 — détail nominatif (SYNDIC uniquement, étiqueté « audit »). */
export default async function VotesNominatifsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string; rid: string }>;
}) {
  const { locale, id, rid } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN"]);
  const { dict } = ctx;
  const a = dict.ag;

  const [agRes, votesRes, lotsRes, membres] = await Promise.all([
    apiFetch<AssembleeGenerale>(`/ag/${id}`),
    apiFetch<AgVote[]>(`/ag/${id}/resolutions/${rid}/votes`),
    apiFetch<Lot[]>("/lots", { searchParams: { limit: 100 } }),
    annuaireMembres(),
  ]);
  if (!agRes.ok || !votesRes.ok) notFound();

  const resolution = (agRes.data.resolutions ?? []).find((r) => r.id === rid);
  const lotParId = new Map((lotsRes.ok ? lotsRes.data : []).map((l) => [l.id, l.numero]));
  const membreParId = new Map(membres.map((m) => [m.id, m.nom]));

  const variantVote = { POUR: "ok", CONTRE: "danger", ABSTENTION: "ink" } as const;

  return (
    <div className="animate-fade">
      <PageHeader
        back={<BackLink href={`/${locale}/ag/${id}`} label={dict.nav.ag} />}
        title={a.detailVotes}
        subtitle={resolution ? `${resolution.ordre}. ${resolution.texte}` : undefined}
      />

      <Banner variant="legal" className="mb-5">
        {a.detailVotesBandeau}
      </Banner>

      {votesRes.data.length === 0 ? (
        <EmptyState title={dict.common.emptyDefault} />
      ) : (
        <TableCard>
          <Table>
            <THead>
              <TH>{dict.lots.utilisateur}</TH>
              <TH>{dict.invitations.lot}</TH>
              <TH>{a.voter}</TH>
              <TH align="end">{a.tantiemes}</TH>
              <TH>{dict.documents.date}</TH>
            </THead>
            <tbody>
              {votesRes.data.map((v) => {
                const nom = membreParId.get(v.utilisateurId);
                return (
                <TR key={v.id}>
                  <TD className="font-medium text-ink">
                    <span className="flex items-center gap-2.5">
                      {nom ? <Avatar nom={nom} size={28} /> : null}
                      {nom ?? (
                        <span className="font-mono text-[12px] text-soft" dir="ltr">
                          {v.utilisateurId.slice(0, 8)}…
                        </span>
                      )}
                    </span>
                  </TD>
                  <TD className="text-body">{lotParId.get(v.lotId) ?? "—"}</TD>
                  <TD>
                    <Badge variant={variantVote[v.valeur]}>
                      {dict.enums.valeurVote[v.valeur]}
                    </Badge>
                  </TD>
                  <TD align="end" className="tnum text-body">
                    {formatEntier(v.tantiemesRepresentes)}
                  </TD>
                  <TD className="text-[13px] text-soft">
                    {formatDateHeure(v.horodatage, ctx.locale)}
                  </TD>
                </TR>
                );
              })}
            </tbody>
          </Table>
        </TableCard>
      )}
    </div>
  );
}
