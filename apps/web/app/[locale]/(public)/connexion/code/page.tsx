import { redirect } from "next/navigation";
import { getDict, isLocale, type Locale } from "../../../../../lib/i18n";
import { OtpForm } from "./otp-form";

export default async function CodePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tel?: string; next?: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "fr";
  const { tel, next } = await searchParams;
  if (!tel || !/^\+212\d{9}$/.test(tel)) redirect(`/${locale}/connexion`);
  return <OtpForm dict={getDict(locale)} locale={locale} telephone={tel} next={next} />;
}
