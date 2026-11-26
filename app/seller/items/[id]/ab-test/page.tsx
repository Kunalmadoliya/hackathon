/**
 * FILE GUIDE
 * Title test page (/seller/items/<id>/ab-test): start a test with titles A and B, watch results,
 * declare a winner. Hidden when the seller_ab_titles_enabled flag is off.
 * Uses: lib/title-tests (results), ../../forms.
 */
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSeller } from "@/lib/session";
import { getFlags } from "@/lib/flags";
import { MIN_VIEWERS, titleResults } from "@/lib/title-tests";
import { DeclareWinnerForm, StartTestForm } from "../../forms";

export default function AbTestPage({ params }: PageProps<"/seller/items/[id]/ab-test">) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Suspense fallback={<div className="thali mt-6 h-96" aria-busy="true" />}>
        <AbTest params={params} />
      </Suspense>
    </main>
  );
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

async function AbTest({ params }: { params: PageProps<"/seller/items/[id]/ab-test">["params"] }) {
  const me = await requireSeller();
  const { id } = await params;
  const [item] = await db
    .select()
    .from(schema.items)
    .where(and(eq(schema.items.id, Number(id)), eq(schema.items.sellerId, me.sellerId)))
    .limit(1);
  if (!item) notFound();
  const flags = await getFlags(me);

  const header = (
    <>
      <Link href="/seller/items" className="text-sm font-semibold underline">
        Menu
      </Link>
      <h1 className="mt-2 text-5xl font-bold">Test two titles</h1>
      <p className="mt-2 max-w-prose text-lg text-ink-soft">
        For <strong className="text-ink">{item.title}</strong>. Half of customers see title A, half see title B, and the same
        customer always sees the same one. Platter counts who orders it.
      </p>
    </>
  );

  if (!flags.sellerAbTitlesEnabled) {
    return (
      <>
        {header}
        <div className="thali mt-6">
          <section className="katori katori-lg span-6" role="status">
            <h2 className="text-2xl font-semibold">Title tests are switched off right now</h2>
            <p className="mt-1 text-ink-soft">Customers see the dish&rsquo;s normal title. Your tests come back when Platter switches them on.</p>
          </section>
        </div>
      </>
    );
  }

  const tests = await db.select().from(schema.titleTests).where(eq(schema.titleTests.itemId, item.id)).orderBy(desc(schema.titleTests.id));
  const running = tests.find((t) => t.status === "running");
  const past = tests.filter((t) => t.status === "ended");
  const results = running ? await titleResults(running) : null;
  const tooEarly = results ? results.some((r) => r.viewers < MIN_VIEWERS) : true;
  const leader = results && !tooEarly ? (results[0].rate === results[1].rate ? null : results[0].rate > results[1].rate ? "a" : "b") : null;

  return (
    <>
      {header}
      <div className="thali mt-6 items-start">
        {running && results ? (
          <>
            <section className="katori katori-lg span-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-2xl font-semibold">Running since {running.startedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}</h2>
                {tooEarly ? <span className="chip-off">Too early to call</span> : leader && <span className="chip-on">{leader.toUpperCase()} is ahead</span>}
              </div>
              <table className="mt-4 w-full text-left">
                <thead className="text-sm text-ink-soft">
                  <tr>
                    <th className="py-1.5 font-semibold">Title</th>
                    <th className="py-1.5 text-right font-semibold">Saw it</th>
                    <th className="py-1.5 text-right font-semibold">Added</th>
                    <th className="py-1.5 text-right font-semibold">Ordered</th>
                    <th className="py-1.5 text-right font-semibold">Order rate</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.variant} className="border-t border-line">
                      <td className="py-2.5">
                        <span className="font-semibold">{r.variant.toUpperCase()}</span> {r.title}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{r.viewers}</td>
                      <td className="py-2.5 text-right tabular-nums">{r.carted}</td>
                      <td className="py-2.5 text-right tabular-nums">{r.ordered}</td>
                      <td className="py-2.5 text-right font-semibold tabular-nums">{pct(r.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-sm text-ink-soft">
                Counted in customers, not page loads.{" "}
                {tooEarly
                  ? `Each title needs at least ${MIN_VIEWERS} customers before the numbers mean much.`
                  : "This is a simple comparison, not a statistical test, so treat small gaps with care."}
              </p>
            </section>
            <section className="katori span-2">
              <DeclareWinnerForm testId={running.id} titles={{ a: running.titleA, b: running.titleB }} suggested={leader} />
            </section>
          </>
        ) : (
          <section className="katori katori-lg span-6">
            <h2 className="mb-4 text-2xl font-semibold">Start a test</h2>
            <StartTestForm itemId={item.id} currentTitle={item.title} />
          </section>
        )}

        {past.length > 0 && (
          <section className="katori span-6">
            <h2 className="text-lg font-semibold">Past tests</h2>
            <ul className="mt-2 grid gap-1 text-sm">
              {past.map((t) => (
                <li key={t.id}>
                  A: {t.titleA}, B: {t.titleB}. Kept <strong>{t.winner === "a" ? t.titleA : t.titleB}</strong>.
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
