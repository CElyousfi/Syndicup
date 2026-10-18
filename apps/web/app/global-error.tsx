"use client";

import { useEffect } from "react";

/**
 * Dernier filet : la mise en page racine elle-même a échoué (polices, drapeaux, dictionnaire…).
 * Rien n'est garanti ici — ni CSS de l'app, ni primitives, ni langue : page minimale, styles en
 * ligne, BILINGUE, un bouton « Réessayer » et la référence pour le support.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ niveau: "error", message: "erreur globale", digest: error.digest ?? null }));
  }, [error]);
  const ref = error.digest ? error.digest.replace(/[^0-9a-zA-Z]/g, "").slice(0, 8) : null;
  const bouton = {
    height: 48,
    padding: "0 28px",
    borderRadius: 999,
    border: "none",
    background: "#E3EF8D",
    color: "#121212",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  } as const;
  return (
    <html lang="fr">
      <body style={{ margin: 0, background: "#F7F6F1", color: "#121212", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ maxWidth: 420, textAlign: "center" }} role="alert">
            <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Cette page n&apos;a pas pu s&apos;afficher</h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "#5c5b55", margin: "0 0 4px" }}>
              Le problème vient de chez nous. Vos données sont en sécurité : réessayez dans un instant.
            </p>
            <h1 dir="rtl" lang="ar" style={{ fontSize: 22, margin: "20px 0 8px" }}>تعذر عرض هذه الصفحة</h1>
            <p dir="rtl" lang="ar" style={{ fontSize: 15, lineHeight: 1.7, color: "#5c5b55", margin: 0 }}>
              المشكل من جهتنا. بياناتكم في أمان: أعيدوا المحاولة بعد لحظات.
            </p>
            {/* alive:allow frontière racine : aucune primitive ni CSS de l'app n'est garantie ici */}
            <button type="button" onClick={reset} style={{ ...bouton, marginTop: 28 }}>
              Réessayer · إعادة المحاولة
            </button>
            {ref ? (
              <p dir="ltr" style={{ marginTop: 16, fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#8a8983" }}>
                Réf. {ref}
              </p>
            ) : null}
          </div>
        </main>
      </body>
    </html>
  );
}
