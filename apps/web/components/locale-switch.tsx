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
      className={`inline-flex h-9 items-center gap-2 rounded-btn px-3 text-[13px] font-medium transition-colors ${
        subtle
          ? "text-soft hover:bg-ground hover:text-ink-strong"
          : "border border-hairline-strong bg-surface text-ink-strong hover:bg-hover"
      }`}
    >
      <IconGlobe width={16} height={16} />
      <span lang={other} dir={other === "ar" ? "rtl" : "ltr"}>
        {other === "ar" ? "العربية" : "Français"}
      </span>
    </Link>
  );
}
