/**
 * FILE GUIDE
 * Order history (/orders) and the 'Order placed' confirmation after checkout.
 * Uses: lib/db, lib/session, lib/queries.
 */
import { Suspense } from "react";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { rupees } from "@/lib/queries";

export default function OrdersPage({ searchParams }: PageProps<"/orders">) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-5xl font-bold">Your orders</h1>
      <Suspense fallback={<div className="thali mt-6 h-80" aria-busy="true" />}>
        <Orders searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Orders({ searchParams }: { searchParams: PageProps<"/orders">["searchParams"] }) {
  const me = await requireUser("user");
  const sp = await searchParams;
  const placed = Number(sp.placed);
  const r = await db.execute(sql`
    select o.id, o.total, o.created_at, s.store_name, s.id as seller_id,
      (select string_agg(oi.quantity || ' × ' || oi.title_shown, ', ' order by oi.id) from order_items oi where oi.order_id = o.id) as lines
    from orders o join sellers s on s.id = o.seller_id
    where o.user_id = ${me.id}
    order by o.created_at desc limit 50
  `);
  const orders = r.rows as { id: number; total: string; created_at: string; store_name: string; seller_id: number; lines: string }[];
  const fresh = orders.find((o) => o.id === placed);

  return (
    <div className="thali mt-6">
      {fresh && (
        <section className="katori katori-lg katori-invert span-6" role="status">
          <h2 className="text-3xl font-bold">Order placed</h2>
          <p className="mt-1 text-ink-soft">
            {fresh.store_name} has your order: {fresh.lines}. You pay {rupees(Number(fresh.total))} when it arrives.
          </p>
        </section>
      )}
      {orders.length === 0 ? (
        <section className="katori span-6">
          <p className="font-semibold">No orders yet.</p>
          <Link href="/" className="btn mt-3">
            Browse kitchens
          </Link>
        </section>
      ) : (
        <section className="katori span-6">
          <ul className="divide-y divide-line">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link href={`/store/${o.seller_id}`} className="font-semibold underline-offset-2 hover:underline">
                    {o.store_name}
                  </Link>
                  <p className="text-sm text-ink-soft">{o.lines}</p>
                </div>
                <p className="text-right">
                  <span className="block font-semibold">{rupees(Number(o.total))}</span>
                  <span className="block text-sm text-ink-soft">
                    {new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
