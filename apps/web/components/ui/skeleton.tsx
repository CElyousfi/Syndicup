/**
 * Squelettes — blocs greige traversés par un reflet (sens de lecture respecté, cf. `.skeleton`
 * dans motion.css). Chaque variante reprend la silhouette de la page qui arrive, pour que le
 * contenu « se pose » à la place du squelette au lieu de surgir.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden />;
}

function HeaderSkeleton() {
  return (
    <div className="space-y-2.5">
      <Skeleton className="h-7 w-56 rounded-full" />
      <Skeleton className="h-4 w-80 max-w-full rounded-full" />
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
        <Skeleton className="h-32 rounded-card" />
        <Skeleton className="h-32 rounded-card" />
        <Skeleton className="h-32 rounded-card" />
      </div>
      <Skeleton className="h-72 rounded-card" />
    </div>
  );
}

/** Tableau de bord : bandeau photo, 4 statistiques, graphique + liste. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade" role="status" aria-busy="true">
      <HeaderSkeleton />
      <Skeleton className="h-36 rounded-card sm:h-44" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-card lg:col-span-2" />
        <Skeleton className="h-80 rounded-card" />
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
        <Skeleton className="h-11 w-64 max-w-full rounded-field" />
        <Skeleton className="h-11 w-40 rounded-field" />
        <Skeleton className="h-11 w-40 rounded-field" />
      </div>
      <div className="card divide-y divide-hairline overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3 rounded-full" />
              <Skeleton className="h-3 w-1/2 rounded-full" />
            </div>
            <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
