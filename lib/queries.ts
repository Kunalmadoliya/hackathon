/**
 * FILE GUIDE
 * Small shared queries and helpers: kitchen cards, last order, India week/month start, rupees().
 * Used by: many pages.
 */
import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";
import type { ThemeTokens } from "./db/schema";

/** Monday 00:00 IST of the current week, as a UTC Date. */
export function istWeekStart(now = new Date()): Date {
  const IST = 5.5 * 3600000;
  const local = new Date(now.getTime() + IST);
  const dow = (local.getUTCDay() + 6) % 7; // Monday = 0
  local.setUTCHours(0, 0, 0, 0);
  local.setUTCDate(local.getUTCDate() - dow);
  return new Date(local.getTime() - IST);
}

/** First day of the current calendar month, 00:00 IST, as a UTC Date. */
export function istMonthStart(now = new Date()): Date {
  const IST = 5.5 * 3600000;
  const local = new Date(now.getTime() + IST);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - IST);
}

export type SellerCard = {
  id: number;
  storeName: string;
  cuisine: string;
  itemCount: number;
  ordersThisWeek: number;
  discountPercent: number | null;
  discountText: string | null;
  themeTokens: ThemeTokens | null;
  topItems: string[];
};

export async function listSellerCards(): Promise<SellerCard[]> {
  const since = istWeekStart().toISOString();
  const r = await db.execute(sql`
    select s.id, s.store_name, s.cuisine, t.tokens as theme_tokens,
      (select count(*)::int from items i where i.seller_id = s.id and i.available) as item_count,
      (select count(*)::int from orders o where o.seller_id = s.id and o.created_at >= ${since}) as orders_this_week,
      (select d.percent from store_discounts d where d.seller_id = s.id and d.active order by d.id desc limit 1) as discount_percent,
      (select d.banner_text from store_discounts d where d.seller_id = s.id and d.active order by d.id desc limit 1) as discount_text,
      (select array_agg(title) from (select i.title from items i where i.seller_id = s.id and i.available order by i.price desc limit 3) x) as top_items
    from sellers s
    left join themes t on t.id = s.active_theme_id
    order by orders_this_week desc, s.id
  `);
  return r.rows.map((x: Record<string, unknown>) => ({
    id: x.id as number,
    storeName: x.store_name as string,
    cuisine: x.cuisine as string,
    itemCount: x.item_count as number,
    ordersThisWeek: x.orders_this_week as number,
    discountPercent: (x.discount_percent as number) ?? null,
    discountText: (x.discount_text as string) ?? null,
    themeTokens: (x.theme_tokens as ThemeTokens) ?? null,
    topItems: (x.top_items as string[]) ?? [],
  }));
}

export async function lastOrderFor(userId: number) {
  const r = await db.execute(sql`
    select o.id, o.total, o.created_at, s.store_name, s.id as seller_id,
      (select string_agg(oi.quantity || ' × ' || oi.title_shown, ', ') from order_items oi where oi.order_id = o.id) as lines
    from orders o join sellers s on s.id = o.seller_id
    where o.user_id = ${userId}
    order by o.created_at desc limit 1
  `);
  const x = r.rows[0] as Record<string, unknown> | undefined;
  if (!x) return null;
  return {
    id: x.id as number,
    total: Number(x.total),
    createdAt: new Date(x.created_at as string),
    storeName: x.store_name as string,
    sellerId: x.seller_id as number,
    lines: (x.lines as string) ?? "",
  };
}

export const rupees = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
