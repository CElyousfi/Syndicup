import type { Metadata } from "next";
import { getAppContext } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { DocumentCopro } from "../../../../lib/api/types";
import { getDict, isLocale } from "../../../../lib/i18n";
import { formatDate } from "../../../../lib/format";
import { photoSrc } from "../../../../lib/photos";
import { PhotoBanner } from "../../../../components/ui/photo-banner";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { EmptyState } from "../../../../components/ui/empty-state";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../components/ui/table";
import { IconDownload } from "../../../../components/ui/icons";
import { CFile, IconCircle } from "../../../../components/ui/color-icons";
import { DocumentViewerButton } from "../../../../components/documents/document-viewer";
import { DocumentModal } from "./document-modal";
import { telechargerDocument, supprimerDocument } from "./actions";
import { ConfirmDelete } from "../../../../components/ui/confirm-delete";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.documents };
}

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const d = dict.documents;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));

  const res = await apiFetch<DocumentCopro[]>("/documents");
  const documents = res.ok ? res.data : [];

  const visibiliteVariant = {
    PUBLIC_COPROPRIETE: "neutral",
    SYNDIC_ONLY: "ink",
    CONSEIL_SYNDICAL: "info",
  } as const;

  return (
    <div className="animate-fade">
      <PageHeader
        title={d.titre}
        subtitle={d.subtitle}
        actions={gestion ? <DocumentModal dict={dict} locale={ctx.locale} /> : undefined}
      />

      <PhotoBanner src={photoSrc(ctx.copropriete, "cour")} title={ctx.copropriete?.nom} className="mb-4" />

      {documents.length === 0 ? (
        <EmptyState
          title={d.aucunDocument}
          hint={gestion ? d.aucunDocumentAide : undefined}
          action={gestion ? <DocumentModal dict={dict} locale={ctx.locale} /> : undefined}
        />
      ) : (
        <>
          <TableCard>
            <Table>
              <THead>
                <TH>{d.nom}</TH>
                <TH>{d.type}</TH>
                {gestion ? <TH>{d.visibilite}</TH> : null}
                <TH>{d.date}</TH>
                <TH align="end" />
              </THead>
              <tbody>
                {documents.map((doc) => (
                  <TR key={doc.id}>
                    <TD>
                      <span className="inline-flex items-center gap-3 font-medium text-ink">
                        <IconCircle tone="tosca" size={36}>
                          <CFile width={18} height={18} />
                        </IconCircle>
                        <span className="min-w-0 truncate">{doc.nom}</span>
                      </span>
                    </TD>
                    <TD>
                      <Badge variant="outline">{doc.type}</Badge>
                    </TD>
                    {gestion ? (
                      <TD>
                        <Badge variant={visibiliteVariant[doc.visibilite]}>
                          {dict.enums.visibiliteDocument[doc.visibilite]}
                        </Badge>
                      </TD>
                    ) : null}
                    <TD className="text-[13px] text-soft">
                      {formatDate(doc.creeLe, ctx.locale)}
                    </TD>
                    <TD align="end">
                      <span className="inline-flex items-center gap-1.5">
                        <DocumentViewerButton
                          documentId={doc.id}
                          nom={doc.nom}
                          labels={{
                            see: dict.common.see,
                            close: dict.common.close,
                            download: dict.common.download,
                          }}
                        />
                        <form action={telechargerDocument} className="inline">
                          <input type="hidden" name="document_id" value={doc.id} />
                          <button
                            type="submit"
                            formTarget="_blank"
                            title={d.telechargement}
                            className="inline-flex h-8 items-center gap-1.5 rounded-btn px-2.5 text-[13px] font-medium text-action transition-colors hover:bg-action-tint"
                          >
                            <IconDownload width={15} height={15} />
                            {dict.common.download}
                          </button>
                        </form>
                        {gestion && doc.storagePath?.includes("/documents/") ? (
                          <ConfirmDelete
                            dict={dict}
                            locale={ctx.locale}
                            action={supprimerDocument}
                            champs={{ document_id: doc.id }}
                            nom={doc.nom}
                            aide={dict.gestion.documentSupprimerAide}
                            compact
                          />
                        ) : null}
                      </span>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableCard>
          <p className="mt-3 text-[12px] text-faint">{d.telechargement}</p>
        </>
      )}
    </div>
  );
}
