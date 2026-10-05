import Link from "next/link";
import type { ApiMeta } from "../../lib/api/types";
import type { Dict } from "../../lib/i18n";
import { fill } from "../../lib/i18n";
import { IconChevronEnd } from "./icons";

/** Pagination serveur — état dans l'URL (?page=). Rendue seulement si nécessaire.
 *  Wise : pills contour (précédent / suivant), page courante en pastille lime. */
export function Pagination({
  meta,
  basePath,
  searchParams = {},
  dict,
}: {
  meta: ApiMeta;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
  dict: Dict;
}) {
  const page = meta.page ?? 1;
  const hasMore = meta.has_more ?? false;
  if (page <= 1 && !hasMore) return null;

  const href = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (v && k !== "page") params.set(k, v);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const linkCls =
    "su-btn inline-flex h-10 items-center gap-1 rounded-btn border border-hairline-strong bg-surface px-4 text-[13px] font-semibold text-ink-strong transition-colors hover:bg-wash";
  const disabledCls = "pointer-events-none opacity-40";

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pt-2">
      <p className="text-[13px] text-soft">
        {fill(dict.common.page, { page })}
        {typeof meta.total === "number" ? (
          <span className="text-faint">
            {" · "}
            {fill(meta.total === 1 ? dict.common.result : dict.common.results, { count: meta.total })}
          </span>
        ) : null}
      </p>
      <nav className="flex items-center gap-2">
        <Link
          href={href(page - 1)}
          aria-disabled={page <= 1 || undefined}
          className={`${linkCls} ps-3 ${page <= 1 ? disabledCls : ""}`}
        >
          <IconChevronEnd width={16} height={16} className="rotate-180" />
          {dict.common.previous}
        </Link>
        <span
          aria-current="page"
          className="tnum inline-flex size-10 items-center justify-center rounded-full bg-cta text-[14px] font-bold text-ink"
        >
          {page}
        </span>
        <Link
          href={href(page + 1)}
          aria-disabled={!hasMore || undefined}
          className={`${linkCls} pe-3 ${!hasMore ? disabledCls : ""}`}
        >
          {dict.common.next}
          <IconChevronEnd width={16} height={16} />
        </Link>
      </nav>
    </div>
  );
}
