import { redirect } from "next/navigation";

/** La racine localisée n'est qu'un aiguillage : le middleware garantit une session. */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/tableau-de-bord`);
}
