"use client";

import { useEffect } from "react";
import { Button } from "../../components/ui/button";
import { IconCircle, CAlert } from "../../components/ui/color-icons";

/** Erreur serveur générique (A5) — request_id discret pour le support. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Après un déploiement, un onglet resté ouvert porte encore l'ancien JavaScript : ses
  // identifiants d'actions serveur et ses chunks n'existent plus → on recharge une fois,
  // silencieusement, au lieu d'afficher une erreur qui n'est pas la faute de l'utilisateur.
  useEffect(() => {
    const m = `${error?.name ?? ""} ${error?.message ?? ""}`;
    const perime =
      /UnrecognizedActionError|Server Action .* was not found|ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module/i.test(m);
    if (!perime) return;
    const cle = "syndicup:reload-perime";
    const dernier = Number(sessionStorage.getItem(cle) ?? 0);
    if (Date.now() - dernier < 30_000) return; // jamais de boucle de rechargement
    sessionStorage.setItem(cle, String(Date.now()));
    window.location.reload();
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ground px-6">
      <div className="card w-full max-w-md animate-in-up px-8 py-12 text-center">
        <IconCircle tone="danger" size={72} className="mx-auto">
          <CAlert width={32} height={32} />
        </IconCircle>
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">
          Une erreur est survenue
        </h1>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-soft">
          Le problème vient de chez nous, pas de chez vous. Réessayez dans un instant.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[11px] text-faint" dir="ltr">
            {error.digest}
          </p>
        ) : null}
        <Button onClick={reset} className="mt-7">
          Réessayer
        </Button>
      </div>
    </div>
  );
}
