"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getFlags } from "@/lib/flags";
import { resolveStoreTheme } from "@/lib/resolve-theme";
import { itemsOfSeller, logTitleEvents, titleOverrides } from "@/lib/title-tests";

const { userPrefs, sellers, events } = schema;

async function setPref(userId: number, sellerId: number | null, useSellerTheme: boolean) {
  // No unique index can cover a NULL seller_id here, so replace the row in one transaction.
  await db.transaction(async (tx) => {
    await tx
      .delete(userPrefs)
      .where(and(eq(userPrefs.userId, userId), sellerId === null ? isNull(userPrefs.sellerId) : eq(userPrefs.sellerId, sellerId)));
    await tx.insert(userPrefs).values({ userId, sellerId, useSellerTheme });
  });
}

/** "Use this seller's theme" on or off, per store. */
export async function setStoreTheme(formData: FormData) {
  const me = await requireUser("user");
  const sellerId = Number(formData.get("sellerId"));
  const on = formData.get("on") === "1";
  const [seller] = await db.select({ id: sellers.id }).from(sellers).where(eq(sellers.id, sellerId)).limit(1);
  if (!seller) return;
  await setPref(me.id, seller.id, on);
  if (!on) await db.insert(events).values({ type: "theme_disabled_by_user", userId: me.id, sellerId: seller.id });
  revalidatePath(`/store/${seller.id}`);
}

/** "Always use the default theme" for every store. */
export async function setAlwaysDefault(formData: FormData) {
  const me = await requireUser("user");
  const alwaysDefault = formData.get("on") === "1";
  await setPref(me.id, null, !alwaysDefault);
  if (alwaysDefault) await db.insert(events).values({ type: "theme_disabled_by_user", userId: me.id, sellerId: null });
  const back = Number(formData.get("sellerId"));
  revalidatePath(Number.isInteger(back) ? `/store/${back}` : "/");
}

/**
 * Called once from the browser after the store page is shown, so link prefetches
 * never count as visits. The server works out which theme was applied itself.
 */
export async function recordStoreView(sellerId: number) {
  const me = await requireUser("user");
  const [seller] = await db.select().from(sellers).where(eq(sellers.id, Number(sellerId))).limit(1);
  if (!seller) return;
  const flags = await getFlags(me);
  const { reason } = await resolveStoreTheme({ flags, userId: me.id, sellerId: seller.id, activeThemeId: seller.activeThemeId });
  const rows: (typeof events.$inferInsert)[] = [{ type: "store_view", userId: me.id, sellerId: seller.id }];
  if (reason === "seller") rows.push({ type: "theme_applied", userId: me.id, sellerId: seller.id });
  await db.insert(events).values(rows);
  const ids = (await itemsOfSeller(seller.id)).map((i) => i.id);
  await logTitleEvents(me.id, (await titleOverrides(me.id, ids, flags.sellerAbTitlesEnabled)).values(), "view");
}
