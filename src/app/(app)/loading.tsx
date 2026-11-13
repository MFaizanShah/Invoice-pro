export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-48 rounded-lg bg-ink-200/70" />
      <div className="h-32 rounded-xl bg-ink-200/50" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-72 rounded-xl bg-ink-200/50 lg:col-span-2" />
        <div className="h-72 rounded-xl bg-ink-200/50" />
      </div>
    </div>
  );
}
