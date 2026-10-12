/**
 * Porte de mise à jour mobile, deux niveaux (décision produit, oct. 2026) :
 *   - `minimale` : en dessous → l'app se bloque (écran « mise à jour requise »).
 *   - `derniere` : en dessous → bandeau refermable « mise à jour disponible ».
 * Pilotée par variables d'environnement, sans nouvelle publication.
 */
export type Plateforme = "android" | "ios";

export interface VersionInfo {
  plateforme: Plateforme;
  minimale: string | null;
  derniere: string | null;
  url_store: string | null;
}

export interface Verdict extends VersionInfo {
  version_client: string | null;
  /** `bloquer` : < minimale ; `proposer` : < derniere ; `ok` sinon (ou versions non configurées). */
  statut: "bloquer" | "proposer" | "ok";
}

export const SEMVER = /^\d+\.\d+\.\d+$/;

/** -1 si a < b, 0 si égal, 1 si a > b. Compare numériquement chaque composant. */
export function comparerSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

export function lireVersions(plateforme: Plateforme, env: NodeJS.ProcessEnv = process.env): VersionInfo {
  const suffixe = plateforme.toUpperCase();
  const lire = (k: string) => {
    const v = env[k]?.trim();
    return v && SEMVER.test(v) ? v : null;
  };
  return {
    plateforme,
    minimale: lire(`APP_MIN_VERSION_${suffixe}`),
    derniere: lire(`APP_LATEST_VERSION_${suffixe}`),
    url_store: env[`APP_STORE_URL_${suffixe}`]?.trim() || null,
  };
}

export function verdict(plateforme: Plateforme, versionClient: string | null, env?: NodeJS.ProcessEnv): Verdict {
  const info = lireVersions(plateforme, env);
  let statut: Verdict["statut"] = "ok";
  if (versionClient && SEMVER.test(versionClient)) {
    if (info.minimale && comparerSemver(versionClient, info.minimale) < 0) statut = "bloquer";
    else if (info.derniere && comparerSemver(versionClient, info.derniere) < 0) statut = "proposer";
  }
  return { ...info, version_client: versionClient, statut };
}
