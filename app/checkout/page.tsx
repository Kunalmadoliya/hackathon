/**
 * FILE GUIDE
 * Review page (/checkout): step two of the CONTROL version only. Express users are sent back to /cart.
 * Uses: lib/flags, lib/cart, ../cart/checkout-controls (PlaceOrderButton).
 */
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getCheckoutAssignment, getFlags } from "@/lib/flags";
import { getCart } from "@/lib/cart";
import { rupees } from "@/lib/queries";
import { PlaceOrderButton } from "../cart/checkout-controls";

// Version A (control), step two: review the order, then place it.
export default function CheckoutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-5xl font-bold">Review your order</h1>
      <Suspense fallback={<div className="thali mt-6 h-80" aria-busy="true" />}>
        <Review />
      </Suspense>
    </main>
  );
}

async function Review() {
  const me = await requireUser("user");
  const [flags, assignment] = await Promise.all([getFlags(me), getCheckoutAssignment(me)]);
  const cart = await getCart(me.id, flags.sellerAbTitlesEnabled);
  // The express version has no review step.
  if (assignment.variant === "express" || cart.lines.length === 0) redirect("/cart");
  const lines = cart.lines.filter((l) => l.available);

  return (
    <div className="thali mt-6">
      <section className="katori katori-lg span-6">
        <h2 className="text-lg font-semibold">{cart.storeName}</h2>
        <ul className="mt-3 grid gap-1">
          {lines.map((l) => (
            <li key={l.cartItemId} className="flex justify-between gap-4">
              <span>
                {l.quantity} × {l.title}
              </span>
              <span>{rupees(l.unitPrice * l.quantity)}</span>
            </li>
          ))}
        </ul>
        {cart.storeDiscount > 0 && (
          <p className="mt-2 flex justify-between text-ink-soft">
            <span>Store offer, {cart.storeDiscountPercent}% off</span>
            <span>−{rupees(cart.storeDiscount)}</span>
          </p>
        )}
      </section>
      <section className="katori span-3">
        <h2 className="text-lg font-semibold">Delivery</h2>
        <p className="mt-1 text-ink-soft">To your saved address. Pay when it arrives.</p>
      </section>
      <section className="katori katori-invert span-3">
        <p className="flex items-baseline justify-between">
          <span className="font-semibold">Total</span>
          <span className="font-display text-4xl font-extrabold">{rupees(cart.total)}</span>
        </p>
        <div className="mt-4">
          {flags.orderingEnabled ? (
            <PlaceOrderButton label="Place order" />
          ) : (
            <>
              <button className="btn w-full" disabled>
                Place order
              </button>
              <p role="status" className="mt-2 text-sm">
                Ordering is paused right now. Your cart is saved.
              </p>
            </>
          )}
        </div>
        <Link href="/cart" className="mt-3 inline-block text-sm font-semibold underline">
          Back to cart
        </Link>
      </section>
    </div>
  );
}
