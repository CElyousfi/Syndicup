"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { IconGlobe } from "./ui/icons";

/** Bascule FR ⇄ AR — même page, segment de locale échangé. */
export function LocaleSwitch({ locale, subtle = false }: { locale: "fr" | "ar"; subtle?: boolean }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const other = locale === "fr" ? "ar" : "fr";
  const rest = pathname.replace(/^\/(fr|ar)/, "");
  const qs = search.toString();
  const href = `/${other}${rest}${qs ? `?${qs}` : ""}`;

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-btn font-semibold transition-colors ${
        subtle
          ? "h-9 px-3 text-[13px] text-soft hover:bg-wash hover:text-ink"
          : "h-10 bg-tile px-4 text-[14px] text-ink hover:bg-hairline-strong"
      }`}
    >
      {/* Pill Wise : greige plate, globe vert marque. */}
      <IconGlobe width={17} height={17} className={subtle ? "" : "text-link"} />
      <span lang={other} dir={other === "ar" ? "rtl" : "ltr"}>
        {other === "ar" ? "العربية" : "Français"}
      </span>
    </Link>
  );
}
