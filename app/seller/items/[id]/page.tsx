/**
 * FILE GUIDE
 * Add or edit one dish (/seller/items/new or /seller/items/<id>).
 * Uses: lib/store-data, ../forms (ItemForm).
 */
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/session";
import { getStore } from "@/lib/store-data";
import { ItemForm } from "../forms";

// Handles both /seller/items/new and /seller/items/[id].
export default function ItemPage({ params }: PageProps<"/seller/items/[id]">) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Suspense fallback={<div className="thali mt-6 h-96" aria-busy="true" />}>
        <Item params={params} />
      </Suspense>
    </main>
  );
}

async function Item({ params }: { params: PageProps<"/seller/items/[id]">["params"] }) {
  const me = await requireSeller();
  const { id } = await params;
  const store = await getStore(me.sellerId);
  if (!store) notFound();
  const categories = [...new Set(store.items.map((i) => i.category))];
  const isNew = id === "new";
  const item = isNew ? null : store.items.find((i) => i.id === Number(id));
  if (!isNew && !item) notFound();

  return (
    <>
      <h1 className="text-5xl font-bold">{isNew ? "Add a dish" : "Edit dish"}</h1>
      <div className="thali mt-6">
        <section className="katori katori-lg span-6">
          <ItemForm
            categories={categories}
            item={
              item
                ? {
                    id: Number(item.id),
                    title: item.title,
                    description: item.description,
                    category: item.category,
                    price: item.price,
                    discountPercent: item.discountPercent,
                    available: item.available ?? true,
                  }
                : null
            }
          />
        </section>
      </div>
    </>
  );
}
