import type { Metadata } from "next";
import { getDict, isLocale, type Locale } from "../../../../lib/i18n";
import { ResetForm } from "./reset-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").auth.resetTitle };
}

/**
 * Cible du lien « mot de passe oublié » envoyé par GoTrue. Avec le flux token_hash, le lien
 * arrive avec `?token_hash=…&type=recovery` ; sans token_hash valide, on renvoie vers la demande.
 */
export default async function ReinitialiserPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { locale: raw } = await params;
  const { token_hash } = await searchParams;
  const locale: Locale = isLocale(raw) ? raw : "fr";
  return <ResetForm dict={getDict(locale)} locale={locale} tokenHash={token_hash ?? ""} />;
}
