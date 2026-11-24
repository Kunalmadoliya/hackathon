import { Suspense } from "react";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/session";
import { getFlags } from "@/lib/flags";
import { istWeekStart, rupees } from "@/lib/queries";

export default function SellerHome() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<div className="thali mt-6 h-80" aria-busy="true" />}>
        <SellerContent />
      </Suspense>
    </main>
  );
}

async function SellerContent() {
  const me = await requireSeller();
  const flags = await getFlags(me);
  const since = istWeekStart().toISOString();
  const r = await db.execute(sql`
    select s.store_name, s.leaderboard_show_name, t.name as theme_name, t.is_default as theme_is_default,
      (select count(*)::int from orders o where o.seller_id = s.id and o.created_at >= ${since}) as week_orders,
      (select coalesce(sum(total), 0)::float from orders o where o.seller_id = s.id and o.created_at >= ${since}) as week_revenue,
      (select count(*)::int from orders o where o.seller_id = s.id) as all_orders,
      (select count(*)::int from items i where i.seller_id = s.id) as item_count,
      (select count(*)::int from themes th where th.seller_id = s.id) as theme_count
    from sellers s left join themes t on t.id = s.active_theme_id
    where s.id = ${me.sellerId}
  `);
  const s = r.rows[0] as Record<string, unknown>;

  return (
    <>
      <h1 className="text-5xl font-bold sm:text-6xl">{s.store_name as string}</h1>
      <p className="mt-2 text-lg text-ink-soft">This week so far, Monday to today.</p>

      <div className="thali mt-6">
        <section className="katori katori-lg span-3 row-2 flex flex-col">
          <h2 className="text-lg font-semibold">Orders this week</h2>
          <p className="mt-2 font-display text-8xl font-extrabold leading-none">{s.week_orders as number}</p>
          <p className="mt-3 text-ink-soft">
            {rupees(s.week_revenue as number)} in sales. {s.all_orders as number} orders since you joined.
          </p>
          <p className="mt-auto pt-6 text-sm text-ink-soft">Full stats arrive in a later milestone.</p>
        </section>

        <section className="katori span-3">
          <h2 className="text-lg font-semibold">Store look</h2>
          <p className="mt-1">
            {flags.sellerThemesEnabled
              ? s.theme_name
                ? `Live: ${s.theme_name}${s.theme_is_default ? " (a Platter default)" : ""}.`
                : "Live: the Platter default."
              : "Store looks are switched off across Platter right now. Customers see the default look."}
          </p>
          <p className="mt-1 text-sm text-ink-soft">{s.theme_count as number} of your own looks saved.</p>
          <Link href="/seller/themes" className="btn btn-quiet mt-4">
            Open the theme studio
          </Link>
        </section>

        <section className="katori span-2">
          <h2 className="text-lg font-semibold">Menu</h2>
          <p className="mt-1">{s.item_count as number} dishes</p>
          <Link href="/seller/items" className="btn btn-quiet mt-4">
            Edit menu
          </Link>
        </section>

        <section className="katori span-1 katori-sm">
          <h2 className="font-semibold">Leaderboard name</h2>
          <p className="mt-1 text-sm">{s.leaderboard_show_name ? "Shown" : "Hidden"}</p>
          <Link href="/seller/leaderboard" className="mt-2 inline-block text-sm font-semibold underline">
            Change
          </Link>
        </section>
      </div>
    </>
  );
}
