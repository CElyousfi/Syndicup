"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { IconCheck, IconChevronDown, IconGlobe } from "./ui/icons";
import { Pressable } from "./ui/pressable";
import { LANG_FLAGS, LANG_NAMES, LANG_TAGS, LOCALES, dirFor, type Locale } from "../lib/i18n/core";

const SEGMENT = new RegExp(`^/(${LOCALES.join("|")})(?=/|$)`);

/**
 * Sélecteur de langue — même page, segment de locale échangé (le middleware mémorise le choix
 * dans le cookie su_locale). Menu déroulant : vers le bas par défaut, vers le haut en pied de
 * barre latérale (`up`).
 */
export function LocaleSwitch({ locale, subtle = false, up = false }: { locale: Locale; subtle?: boolean; up?: boolean }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const rest = pathname.replace(SEGMENT, "");
  const qs = search.toString();
  const href = (l: Locale) => `/${l}${rest}${qs ? `?${qs}` : ""}`;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <Pressable
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 rounded-btn font-semibold transition-colors ${
          subtle
            ? "h-9 px-3 text-[13px] text-soft hover:bg-wash hover:text-ink"
            : "h-10 bg-tile px-4 text-[14px] text-ink hover:bg-hairline-strong"
        }`}
      >
        {/* Pill Wise : greige plate, globe vert marque. */}
        <IconGlobe width={17} height={17} className={subtle ? "" : "text-link"} />
        <span lang={LANG_TAGS[locale]} dir={dirFor(locale)}>
          {LANG_NAMES[locale]}
        </span>
        <IconChevronDown width={14} height={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </Pressable>
      {open ? (
        <ul
          id={menuId}
          role="menu"
          className={`absolute end-0 z-50 max-h-[70vh] w-56 overflow-y-auto rounded-[16px] border border-hairline bg-surface p-1.5 shadow-lg ${
            up ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {LOCALES.map((l) => (
            <li key={l} role="none">
              <Link
                role="menuitem"
                href={href(l)}
                hrefLang={LANG_TAGS[l]}
                aria-current={l === locale ? "true" : undefined}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-[12px] px-3 py-2 text-[14px] transition-colors hover:bg-wash ${
                  l === locale ? "font-semibold text-ink" : "text-soft hover:text-ink"
                }`}
              >
                <span aria-hidden className="text-[17px] leading-none">
                  {LANG_FLAGS[l]}
                </span>
                <span lang={LANG_TAGS[l]} dir={dirFor(l)} className="flex-1">
                  {LANG_NAMES[l]}
                </span>
                {l === locale ? <IconCheck width={16} height={16} className="text-link" /> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
