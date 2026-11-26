/**
 * FILE GUIDE
 * Customer home page (/): the kitchens in a bento grid, plus 'Your last order'.
 * Shows a 'paused' banner if the ordering_enabled flag is off.
 * Uses: lib/session (who you are), lib/flags (Flagsmith), lib/queries (kitchens, last order).
 */
import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getFlags } from "@/lib/flags";
import { listSellerCards, lastOrderFor, rupees, type SellerCard } from "@/lib/queries";

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<div className="thali mt-6 h-96" aria-busy="true" />}>
        <HomeContent />
      </Suspense>
    </main>
  );
}

async function HomeContent() {
  const user = await requireUser("user");
  const [flags, sellers, last] = await Promise.all([getFlags(user), listSellerCards(), lastOrderFor(user.id)]);
  const [featured, ...rest] = sellers;

  return (
    <>
      <h1 className="text-5xl font-bold sm:text-6xl">What are you eating tonight?</h1>
      <p className="mt-2 text-lg text-ink-soft">
        {sellers.length} kitchens near you. Each one sets its own look, and you can switch it off.
      </p>

      <div className="thali mt-6">
        {!flags.orderingEnabled && (
          <section className="katori katori-invert span-6" role="status">
            <h2 className="text-xl font-semibold">Ordering is paused for a moment</h2>
            <p className="mt-1 opacity-90">You can still browse menus. Checkout comes back as soon as the team switches it on.</p>
          </section>
        )}

        {featured && <KitchenCompartment seller={featured} size="large" themesOn={flags.sellerThemesEnabled} />}

        <section className="katori span-2 flex flex-col">
          <h2 className="text-lg font-semibold">Your last order</h2>
          {last ? (
            <>
              <p className="mt-2 font-display text-2xl font-bold">{last.storeName}</p>
              <p className="mt-1 line-clamp-3 text-sm text-ink-soft">{last.lines}</p>
              <p className="mt-auto pt-3 text-sm">
                {rupees(last.total)} on{" "}
                {last.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}
              </p>
              <Link href={`/store/${last.sellerId}`} className="btn btn-quiet mt-3 self-start">
                Order from {last.storeName} again
              </Link>
            </>
          ) : (
            <p className="mt-2 text-ink-soft">Nothing yet. Open a kitchen and add something to your cart.</p>
          )}
        </section>

        {rest.map((s) => (
          <KitchenCompartment key={s.id} seller={s} size="small" themesOn={flags.sellerThemesEnabled} />
        ))}
      </div>
    </>
  );
}

function KitchenCompartment({ seller, size, themesOn }: { seller: SellerCard; size: "large" | "small"; themesOn: boolean }) {
  const large = size === "large";
  // A small colour swatch previews the store's look without restyling the home page.
  const swatch = themesOn ? seller.themeTokens : null;
  return (
    <section className={`katori ${large ? "katori-lg span-4 row-2" : "span-2"} flex flex-col`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={`${large ? "text-4xl sm:text-5xl" : "text-2xl"} font-bold`}>{seller.storeName}</h2>
          <p className="mt-1 text-ink-soft">{seller.cuisine}</p>
        </div>
        {swatch && (
          <span className="flex shrink-0 overflow-hidden rounded-full shadow-[0_0_0_2px_var(--cell),0_0_0_3px_var(--line)]" title="This store has its own look">
            {[swatch.primary, swatch.accent, swatch.background].map((c) => (
              <span key={c} className="h-5 w-5" style={{ background: c }} />
            ))}
          </span>
        )}
      </div>

      {seller.discountPercent ? (
        <p className="mt-4 self-start rounded-full bg-ink px-3 py-1 text-sm font-semibold text-page">
          {seller.discountText || `${seller.discountPercent}% off`}
        </p>
      ) : null}

      {large && seller.topItems.length > 0 && (
        <ul className="mt-6 grid gap-2 sm:grid-cols-3">
          {seller.topItems.map((t) => (
            <li key={t} className="rounded-xl bg-tray px-3 py-4 font-semibold">
              {t}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <p className="text-sm text-ink-soft">
          {seller.itemCount} dishes, {seller.ordersThisWeek} orders this week
        </p>
        <Link href={`/store/${seller.id}`} className={large ? "btn" : "btn btn-quiet"}>
          Open menu
        </Link>
      </div>
    </section>
  );
}
