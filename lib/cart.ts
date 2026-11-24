import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "./db";
import { titleOverrides, type TitleOverride } from "./title-tests";

const { cartItems, items, sellers, storeDiscounts } = schema;

export type CartLine = {
  cartItemId: number;
  itemId: number;
  title: string;
  quantity: number;
  unitPrice: number; // after the item discount
  listPrice: number;
  discountPercent: number;
  available: boolean;
  titleTest?: TitleOverride;
};

export type Cart = {
  sellerId: number | null;
  storeName: string | null;
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  storeDiscountPercent: number;
  storeDiscount: number;
  total: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Builds the cart from the database. Prices never come from the browser. */
export async function getCart(userId: number, titlesEnabled = false): Promise<Cart> {
  const rows = await db
    .select({
      cartItemId: cartItems.id,
      itemId: items.id,
      title: items.title,
      quantity: cartItems.quantity,
      price: items.price,
      discountPercent: items.discountPercent,
      available: items.available,
      sellerId: items.sellerId,
      storeName: sellers.storeName,
    })
    .from(cartItems)
    .innerJoin(items, eq(items.id, cartItems.itemId))
    .innerJoin(sellers, eq(sellers.id, items.sellerId))
    .where(eq(cartItems.userId, userId))
    .orderBy(cartItems.id);

  const sellerId = rows[0]?.sellerId ?? null;
  const overrides = await titleOverrides(userId, rows.map((r) => r.itemId), titlesEnabled);
  const lines: CartLine[] = rows.map((r) => ({
    cartItemId: r.cartItemId,
    itemId: r.itemId,
    title: overrides.get(r.itemId)?.title ?? r.title,
    titleTest: overrides.get(r.itemId),
    quantity: r.quantity,
    listPrice: r.price,
    discountPercent: r.discountPercent,
    unitPrice: round2(r.price * (1 - r.discountPercent / 100)),
    available: r.available,
  }));
  const subtotal = round2(lines.filter((l) => l.available).reduce((t, l) => t + l.unitPrice * l.quantity, 0));

  let storeDiscountPercent = 0;
  if (sellerId) {
    const [d] = await db
      .select({ percent: storeDiscounts.percent })
      .from(storeDiscounts)
      .where(and(eq(storeDiscounts.sellerId, sellerId), eq(storeDiscounts.active, true)))
      .orderBy(desc(storeDiscounts.id))
      .limit(1);
    storeDiscountPercent = d?.percent ?? 0;
  }
  const storeDiscount = round2((subtotal * storeDiscountPercent) / 100);

  return {
    sellerId,
    storeName: rows[0]?.storeName ?? null,
    lines,
    itemCount: lines.reduce((t, l) => t + l.quantity, 0),
    subtotal,
    storeDiscountPercent,
    storeDiscount,
    total: round2(subtotal - storeDiscount),
  };
}
