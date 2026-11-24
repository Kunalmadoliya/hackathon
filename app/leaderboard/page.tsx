import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { getFlags } from "@/lib/flags";
import { sellerBoard, userBoard, windowRange, type BoardWindow } from "@/lib/leaderboard";
import { SellerBoard, UserBoard, WindowTabs } from "@/components/boards";
import { PageView } from "@/components/page-view";

export default function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<div className="thali mt-6 h-96" aria-busy="true" />}>
        <Boards searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Boards({ searchParams }: { searchParams: PageProps<"/leaderboard">["searchParams"] }) {
  const me = await requireUser();
  const sp = await searchParams;
  const w: BoardWindow = sp.window === "month" ? "month" : "week";
  const flags = await getFlags(me);

  if (!flags.leaderboardEnabled) {
    return (
      <>
        <h1 className="text-5xl font-bold">Leaderboard</h1>
        <div className="thali mt-6">
          <section className="katori katori-lg span-6" role="status">
            <h2 className="text-2xl font-semibold">The leaderboard is switched off right now</h2>
            <p className="mt-1 text-ink-soft">It comes back when Platter switches it on again. Your orders still count.</p>
          </section>
        </div>
      </>
    );
  }

  const [sellers, users] = await Promise.all([sellerBoard(w), userBoard(w)]);
  return (
    <>
      <PageView type="leaderboard_view" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl font-bold sm:text-6xl">Leaderboard</h1>
          <p className="mt-2 text-lg text-ink-soft">{windowRange(w).label}, India time. Ranked by completed orders.</p>
        </div>
        <WindowTabs current={w} base="/leaderboard" />
      </div>
      <div className="thali mt-6 items-start">
        <section className="katori katori-lg span-3">
          <h2 className="text-2xl font-semibold">Kitchens</h2>
          <SellerBoard rows={sellers} viewer={me} />
        </section>
        <section className="katori katori-lg span-3">
          <h2 className="text-2xl font-semibold">Hungriest customers</h2>
          <p className="text-sm text-ink-soft">Shown by nickname only.</p>
          <UserBoard rows={users} viewer={me} />
        </section>
      </div>
    </>
  );
}
