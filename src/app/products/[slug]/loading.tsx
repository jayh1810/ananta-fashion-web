/** Instant feedback while the PDP RSC payload loads — layout/header stay mounted. */
export default function ProductLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 animate-pulse">
      <div className="mb-6 h-3 w-40 rounded bg-surface" />
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="aspect-square rounded-2xl bg-surface-alt" />
        <div className="space-y-4 pt-2">
          <div className="h-8 w-4/5 max-w-md rounded-lg bg-surface" />
          <div className="h-4 w-32 rounded bg-surface" />
          <div className="h-7 w-28 rounded-lg bg-surface" />
          <div className="space-y-2 pt-4">
            <div className="h-3 w-full rounded bg-surface-alt" />
            <div className="h-3 w-5/6 rounded bg-surface-alt" />
            <div className="h-3 w-2/3 rounded bg-surface-alt" />
          </div>
          <div className="flex gap-3 pt-6">
            <div className="h-12 flex-1 rounded-xl bg-surface" />
            <div className="h-12 flex-1 rounded-xl bg-surface-alt" />
          </div>
        </div>
      </div>
    </div>
  );
}
