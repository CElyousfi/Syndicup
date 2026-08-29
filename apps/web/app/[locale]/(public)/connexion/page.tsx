import type { Metadata } from "next";
import { getDict, isLocale, type Locale } from "../../../../lib/i18n";
import { LoginForm } from "./login-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDict(isLocale(locale) ? locale : "fr");
  return { title: dict.auth.loginTitle };
}

export default async function ConnexionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale: raw } = await params;
  const { next } = await searchParams;
  const locale: Locale = isLocale(raw) ? raw : "fr";
  return <LoginForm dict={getDict(locale)} locale={locale} next={next} />;
}
