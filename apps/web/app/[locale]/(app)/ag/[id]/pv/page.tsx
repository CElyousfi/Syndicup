import { getAppContext } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type { AgPv } from "../../../../../../lib/api/types";
import { formatDateHeure, formatPourcent } from "../../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { FileViewerButton } from "../../../../../../components/documents/document-viewer";
import { Badge } from "../../../../../../components/ui/badge";
import { Brand } from "../../../../../../components/brand";
import { EmptyState } from "../../../../../../components/ui/empty-state";
import { CopyButton } from "../../../../../../components/ui/copy";
import { resolutionVariant } from "../../../../../../lib/status";
import { IconShield } from "../../../../../../components/ui/icons";

/** E7 — procès-verbal : document légal, hash d'intégrité mis en avant (confiance). */
export default async function PvPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const a = dict.ag;

  const pvRes = await apiFetch<AgPv>(`/ag/${id}/pv`);

  if (!pvRes.ok) {
    return (
      <div className="animate-fade">
        <PageHeader
          back={<BackLink href={`/${locale}/ag/${id}`} label={dict.nav.ag} />}
          title={a.pvTitre}
        />
        <EmptyState title={a.pvIndisponible} />
      </div>
    );
  }

  const pv = pvRes.data;
  const contenu = pv.contenuJson;

  return (
    <div className="animate-fade">
      <PageHeader
        back={<BackLink href={`/${locale}/ag/${id}`} label={dict.nav.ag} />}
        title={a.pvTitre}
        actions={
          <FileViewerButton
            src={`/api/pv-pdf?ag=${id}`}
            nom={a.pvTitre}
            label={a.pvTelecharger}
            size="md"
            variant="primary"
            tour="pv-pdf"
            labels={{ see: dict.common.see, close: dict.common.close, download: dict.common.download }}
          />
        }
      />

      <div className="card mx-auto max-w-3xl p-6 sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-b border-hairline pb-7">
          <Brand />
          <div className="sm:text-end">
            <p className="text-[17px] font-semibold text-ink">{a.pv}</p>
            <p className="mt-0.5 text-[13px] text-soft">
              {dict.enums.typeAg[contenu.type]} ·{" "}
              {formatDateHeure(contenu.date_ag, ctx.locale)}
            </p>
          </div>
        </div>

        {/* Quorum */}
        {contenu.quorum_requis || contenu.quorum_atteint ? (
          <div className="mt-6 flex flex-wrap gap-6 text-sm">
            {contenu.quorum_requis ? (
              <p className="text-body">
                {a.quorum} : <span className="tnum font-medium text-ink">{formatPourcent(contenu.quorum_requis)}</span>
              </p>
            ) : null}
            {contenu.quorum_atteint ? (
              <p className="text-body">
                {dict.enums.statutAg.CLOTUREE} :{" "}
                <span className="tnum font-medium text-ink">{formatPourcent(contenu.quorum_atteint)}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Résolutions */}
        <ol className="mt-7 space-y-5">
          {contenu.resolutions.map((r) => (
            <li key={r.id} className="flex items-start gap-4">
              <span className="tnum flex size-7 shrink-0 items-center justify-center rounded-full bg-ground text-[13px] font-semibold text-body">
                {r.ordre}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-ink">{r.texte}</p>
                <p className="mt-1 text-[12px] text-soft">
                  {dict.enums.typeMajorite[r.type_majorite]}
                </p>
              </div>
              <Badge variant={resolutionVariant[r.resultat]}>
                {dict.enums.resultatResolution[r.resultat]}
              </Badge>
            </li>
          ))}
        </ol>

        {/* Empreinte d'intégrité */}
        <div className="mt-9 rounded-2xl border border-hairline bg-ground p-5">
          <div className="flex items-center gap-2.5">
            <IconShield width={18} height={18} className="text-ok" />
            <p className="text-[13px] font-semibold text-ink">{a.pvHash}</p>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-soft">{a.pvHashAide}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code
              className="min-w-0 flex-1 break-all rounded-lg bg-surface px-3 py-2 font-mono text-[11px] text-body"
              dir="ltr"
            >
              {pv.hashIntegrite}
            </code>
            <CopyButton
              value={pv.hashIntegrite}
              label={dict.common.copy}
              copiedLabel={dict.common.copied}
            />
          </div>
        </div>

        <p className="mt-6 text-[12px] text-faint">
          {formatDateHeure(pv.horodatageGeneration, ctx.locale)}
        </p>
      </div>

    </div>
  );
}
