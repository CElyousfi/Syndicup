/**
 * Squelettes — blocs en voile d'encre (lisibles sur la toile blanche ET dans une tuile greige)
 * traversés par un reflet (sens de lecture respecté, cf. `.skeleton` dans motion.css). Chaque
 * variante reprend la silhouette de la page qui arrive (langage Wise : tuiles greige plates,
 * listes à plat sur la toile), pour que le contenu « se pose » au lieu de surgir.
 */
// Le voile passe en style en ligne : `.skeleton` (motion.css, hors couche) l'emporterait sur un utilitaire.
const VOILE = { background: "var(--color-wash)" } as const;

export function Skeleton({ className = "" }: { className?: string }) {
  // Rayon par défaut seulement si l'appelant n'en donne pas (sinon rounded-lg l'emporterait dans la cascade).
  return <div className={`skeleton ${/\brounded-/.test(className) ? "" : "rounded-lg"} ${className}`} style={VOILE} aria-hidden />;
}

/** Tuile greige vide (graphique, bloc) — la silhouette d'une `.card`. */
function TileSkeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-card ${className}`} style={{ background: "var(--color-tile)" }} aria-hidden />;
}

function HeaderSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-64 max-w-[80%] rounded-full" />
      <Skeleton className="h-4 w-80 max-w-full rounded-full" />
    </div>
  );
}

/** Ligne de liste Wise : pastille ronde, titre + sous-titre, valeur à l'extrémité. */
function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-2 py-3.5">
      <Skeleton className="size-11 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3 rounded-full" />
        <Skeleton className="h-3 w-1/2 rounded-full" />
      </div>
      <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="card stat">
      <div className="stat-icon">
        <Skeleton className="size-11 rounded-full" />
      </div>
      <Skeleton className="stat-label h-4 w-28 rounded-full" />
      <div className="stat-value-row">
        <Skeleton className="h-7 w-32 rounded-full" />
      </div>
    </div>
  );
}

/** Squelette générique de page (repli du loading.tsx racine). */
export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-fade" role="status" aria-busy="true">
      <HeaderSkeleton />
      <div className="grid gap-4 md:grid-cols-3">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>
      <TileSkeleton className="h-72" />
    </div>
  );
}

/** Tableau de bord : bandeau photo, 4 statistiques, graphique + liste. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade" role="status" aria-busy="true">
      <HeaderSkeleton />
      <TileSkeleton className="h-36 sm:h-44" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card space-y-5 p-6 lg:col-span-2">
          <Skeleton className="h-5 w-40 rounded-full" />
          <div className="flex h-52 items-end gap-3">
            {[55, 80, 40, 95, 65, 75, 50, 85].map((h, i) => (
              <div key={i} className="flex-1" style={{ height: `${h}%` }}>
                <Skeleton className="size-full rounded-[12px]" />
              </div>
            ))}
          </div>
        </div>
        <div className="card space-y-1 p-4">
          {Array.from({ length: 4 }, (_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Liste : en-tête, statistiques, filtres, lignes de tableau. */
export function ListSkeleton({ stats = 3 }: { stats?: number }) {
  return (
    <div className="space-y-6 animate-fade" role="status" aria-busy="true">
      <HeaderSkeleton />
      {stats > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: stats }, (_, i) => (
            <StatSkeleton key={i} />
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-11 w-64 max-w-full rounded-full" />
        <Skeleton className="h-11 w-28 rounded-full" />
        <Skeleton className="h-11 w-28 rounded-full" />
      </div>
      <div>
        <Skeleton className="mb-1 h-11 rounded-[14px]" />
        {Array.from({ length: 6 }, (_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** Fiche détail : retour, titre + badge, carte principale et colonne latérale. */
export function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-fade" role="status" aria-busy="true">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="hidden h-3.5 w-24 rounded-full sm:block" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-72 max-w-[70%] rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex gap-5 border-b border-hairline pb-3">
        <Skeleton className="h-4 w-20 rounded-full" />
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card space-y-4 p-6 lg:col-span-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center justify-between gap-6">
              <Skeleton className="h-3.5 w-32 rounded-full" />
              <Skeleton className="h-3.5 w-40 rounded-full" />
            </div>
          ))}
        </div>
        <div className="card space-y-3 p-6">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-20 rounded-[18px]" />
          <Skeleton className="h-11 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** Formulaire (création / modification / réglages) : titre, carte de champs, actions. */
export function FormSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade" role="status" aria-busy="true">
      <Skeleton className="size-10 rounded-full" />
      <HeaderSkeleton />
      <div className="card space-y-5 p-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3.5 w-28 rounded-full" />
            <Skeleton className="h-11 rounded-field" />
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Skeleton className="h-11 w-24 rounded-full" />
          <Skeleton className="h-11 w-32 rounded-full" />
        </div>
      </div>
    </div>
  );
}
