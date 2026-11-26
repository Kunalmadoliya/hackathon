/**
 * FILE GUIDE
 * Menu page (/seller/items): your dishes, which ones have a title test running, and the store discount.
 * Uses: lib/store-data, lib/flags, ./forms.
 */
import { Suspense } from "react";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/session";
import { getFlags } from "@/lib/flags";
import { getStore } from "@/lib/store-data";
import { rupees } from "@/lib/queries";
import { StoreDiscountForm } from "./forms";

export default function ItemsPage({ searchParams }: PageProps<"/seller/items">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<div className="thali mt-6 h-96" aria-busy="true" />}>
        <Menu searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Menu({ searchParams }: { searchParams: PageProps<"/seller/items">["searchParams"] }) {
  const me = await requireSeller();
  const [store, flags, sp] = await Promise.all([getStore(me.sellerId), getFlags(me), searchParams]);
  if (!store) return null;
  const running = await db.execute(sql`
    select t.item_id from title_tests t join items i on i.id = t.item_id
    where i.seller_id = ${me.sellerId} and t.status = 'running'`);
  const testing = new Set((running.rows as { item_id: number }[]).map((r) => r.item_id));
  const categories = [...new Set(store.items.map((i) => i.category))];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl font-bold sm:text-6xl">Menu</h1>
          <p className="mt-2 text-lg text-ink-soft">{store.items.length} dishes at {store.seller.storeName}.</p>
        </div>
        <Link href="/seller/items/new" className="btn">
          Add a dish
        </Link>
      </div>
      {sp.saved && (
        <p role="status" className="mt-4 font-semibold">
          Dish saved.
        </p>
      )}

      <div className="thali mt-6 items-start">
        <section className="katori katori-lg span-4">
          {categories.map((cat) => (
            <div key={cat} className="mb-5 last:mb-0">
              <h2 className="text-xl font-semibold">{cat}</h2>
              <ul className="mt-2 divide-y divide-line">
                {store.items
                  .filter((i) => i.category === cat)
                  .map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {i.title}
                          {!i.available && <span className="chip-off ml-2">Sold out</span>}
                          {testing.has(Number(i.id)) && <span className="chip-on ml-2">Title test running</span>}
                        </p>
                        <p className="text-sm text-ink-soft">
                          {rupees(i.price)}
                          {i.discountPercent > 0 && `, ${i.discountPercent}% off`}
                        </p>
                      </div>
                      <div className="flex gap-2 text-sm">
                        <Link href={`/seller/items/${i.id}`} className="btn btn-quiet min-h-9! px-3!">
                          Edit
                        </Link>
                        {flags.sellerAbTitlesEnabled && (
                          <Link href={`/seller/items/${i.id}/ab-test`} className="btn btn-quiet min-h-9! px-3!">
                            Test titles
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="katori span-2">
          <h2 className="text-lg font-semibold">Store discount</h2>
          <p className="mb-3 text-sm text-ink-soft">Taken off the whole order, after dish discounts.</p>
          <StoreDiscountForm
            percent={store.discount?.percent ?? 0}
            bannerText={store.discount?.bannerText ?? ""}
            active={store.discount?.active ?? false}
          />
        </section>
      </div>
    </>
  );
}
