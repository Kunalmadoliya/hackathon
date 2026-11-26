/**
 * FILE GUIDE
 * Loads one store: seller row, menu, active discount, own looks and Platter looks.
 * Used by: store page, theme studio, menu pages.
 */
import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "./db";
import type { StoreItem } from "@/components/storefront";

const { sellers, items, storeDiscounts, themes } = schema;

export async function getStore(sellerId: number) {
  const [seller] = await db.select().from(sellers).where(eq(sellers.id, sellerId)).limit(1);
  if (!seller) return null;
  const [menu, [discount], own, defaults] = await Promise.all([
    db.select().from(items).where(eq(items.sellerId, sellerId)).orderBy(asc(items.category), asc(items.id)),
    db
      .select()
      .from(storeDiscounts)
      .where(and(eq(storeDiscounts.sellerId, sellerId), eq(storeDiscounts.active, true)))
      .orderBy(desc(storeDiscounts.id))
      .limit(1),
    db.select().from(themes).where(eq(themes.sellerId, sellerId)).orderBy(asc(themes.id)),
    db.select().from(themes).where(and(isNull(themes.sellerId), eq(themes.isDefault, true))).orderBy(asc(themes.id)),
  ]);
  const storeItems: StoreItem[] = menu.map((i) => ({
    id: i.id,
    title: i.title,
    description: i.description,
    price: i.price,
    category: i.category,
    discountPercent: i.discountPercent,
    available: i.available,
  }));
  return { seller, items: storeItems, discount: discount ?? null, ownThemes: own, defaultThemes: defaults };
}
