/**
 * Carte « Documents » réutilisable (tableaux de bord, pages de synthèse) :
 * les derniers documents visibles du rôle, chacun consultable DANS l'app
 * (aperçu) — pas seulement téléchargeable. Rendue serveur ; masquée s'il
 * n'y a aucun document.
 */
import Link from "next/link";
import type { DocumentCopro } from "../../lib/api/types";
import type { Dict, Locale } from "../../lib/i18n";
import { formatDate } from "../../lib/format";
import { Card, SectionHeader } from "../ui/card";
import { CFile, IconCircle } from "../ui/color-icons";
import { DocumentViewerButton } from "./document-viewer";

export function DocumentsCard({
  documents,
  dict,
  locale,
  limit = 4,
  className = "",
}: {
  documents: DocumentCopro[];
  dict: Dict;
  locale: Locale;
  limit?: number;
  className?: string;
}) {
  if (documents.length === 0) return null;
  const recents = [...documents]
    .sort((a, b) => b.creeLe.localeCompare(a.creeLe))
    .slice(0, limit);

  return (
    <Card padded={false} className={className}>
      <div className="p-6 pb-2">
        <SectionHeader
          title={dict.nav.documents}
          action={
            <Link href={`/${locale}/documents`} className="link text-[14px]">
              {dict.common.seeAll}
            </Link>
          }
        />
      </div>
      <ul className="px-3 pb-4">
        {recents.map((doc) => (
          <li key={doc.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-wash">
            <IconCircle tone="tosca" size={44}>
              <CFile width={20} height={20} />
            </IconCircle>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-ink">{doc.nom}</p>
              <p className="mt-0.5 text-[13px] text-soft">
                {dict.documents.typesConnus[doc.type] ?? doc.type} · {formatDate(doc.creeLe, locale)}
              </p>
            </div>
            <DocumentViewerButton
              documentId={doc.id}
              nom={doc.nom}
              labels={{
                see: dict.common.see,
                close: dict.common.close,
                download: dict.common.download,
              }}
              iconOnly
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
