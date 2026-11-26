/**
 * FILE GUIDE
 * Admin leaderboards (/admin/leaderboard): real names, 'Name shown/hidden' chips, and the seller table.
 * Uses: lib/leaderboard, components/boards, lib/db.
 */
import { Suspense } from "react";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getFlags } from "@/lib/flags";
import { sellerBoard, userBoard, windowRange, type BoardWindow } from "@/lib/leaderboard";
import { SellerBoard, UserBoard, WindowTabs } from "@/components/boards";
import { rupees } from "@/lib/queries";

export default function AdminLeaderboardPage({ searchParams }: PageProps<"/admin/leaderboard">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<div className="thali mt-6 h-96" aria-busy="true" />}>
        <AdminBoards searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function AdminBoards({ searchParams }: { searchParams: PageProps<"/admin/leaderboard">["searchParams"] }) {
  const me = await requireUser("admin");
  const sp = await searchParams;
  const w: BoardWindow = sp.window === "month" ? "month" : "week";
  const [flags, sellers, users, table] = await Promise.all([getFlags(me), sellerBoard(w), userBoard(w), sellerTable()]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl font-bold sm:text-6xl">Leaderboards</h1>
          <p className="mt-2 text-lg text-ink-soft">
            {windowRange(w).label}. You always see real store names.
            {!flags.leaderboardEnabled && " The leaderboard is switched off, so customers and sellers can't see it."}
          </p>
        </div>
        <WindowTabs current={w} base="/admin/leaderboard" />
      </div>

      <div className="thali mt-6 items-start">
        <section className="katori katori-lg span-3">
          <h2 className="text-2xl font-semibold">Kitchens</h2>
          <SellerBoard rows={sellers} viewer={me} showVisibility />
        </section>
        <section className="katori katori-lg span-3">
          <h2 className="text-2xl font-semibold">Customers</h2>
          <UserBoard rows={users} viewer={me} />
        </section>

        <section className="katori katori-lg span-6 overflow-x-auto">
          <h2 className="text-2xl font-semibold">Sellers</h2>
          <table className="mt-3 w-full min-w-[40rem] text-left">
            <thead className="text-sm text-ink-soft">
              <tr>
                <th className="py-2 pr-4 font-semibold">Store</th>
                <th className="py-2 pr-4 font-semibold">Name on boards</th>
                <th className="py-2 pr-4 font-semibold">Own look</th>
                <th className="py-2 pr-4 font-semibold">Running title tests</th>
                <th className="py-2 pr-4 text-right font-semibold">Orders</th>
                <th className="py-2 text-right font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {table.map((s) => (
                <tr key={s.id}>
                  <td className="py-2.5 pr-4 font-semibold">{s.store_name}</td>
                  <td className="py-2.5 pr-4">
                    <span className={s.leaderboard_show_name ? "chip-on" : "chip-off"}>{s.leaderboard_show_name ? "Shown" : "Hidden"}</span>
                  </td>
                  <td className="py-2.5 pr-4">{s.has_custom_theme ? "Yes" : "No"}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{s.active_tests}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{s.orders}</td>
                  <td className="py-2.5 text-right tabular-nums">{rupees(s.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-sm text-ink-soft">Orders and revenue are all time.</p>
        </section>
      </div>
    </>
  );
}

async function sellerTable() {
  const r = await db.execute(sql`
    select s.id, s.store_name, s.leaderboard_show_name,
      exists (select 1 from themes t where t.seller_id = s.id) as has_custom_theme,
      (select count(*)::int from title_tests tt join items i on i.id = tt.item_id where i.seller_id = s.id and tt.status = 'running') as active_tests,
      (select count(*)::int from orders o where o.seller_id = s.id and o.status = 'completed') as orders,
      (select coalesce(sum(total), 0)::float from orders o where o.seller_id = s.id and o.status = 'completed') as revenue
    from sellers s order by s.id
  `);
  return r.rows as {
    id: number;
    store_name: string;
    leaderboard_show_name: boolean;
    has_custom_theme: boolean;
    active_tests: number;
    orders: number;
    revenue: number;
  }[];
}
