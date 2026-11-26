/**
 * FILE GUIDE
 * The grey placeholder blocks shown for a moment while a page is loading.
 * Used by: Next.js automatically, for every page.
 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10" aria-busy="true">
      <div className="h-12 w-72 rounded-xl bg-tray" />
      <div className="thali mt-8">
        <div className="katori span-4 row-2 min-h-72" />
        <div className="katori span-2 min-h-32" />
        <div className="katori span-2 min-h-32" />
      </div>
    </main>
  );
}
