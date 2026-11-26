/**
 * FILE GUIDE
 * Leaderboard SQL: ranks sellers and customers for this week or month (India time),
 * and shows hidden sellers as 'Anonymous seller #N'. Used by: both leaderboard pages.
 */
import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { istMonthStart, istWeekStart } from "./queries";

export type BoardWindow = "week" | "month";

export function windowRange(w: BoardWindow) {
  const start = w === "week" ? istWeekStart() : istMonthStart();
  return { start, label: w === "week" ? "This week, Monday to Sunday" : "This month" };
}

export type SellerRow = {
  rank: number;
  sellerId: number;
  storeName: string;
  showName: boolean;
  orders: number;
  revenue: number;
};

/** Sellers by completed orders, ties broken by revenue (PRD section 8). All sellers rank, even with 0 orders. */
export async function sellerBoard(w: BoardWindow): Promise<SellerRow[]> {
  const { start } = windowRange(w);
  const r = await db.execute(sql`
    select s.id, s.store_name, s.leaderboard_show_name,
      count(o.id)::int as orders, coalesce(sum(o.total), 0)::float as revenue
    from sellers s
    left join orders o on o.seller_id = s.id and o.status = 'completed' and o.created_at >= ${start.toISOString()}
    group by s.id
    order by orders desc, revenue desc, s.id
  `);
  return r.rows.map((x: Record<string, unknown>, i) => ({
    rank: i + 1,
    sellerId: x.id as number,
    storeName: x.store_name as string,
    showName: x.leaderboard_show_name as boolean,
    orders: x.orders as number,
    revenue: x.revenue as number,
  }));
}

export type UserRow = { rank: number; userId: number; nickname: string; orders: number; spend: number };

/** Users by completed orders, ties broken by spend. Users only appear by nickname. */
export async function userBoard(w: BoardWindow): Promise<UserRow[]> {
  const { start } = windowRange(w);
  const r = await db.execute(sql`
    select u.id, u.nickname, count(o.id)::int as orders, coalesce(sum(o.total), 0)::float as spend
    from users u
    join orders o on o.user_id = u.id and o.status = 'completed' and o.created_at >= ${start.toISOString()}
    where u.role = 'user'
    group by u.id
    order by orders desc, spend desc, u.id
  `);
  return r.rows.map((x: Record<string, unknown>, i) => ({
    rank: i + 1,
    userId: x.id as number,
    nickname: x.nickname as string,
    orders: x.orders as number,
    spend: x.spend as number,
  }));
}

/** What a viewer may see. Admins and the seller themselves see the real name. */
export function sellerDisplayName(row: SellerRow, viewer: { role: string; sellerId: number | null }) {
  if (viewer.role === "admin" || row.showName || viewer.sellerId === row.sellerId) return row.storeName;
  return `Anonymous seller #${row.rank}`;
}
