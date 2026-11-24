"use server";

import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

const ALLOWED = new Set(["leaderboard_view"]);

/** Page-view events for the success metrics. Sent from the browser so prefetches never count. */
export async function recordPageView(type: string) {
  if (!ALLOWED.has(type)) return;
  const me = await getCurrentUser();
  if (!me) return;
  await db.insert(schema.events).values({ type, userId: me.id, sellerId: me.sellerId });
}
