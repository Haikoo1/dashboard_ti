export function SettingsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-14 animate-pulse rounded-xl bg-surface" />
      <div className="space-y-3 rounded-xl border border-border bg-surface p-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-surface-2/70" />
        ))}
      </div>
    </div>
  );
}
