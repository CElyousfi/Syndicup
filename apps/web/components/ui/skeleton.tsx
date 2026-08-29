export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-hairline ${className}`} />;
}

/** Squelette générique de page (utilisé par les loading.tsx). */
export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-fade">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32 rounded-card" />
        <Skeleton className="h-32 rounded-card" />
        <Skeleton className="h-32 rounded-card" />
      </div>
      <Skeleton className="h-72 rounded-card" />
    </div>
  );
}
