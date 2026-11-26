/**
 * FILE GUIDE
 * Admin home (/admin): this week's orders, the switches at a glance, link to the experiment.
 * Uses: lib/flags, lib/db.
 */
import { Suspense } from "react";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getFlags, flagsmithConfigured } from "@/lib/flags";
import { istWeekStart, rupees } from "@/lib/queries";

export default function AdminHome() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<div className="thali mt-6 h-80" aria-busy="true" />}>
        <AdminContent />
      </Suspense>
    </main>
  );
}

async function AdminContent() {
  const me = await requireUser("admin");
  const flags = await getFlags(me);
  const since = istWeekStart().toISOString();
  const r = await db.execute(sql`
    select
      (select count(*)::int from orders where created_at >= ${since}) as week_orders,
      (select coalesce(sum(total),0)::float from orders where created_at >= ${since}) as week_revenue,
      (select count(*)::int from sellers) as sellers,
      (select count(*)::int from users where role = 'user') as users
  `);
  const m = r.rows[0] as Record<string, number>;

  const switches = [
    { label: "Ordering", on: flags.orderingEnabled },
    { label: "Seller themes", on: flags.sellerThemesEnabled },
    { label: "Leaderboards", on: flags.leaderboardEnabled },
    { label: "Title tests", on: flags.sellerAbTitlesEnabled },
  ];

  return (
    <>
      <h1 className="text-5xl font-bold sm:text-6xl">Marketplace</h1>
      <p className="mt-2 text-lg text-ink-soft">
        {m.sellers} kitchens and {m.users} customers. Feature values come from{" "}
        {flags.source === "flagsmith" ? "Flagsmith, live" : "safe defaults, because Flagsmith is not reachable"}.
      </p>

      <div className="thali mt-6">
        <section className="katori katori-lg span-4 row-2">
          <h2 className="text-lg font-semibold">The experiment</h2>
          <p className="mt-2 font-display text-3xl font-bold sm:text-4xl">Does one-step checkout get more orders?</p>
          <p className="mt-3 max-w-prose text-ink-soft">
            Half of customers get a two-step checkout. The other half get a single &ldquo;Order now&rdquo; button. Flagsmith
            splits them and counts <code>order_placed</code>.
          </p>
          <Link href="/admin/flags" className="btn mt-6">
            See results and switches
          </Link>
        </section>

        <section className="katori span-2">
          <h2 className="text-lg font-semibold">This week</h2>
          <p className="mt-1 font-display text-5xl font-extrabold">{m.week_orders}</p>
          <p className="text-ink-soft">orders, {rupees(m.week_revenue)}</p>
        </section>

        <section className="katori span-2">
          <h2 className="text-lg font-semibold">Switches</h2>
          <ul className="mt-2 grid gap-1.5">
            {switches.map((s) => (
              <li key={s.label} className="flex items-center justify-between">
                <span>{s.label}</span>
                <span className={s.on ? "chip-on" : "chip-off"}>
                  {s.on ? "On" : "Off"}
                </span>
              </li>
            ))}
          </ul>
          {!flagsmithConfigured && <p className="mt-2 text-sm text-danger">Flagsmith server key is missing.</p>}
        </section>
      </div>
    </>
  );
}
