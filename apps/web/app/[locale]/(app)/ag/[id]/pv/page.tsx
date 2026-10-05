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
import { IconCircle } from "../../../../../../components/ui/color-icons";

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
      <div className="page-root">
        <PageHeader
          back={<BackLink href={`/${locale}/ag/${id}`} label={dict.nav.ag} />}
          title={a.pvTitre}
        />
        <EmptyState title={a.pvIndisponible} illustration="empty-documents" />
      </div>
    );
  }

  const pv = pvRes.data;
  const contenu = pv.contenuJson;

  return (
    <div className="page-root">
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

      <div className="card mx-auto max-w-3xl p-6 print:bg-transparent print:p-0 sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-b border-wash-strong pb-7">
          <Brand />
          <div className="sm:text-end">
            <p className="text-[22px] font-bold tracking-tight text-ink">{a.pv}</p>
            <p className="tnum mt-1 text-[14px] text-soft">
              {dict.enums.typeAg[contenu.type]} ·{" "}
              {formatDateHeure(contenu.date_ag, ctx.locale)}
            </p>
          </div>
        </div>

        {/* Quorum */}
        {contenu.quorum_requis || contenu.quorum_atteint ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {contenu.quorum_requis ? (
              <div className="rounded-2xl bg-surface px-4 py-3.5">
                <p className="text-[13px] text-soft">{a.quorum}</p>
                <p className="tnum mt-0.5 text-[24px] font-bold leading-tight text-ink">{formatPourcent(contenu.quorum_requis)}</p>
              </div>
            ) : null}
            {contenu.quorum_atteint ? (
              <div className="rounded-2xl bg-surface px-4 py-3.5">
                <p className="text-[13px] text-soft">{dict.enums.statutAg.CLOTUREE}</p>
                <p className="tnum mt-0.5 text-[24px] font-bold leading-tight text-ink">{formatPourcent(contenu.quorum_atteint)}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Résolutions */}
        <ol className="mt-8 space-y-5">
          {contenu.resolutions.map((r) => (
            <li key={r.id} className="flex items-start gap-4">
              <span className="tnum flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-[15px] font-bold text-ink">
                {r.ordre}
              </span>
              <div className="min-w-0 flex-1">
                <p className="pt-1 text-[15px] font-semibold leading-relaxed text-ink">{r.texte}</p>
                <p className="mt-1 text-[13px] text-soft">
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
        <div className="mt-9 rounded-[20px] bg-surface p-5 print:border print:border-hairline-strong">
          <div className="flex items-center gap-2.5">
            <IconCircle tone="ok" size={36}>
              <IconShield width={18} height={18} className="text-ok" />
            </IconCircle>
            <p className="text-[15px] font-bold text-ink">{a.pvHash}</p>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-soft">{a.pvHashAide}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code
              className="min-w-0 flex-1 break-all rounded-xl bg-wash px-3 py-2.5 font-mono text-[11px] text-body"
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

        <p className="tnum mt-6 text-[12px] text-soft">
          {formatDateHeure(pv.horodatageGeneration, ctx.locale)}
        </p>
      </div>

    </div>
  );
}
