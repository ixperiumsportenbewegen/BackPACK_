/** Direct zichtbaar zodra je naar een andere pagina gaat, terwijl de echte pagina nog laadt. */
export default function Laden() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only">Bezig met laden…</span>
      <div className="h-32 animate-pulse rounded-han bg-rand" />
      <div className="h-8 w-2/3 animate-pulse rounded-han bg-rand" />
      <div className="h-24 animate-pulse rounded-han bg-rand" />
      <div className="h-24 animate-pulse rounded-han bg-rand" />
      <div className="h-24 animate-pulse rounded-han bg-rand" />
    </div>
  );
}
