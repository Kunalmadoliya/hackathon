/**
 * FILE GUIDE
 * Seller's 'Show my store name on leaderboards' switch (/seller/leaderboard) and this week's rank.
 * Uses: lib/leaderboard, ../items/actions (setLeaderboardName).
 */
import { Suspense } from "react";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSeller } from "@/lib/session";
import { sellerBoard } from "@/lib/leaderboard";
import { setLeaderboardName } from "../items/actions";

export default function SellerLeaderboardPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-5xl font-bold">Your name on leaderboards</h1>
      <Suspense fallback={<div className="thali mt-6 h-60" aria-busy="true" />}>
        <NameSetting />
      </Suspense>
    </main>
  );
}

async function NameSetting() {
  const me = await requireSeller();
  const [[seller], board] = await Promise.all([
    db.select().from(schema.sellers).where(eq(schema.sellers.id, me.sellerId)).limit(1),
    sellerBoard("week"),
  ]);
  const show = seller.leaderboardShowName;
  const rank = board.find((r) => r.sellerId === me.sellerId)?.rank;

  return (
    <div className="thali mt-6">
      <section className="katori katori-lg span-4">
        <form action={setLeaderboardName}>
          <input type="hidden" name="show" value={show ? "0" : "1"} />
          <button type="submit" role="switch" aria-checked={show} className="flex w-full items-start justify-between gap-6 text-left">
            <span>
              <span className="block text-xl font-semibold">Show my store name on leaderboards</span>
              <span className="mt-1 block text-ink-soft">
                {show
                  ? `Customers and other sellers see ${seller.storeName}.`
                  : `You still rank, but others see “Anonymous seller #${rank ?? "?"}”. Platter's team can always see your name.`}
              </span>
            </span>
            <span aria-hidden className={`relative mt-1 h-7 w-12 shrink-0 rounded-full ${show ? "bg-ink" : "bg-line"}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-page transition-[left] ${show ? "left-6" : "left-1"}`} />
            </span>
          </button>
        </form>
      </section>
      <section className="katori span-2">
        <h2 className="text-sm text-ink-soft">This week</h2>
        <p className="font-display text-6xl font-extrabold">#{rank ?? "–"}</p>
        <Link href="/leaderboard" className="mt-2 inline-block text-sm font-semibold underline">
          See the leaderboard
        </Link>
      </section>
    </div>
  );
}
