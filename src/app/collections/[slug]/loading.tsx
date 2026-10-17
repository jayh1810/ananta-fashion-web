/** Soft loading state while a collection RSC payload loads. */
export default function CollectionLoading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-5 sm:py-6 animate-pulse">
      <div className="mb-6 h-8 w-56 rounded-lg bg-surface" />
      <div className="mb-8 h-3 w-72 max-w-full rounded bg-surface-alt" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-[var(--radius-md)] border border-line bg-white">
            <div className="aspect-square bg-surface-alt" />
            <div className="space-y-2 p-3">
              <div className="h-3 w-4/5 rounded bg-surface" />
              <div className="h-3 w-1/2 rounded bg-surface-alt" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
