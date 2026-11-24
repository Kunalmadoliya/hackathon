import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { requireSeller } from "@/lib/session";
import { getFlags } from "@/lib/flags";
import { getStore } from "@/lib/store-data";
import { ThemeEditor } from "../editor";

export default function EditThemePage({ params }: PageProps<"/seller/themes/[id]">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-5xl font-bold">Edit look</h1>
      <Suspense fallback={<div className="thali mt-6 h-96" aria-busy="true" />}>
        <EditTheme params={params} />
      </Suspense>
    </main>
  );
}

async function EditTheme({ params }: { params: PageProps<"/seller/themes/[id]">["params"] }) {
  const me = await requireSeller();
  const [flags, store, { id }] = await Promise.all([getFlags(me), getStore(me.sellerId), params]);
  if (!store || !flags.sellerThemesEnabled) redirect("/seller/themes");
  // Only the seller's own looks are editable; platform defaults are read-only.
  const theme = store.ownThemes.find((t) => t.id === Number(id));
  if (!theme) notFound();

  return (
    <ThemeEditor
      id={theme.id}
      initialName={theme.name}
      initialTokens={theme.tokens}
      options={flags.themeOptions}
      storeName={store.seller.storeName}
      cuisine={store.seller.cuisine}
      items={store.items.slice(0, 6)}
      storeDiscountText={store.discount?.bannerText ?? null}
    />
  );
}
