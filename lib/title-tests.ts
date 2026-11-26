/**
 * FILE GUIDE
 * Seller title tests: which title a customer sees (stable hash of user + test), logging
 * view / add_to_cart / order, and per-title results. Used by: store, cart, seller test page.
 */
import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "./db";

const { titleTests, titleEvents, items } = schema;

export type Variant = "a" | "b";

/** Stable 50/50 assignment: a hash of userId + testId (PRD section 6). */
export function variantFor(userId: number, testId: number): Variant {
  const h = createHash("sha256").update(`${userId}:${testId}`).digest();
  return h[0] % 2 === 0 ? "a" : "b";
}

export type TitleOverride = { testId: number; variant: Variant; title: string };

/** Titles this user should see for items with a running test. Empty when the feature is off. */
export async function titleOverrides(userId: number, itemIds: number[], enabled: boolean): Promise<Map<number, TitleOverride>> {
  const map = new Map<number, TitleOverride>();
  if (!enabled || itemIds.length === 0) return map;
  const running = await db
    .select()
    .from(titleTests)
    .where(and(inArray(titleTests.itemId, itemIds), eq(titleTests.status, "running")));
  for (const t of running) {
    const v = variantFor(userId, t.id);
    map.set(t.itemId, { testId: t.id, variant: v, title: v === "a" ? t.titleA : t.titleB });
  }
  return map;
}

export async function logTitleEvents(
  userId: number,
  overrides: Iterable<TitleOverride>,
  type: "view" | "add_to_cart" | "order",
) {
  const rows = [...overrides].map((o) => ({ testId: o.testId, userId, variant: o.variant, type }));
  if (rows.length) await db.insert(titleEvents).values(rows);
}

export type TitleResult = {
  variant: Variant;
  title: string;
  viewers: number;
  carted: number;
  ordered: number;
  rate: number; // ordered / viewers
};

export const MIN_VIEWERS = 30;

/** Per-title results, counted in distinct customers so a refresh does not inflate views. */
export async function titleResults(test: { id: number; titleA: string; titleB: string }): Promise<TitleResult[]> {
  const r = await db.execute(sql`
    select variant,
      count(distinct user_id) filter (where type = 'view')::int as viewers,
      count(distinct user_id) filter (where type = 'add_to_cart')::int as carted,
      count(distinct user_id) filter (where type = 'order')::int as ordered
    from title_events where test_id = ${test.id} group by variant
  `);
  const by = Object.fromEntries((r.rows as { variant: Variant; viewers: number; carted: number; ordered: number }[]).map((x) => [x.variant, x]));
  return (["a", "b"] as const).map((v) => {
    const x = by[v] ?? { viewers: 0, carted: 0, ordered: 0 };
    return { variant: v, title: v === "a" ? test.titleA : test.titleB, viewers: x.viewers, carted: x.carted, ordered: x.ordered, rate: x.viewers ? x.ordered / x.viewers : 0 };
  });
}

export async function itemsOfSeller(sellerId: number) {
  return db.select({ id: items.id }).from(items).where(eq(items.sellerId, sellerId));
}
