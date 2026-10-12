import type { Metadata } from "next";
import { getDict, isLocale, type Locale } from "../../../../lib/i18n";
import { ForgotForm } from "./forgot-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").auth.forgotTitle };
}

export default async function MotDePasseOubliePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "fr";
  return <ForgotForm dict={getDict(locale)} locale={locale} />;
}
