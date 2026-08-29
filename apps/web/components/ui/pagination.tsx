import Link from "next/link";
import type { ApiMeta } from "../../lib/api/types";
import type { Dict } from "../../lib/i18n";
import { fill } from "../../lib/i18n";

/** Pagination serveur — état dans l'URL (?page=). Rendue seulement si nécessaire. */
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
    "inline-flex h-9 items-center rounded-btn border border-hairline-strong bg-surface px-3.5 text-[13px] font-medium text-ink-strong transition-colors hover:bg-hover";
  const disabledCls = "pointer-events-none opacity-40";

  return (
    <div className="flex items-center justify-between gap-4 pt-1">
      <p className="text-[13px] text-soft">
        {fill(dict.common.page, { page })}
        {typeof meta.total === "number" ? (
          <span className="text-faint">
            {" · "}
            {fill(meta.total === 1 ? dict.common.result : dict.common.results, { count: meta.total })}
          </span>
        ) : null}
      </p>
      <div className="flex gap-2">
        <Link href={href(page - 1)} className={`${linkCls} ${page <= 1 ? disabledCls : ""}`}>
          {dict.common.previous}
        </Link>
        <Link href={href(page + 1)} className={`${linkCls} ${!hasMore ? disabledCls : ""}`}>
          {dict.common.next}
        </Link>
      </div>
    </div>
  );
}
