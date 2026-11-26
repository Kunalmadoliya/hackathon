/**
 * FILE GUIDE
 * Server actions for buying: addToCart, setQuantity, cartShown (records the EXPOSURE),
 * checkoutStarted / goToReview (checkout_started) and placeOrder (saves the order, sends order_placed).
 * placeOrder re-checks the kill switch and re-prices everything from the database.
 * Uses: lib/flags (Flagsmith events), lib/cart, lib/title-tests, lib/db.
 */
"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { EVENT, flushEvents, getCheckoutAssignment, getFlags, recordCheckoutExposure, trackEvent } from "@/lib/flags";
import { getCart } from "@/lib/cart";
import { logTitleEvents, titleOverrides } from "@/lib/title-tests";

const { cartItems, items, orders, orderItems } = schema;

export type CartActionState = { message?: string; added?: number; replacedStore?: string | null };

/** Add one of a dish. A cart holds dishes from one store; adding from another store starts a new cart. */
export async function addToCart(_prev: CartActionState, formData: FormData): Promise<CartActionState> {
  const me = await requireUser("user");
  const itemId = Number(formData.get("itemId"));
  const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!item || !item.available) return { message: "That dish is sold out." };

  const other = await db
    .select({ id: cartItems.id })
    .from(cartItems)
    .innerJoin(items, eq(items.id, cartItems.itemId))
    .where(and(eq(cartItems.userId, me.id), ne(items.sellerId, item.sellerId)))
    .limit(1);
  if (other.length) await db.delete(cartItems).where(eq(cartItems.userId, me.id));

  await db
    .insert(cartItems)
    .values({ userId: me.id, itemId: item.id, quantity: 1 })
    .onConflictDoUpdate({ target: [cartItems.userId, cartItems.itemId], set: { quantity: sql`least(${cartItems.quantity} + 1, 20)` } });

  const flags = await getFlags(me);
  const ov = await titleOverrides(me.id, [item.id], flags.sellerAbTitlesEnabled);
  await logTitleEvents(me.id, ov.values(), "add_to_cart");

  trackEvent(EVENT.addToCart, me.id, item.price);
  after(flushEvents);
  revalidatePath("/cart");
  const [{ n }] = await db
    .select({ n: sql<number>`coalesce(sum(${cartItems.quantity}), 0)::int` })
    .from(cartItems)
    .where(eq(cartItems.userId, me.id));
  return { added: n, message: other.length ? "Started a new cart for this store." : undefined };
}

export async function setQuantity(formData: FormData) {
  const me = await requireUser("user");
  const id = Number(formData.get("cartItemId"));
  const qty = Math.max(0, Math.min(20, Math.floor(Number(formData.get("quantity")))));
  if (!Number.isFinite(qty) || qty === 0) {
    await db.delete(cartItems).where(and(eq(cartItems.id, id), eq(cartItems.userId, me.id)));
  } else {
    await db.update(cartItems).set({ quantity: qty }).where(and(eq(cartItems.id, id), eq(cartItems.userId, me.id)));
  }
  revalidatePath("/cart");
}

/** Called by the cart once it is on screen: records the experiment exposure (deferred pattern). */
export async function cartShown() {
  const me = await requireUser("user");
  await recordCheckoutExposure(me);
  after(flushEvents);
}

/** checkout_started: control fires it on "Checkout", express when the confirm sheet opens. */
export async function checkoutStarted() {
  const me = await requireUser("user");
  trackEvent(EVENT.checkoutStarted, me.id);
  after(flushEvents);
}

/** Control version, step one: go to the review page. */
export async function goToReview() {
  const me = await requireUser("user");
  trackEvent(EVENT.checkoutStarted, me.id);
  after(flushEvents);
  redirect("/checkout");
}

export type PlaceOrderState = { message?: string };

/** Places the order. Checks the kill switch and recomputes every price on the server. */
export async function placeOrder(_prev: PlaceOrderState, _formData: FormData): Promise<PlaceOrderState> {
  const me = await requireUser("user");
  const flags = await getFlags(me);
  if (!flags.orderingEnabled) return { message: "Ordering is paused right now. Your cart is saved." };

  const cart = await getCart(me.id, flags.sellerAbTitlesEnabled);
  const lines = cart.lines.filter((l) => l.available);
  if (!cart.sellerId || lines.length === 0) return { message: "Your cart is empty." };

  const { variant } = await getCheckoutAssignment(me);
  const orderId = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({ userId: me.id, sellerId: cart.sellerId!, total: cart.total, status: "completed", checkoutVariant: variant })
      .returning({ id: orders.id });
    await tx.insert(orderItems).values(
      lines.map((l) => ({ orderId: order.id, itemId: l.itemId, titleShown: l.title, quantity: l.quantity, price: l.unitPrice })),
    );
    await tx.delete(cartItems).where(eq(cartItems.userId, me.id));
    return order.id;
  });
  await logTitleEvents(me.id, lines.flatMap((l) => (l.titleTest ? [l.titleTest] : [])), "order");

  // The experiment metric. Name must match the Flagsmith metric exactly.
  trackEvent(EVENT.orderPlaced, me.id, cart.total);
  after(flushEvents);
  revalidatePath("/orders");
  redirect(`/orders?placed=${orderId}`);
}
