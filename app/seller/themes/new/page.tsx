/**
 * FILE GUIDE
 * New look page (/seller/themes/new?from=<id>): opens the editor with a copy of an existing look.
 * Uses: ../editor, lib/flags (theme_options limits), lib/store-data.
 */
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSeller } from "@/lib/session";
import { getFlags } from "@/lib/flags";
import { getStore } from "@/lib/store-data";
import { PLATFORM_THEMES } from "@/lib/themes-default";
import { ThemeEditor } from "../editor";

export default function NewThemePage({ searchParams }: PageProps<"/seller/themes/new">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-5xl font-bold">New look</h1>
      <Suspense fallback={<div className="thali mt-6 h-96" aria-busy="true" />}>
        <NewTheme searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function NewTheme({ searchParams }: { searchParams: PageProps<"/seller/themes/new">["searchParams"] }) {
  const me = await requireSeller();
  const [flags, store, sp] = await Promise.all([getFlags(me), getStore(me.sellerId), searchParams]);
  if (!store || !flags.sellerThemesEnabled) redirect("/seller/themes");
  if (store.ownThemes.length >= flags.themeOptions.maxThemesPerSeller) redirect("/seller/themes");

  // Start from a copy of one of the seller's looks or a platform default.
  const fromId = Number(sp.from);
  const source = [...store.ownThemes, ...store.defaultThemes].find((t) => t.id === fromId);
  const base = source?.tokens ?? PLATFORM_THEMES[0].tokens;
  const tokens = {
    ...base,
    font: flags.themeOptions.fonts.includes(base.font) ? base.font : flags.themeOptions.fonts[0],
    radius: flags.themeOptions.radiusOptions.includes(base.radius) ? base.radius : flags.themeOptions.radiusOptions[0],
  };

  return (
    <ThemeEditor
      id={null}
      initialName={source ? `${source.name} copy` : "My look"}
      initialTokens={tokens}
      options={flags.themeOptions}
      storeName={store.seller.storeName}
      cuisine={store.seller.cuisine}
      items={store.items.slice(0, 6)}
      storeDiscountText={store.discount?.bannerText ?? null}
    />
  );
}
