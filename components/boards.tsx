/**
 * FILE GUIDE
 * Leaderboard lists (kitchens and customers) and the This week / This month tabs.
 * Used by: app/leaderboard and app/admin/leaderboard. Uses: lib/leaderboard (anonymous names).
 */
import Link from "next/link";
import { sellerDisplayName, type BoardWindow, type SellerRow, type UserRow } from "@/lib/leaderboard";
import { rupees } from "@/lib/queries";

type Viewer = { id: number; role: string; sellerId: number | null };

export function WindowTabs({ current, base }: { current: BoardWindow; base: string }) {
  return (
    <nav aria-label="Time window" className="flex gap-1 rounded-full bg-tray p-1">
      {(["week", "month"] as const).map((w) => (
        <Link
          key={w}
          href={`${base}?window=${w}`}
          aria-current={current === w ? "page" : undefined}
          className={`rounded-full px-4 py-1.5 font-semibold ${current === w ? "bg-ink text-page" : "hover:bg-line"}`}
        >
          {w === "week" ? "This week" : "This month"}
        </Link>
      ))}
    </nav>
  );
}

function Row({ rank, name, mine, meta, value, note }: { rank: number; name: string; mine: boolean; meta: string; value: string; note?: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${mine ? "bg-ink text-page" : ""}`}>
      <span className={`w-8 shrink-0 font-display text-xl font-extrabold tabular-nums ${rank <= 3 ? "" : "opacity-60"}`}>{rank}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">
          {name}
          {mine && <span className="ml-2 text-sm font-normal">(you)</span>}
        </span>
        <span className={`block text-sm ${mine ? "opacity-75" : "text-ink-soft"}`}>{meta}</span>
      </span>
      {note}
      <span className="shrink-0 text-right font-semibold tabular-nums">{value}</span>
    </li>
  );
}

export function SellerBoard({ rows, viewer, showVisibility = false }: { rows: SellerRow[]; viewer: Viewer; showVisibility?: boolean }) {
  const top = rows.slice(0, 10);
  const mine = rows.find((r) => r.sellerId === viewer.sellerId);
  return (
    <>
      <ol className="mt-3 grid gap-1">
        {top.map((r) => (
          <Row
            key={r.sellerId}
            rank={r.rank}
            name={sellerDisplayName(r, viewer)}
            mine={r.sellerId === viewer.sellerId}
            meta={`${r.orders} ${r.orders === 1 ? "order" : "orders"}`}
            value={rupees(r.revenue)}
            note={
              showVisibility ? (
                <span className={r.showName ? "chip-on" : "chip-off"} title="Name shown on public boards">
                  {r.showName ? "Name shown" : "Name hidden"}
                </span>
              ) : undefined
            }
          />
        ))}
      </ol>
      {mine && mine.rank > 10 && (
        <p className="mt-3 text-sm">
          Your rank: <strong>{mine.rank}</strong> with {mine.orders} orders.
        </p>
      )}
    </>
  );
}

export function UserBoard({ rows, viewer }: { rows: UserRow[]; viewer: Viewer }) {
  const top = rows.slice(0, 10);
  const mine = rows.find((r) => r.userId === viewer.id);
  return (
    <>
      {rows.length === 0 ? (
        <p className="mt-3 text-ink-soft">No orders in this window yet.</p>
      ) : (
        <ol className="mt-3 grid gap-1">
          {top.map((r) => (
            <Row
              key={r.userId}
              rank={r.rank}
              name={r.nickname}
              mine={r.userId === viewer.id}
              meta={`${r.orders} ${r.orders === 1 ? "order" : "orders"}`}
              value={viewer.role === "admin" ? rupees(r.spend) : ""}
            />
          ))}
        </ol>
      )}
      {viewer.role === "user" && (
        <p className="mt-3 text-sm text-ink-soft">
          {mine ? (mine.rank > 10 ? `Your rank: ${mine.rank}.` : "") : "Order something this window to get on the board."}
        </p>
      )}
    </>
  );
}
