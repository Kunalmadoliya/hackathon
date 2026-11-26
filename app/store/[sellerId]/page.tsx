/**
 * FILE GUIDE
 * A store's menu page (/store/1). Draws the store in the seller's look or the Platter look,
 * shows the two look switches, dish titles (title tests) and the Add buttons.
 * Uses: lib/resolve-theme (which look), lib/store-data (menu), lib/title-tests, components/storefront.
 */
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getFlags } from "@/lib/flags";
import { getStore } from "@/lib/store-data";
import { resolveStoreTheme, type ThemeReason } from "@/lib/resolve-theme";
import { Storefront } from "@/components/storefront";
import { setAlwaysDefault, setStoreTheme } from "./actions";
import { ViewBeacon } from "./view-beacon";
import { AddButton } from "./add-button";
import { titleOverrides } from "@/lib/title-tests";

export default function StorePage({ params }: PageProps<"/store/[sellerId]">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Suspense fallback={<div className="thali mt-4 h-[32rem]" aria-busy="true" />}>
        <Store params={params} />
      </Suspense>
    </main>
  );
}

const STATUS: Record<ThemeReason, string> = {
  seller: "You're seeing this store's own look.",
  no_theme: "This store uses the Platter look.",
  user_store_off: "You switched this store's look off, so you see the Platter look.",
  user_global_off: "You chose the Platter look for every store.",
  flag_off: "Store looks are paused across Platter right now, so every store uses the Platter look.",
};

function Switch({ on, label, children }: { on: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={on}
      className="flex w-full items-center justify-between gap-4 rounded-xl px-1 py-1 text-left"
    >
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-ink-soft">{children}</span>
      </span>
      <span
        aria-hidden
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-ink" : "bg-line"}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-page transition-[left] ${on ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}

async function Store({ params }: { params: PageProps<"/store/[sellerId]">["params"] }) {
  const me = await requireUser("user");
  const { sellerId } = await params;
  const id = Number(sellerId);
  if (!Number.isInteger(id)) notFound();
  const [flags, store] = await Promise.all([getFlags(me), getStore(id)]);
  if (!store) notFound();

  const { tokens, reason, prefs } = await resolveStoreTheme({
    flags,
    userId: me.id,
    sellerId: store.seller.id,
    activeThemeId: store.seller.activeThemeId,
  });
  const storeHasLook = store.seller.activeThemeId !== null;
  const titles = await titleOverrides(me.id, store.items.map((i) => Number(i.id)), flags.sellerAbTitlesEnabled);
  const shownItems = store.items.map((i) => ({ ...i, title: titles.get(Number(i.id))?.title ?? i.title }));

  return (
    <>
      <ViewBeacon sellerId={store.seller.id} />
      <Link href="/" className="text-sm font-semibold underline">
        All kitchens
      </Link>

      <div className="thali mt-3">
        <section className="katori span-4 flex flex-col justify-center" aria-live="polite">
          <h1 className="text-3xl font-bold sm:text-4xl">{store.seller.storeName}</h1>
          <p className="mt-1 text-ink-soft">{STATUS[reason]}</p>
          {store.discount && (
            <p className="mt-3 self-start rounded-full bg-ink px-3 py-1 text-sm font-semibold text-page">{store.discount.bannerText}</p>
          )}
        </section>

        <section className="katori span-2 grid gap-3" aria-label="Store look settings">
          {flags.sellerThemesEnabled ? (
            <>
              {storeHasLook && !prefs.alwaysDefault && (
                <form action={setStoreTheme}>
                  <input type="hidden" name="sellerId" value={store.seller.id} />
                  <input type="hidden" name="on" value={prefs.useStoreTheme ? "0" : "1"} />
                  <Switch on={prefs.useStoreTheme} label="Use this store's look">
                    Only for {store.seller.storeName}
                  </Switch>
                </form>
              )}
              <form action={setAlwaysDefault}>
                <input type="hidden" name="sellerId" value={store.seller.id} />
                <input type="hidden" name="on" value={prefs.alwaysDefault ? "0" : "1"} />
                <Switch on={prefs.alwaysDefault} label="Always use the Platter look">
                  For every store
                </Switch>
              </form>
            </>
          ) : (
            <p className="text-sm text-ink-soft">Store look settings come back when Platter switches store looks on again.</p>
          )}
        </section>
      </div>

      <div className="mt-3">
        <Storefront
          tokens={reason === "seller" ? tokens : { ...tokens, bannerUrl: null, bannerHeadline: null, bannerSubtext: null, discountBadgeText: null }}
          platterLook={reason !== "seller"}
          storeName={store.seller.storeName}
          cuisine={store.seller.cuisine}
          items={shownItems}
          storeDiscountText={store.discount ? `${store.discount.percent}% off your order` : null}
          itemAction={(item) =>
            item.available === false ? (
              <span className="shrink-0 text-sm font-semibold opacity-70">Sold out</span>
            ) : (
              <AddButton itemId={Number(item.id)} title={item.title} />
            )
          }
        />
      </div>
    </>
  );
}
