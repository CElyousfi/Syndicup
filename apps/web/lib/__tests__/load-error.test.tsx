import { describe, expect, it, vi } from "vitest";

// Rendu hors routeur Next : le bouton « Réessayer » n'a besoin que d'un refresh factice.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LoadError } from "../../components/ui/load-error";
import { fr } from "../i18n/fr";
import { ar } from "../i18n/ar";

const echec = (status: number, code: string) => ({ code, status, message: "m", requestId: "1a2b3c4d-zz" });
const rendu = (props: Parameters<typeof LoadError>[0]) => renderToStaticMarkup(createElement(LoadError, props));

describe("<LoadError> — un 403 n'est jamais une panne", () => {
  it("en ligne : rien (la section ne concerne pas ce rôle)", () => {
    expect(rendu({ error: echec(403, "FORBIDDEN"), locale: "fr", variant: "inline" })).toBe("");
  });
  it("en page : « Pas d'accès », sans Réessayer ni référence", () => {
    const html = rendu({ error: echec(403, "FORBIDDEN"), locale: "ar" });
    expect(html).toContain(ar.errors.forbidden.title.replace("'", "&#x27;"));
    expect(html).not.toContain(ar.errors.actions.retry);
    expect(html).not.toContain("1a2b3c4d");
  });
  it("une vraie panne propose Réessayer et la référence", () => {
    const html = rendu({ error: echec(500, "INTERNAL_ERROR"), locale: "fr" });
    expect(html).toContain(fr.errors.actions.retry);
    expect(html).toContain("1a2b3c4d");
  });
});
