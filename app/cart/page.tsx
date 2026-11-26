/**
 * FILE GUIDE
 * Cart page (/cart). THE EXPERIMENT LIVES HERE: asks Flagsmith which checkout version you get
 * and shows [Checkout] (control, two steps) or [Order now] (express, one step).
 * Also greys the button out when the ordering_enabled kill switch is off.
 * Uses: lib/flags (getCheckoutAssignment), lib/cart (prices), ./actions, ./checkout-controls.
 */
import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getCheckoutAssignment, getFlags } from "@/lib/flags";
import { getCart } from "@/lib/cart";
import { rupees } from "@/lib/queries";
import { goToReview, setQuantity } from "./actions";
import { ExposureBeacon, ExpressCheckout } from "./checkout-controls";

export default function CartPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-5xl font-bold">Your cart</h1>
      <Suspense fallback={<div className="thali mt-6 h-80" aria-busy="true" />}>
        <CartContent />
      </Suspense>
    </main>
  );
}

async function CartContent() {
  const me = await requireUser("user");
  const [flags, assignment] = await Promise.all([getFlags(me), getCheckoutAssignment(me)]);
  const cart = await getCart(me.id, flags.sellerAbTitlesEnabled);

  if (cart.lines.length === 0) {
    return (
      <div className="thali mt-6">
        <section className="katori katori-lg span-6">
          <h2 className="text-2xl font-semibold">Nothing in your cart yet</h2>
          <p className="mt-1 text-ink-soft">Open a kitchen and tap Add on any dish.</p>
          <Link href="/" className="btn mt-4">
            Browse kitchens
          </Link>
        </section>
      </div>
    );
  }

  const ordering = flags.orderingEnabled;

  return (
    <>
      <p className="mt-2 text-lg text-ink-soft">
        From{" "}
        <Link href={`/store/${cart.sellerId}`} className="font-semibold text-ink underline">
          {cart.storeName}
        </Link>
      </p>
      <ExposureBeacon />

      <div className="thali mt-6 items-start">
        <section className="katori katori-lg span-4" aria-label="Dishes">
          <ul className="divide-y divide-line">
            {cart.lines.map((l) => (
              <li key={l.cartItemId} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className={`font-semibold ${l.available ? "" : "line-through opacity-60"}`}>{l.title}</p>
                  <p className="text-sm text-ink-soft">
                    {rupees(l.unitPrice)} each
                    {l.discountPercent > 0 && `, ${l.discountPercent}% off`}
                    {!l.available && ". Sold out, not included"}
                  </p>
                </div>
                <form action={setQuantity} className="flex items-center gap-2">
                  <input type="hidden" name="cartItemId" value={l.cartItemId} />
                  <button name="quantity" value={l.quantity - 1} className="h-9 w-9 rounded-full font-bold shadow-[inset_0_0_0_1.5px_var(--line)]" aria-label={`One less ${l.title}`}>
                    −
                  </button>
                  <span className="w-6 text-center font-semibold" aria-label="Quantity">
                    {l.quantity}
                  </span>
                  <button name="quantity" value={l.quantity + 1} className="h-9 w-9 rounded-full font-bold shadow-[inset_0_0_0_1.5px_var(--line)]" aria-label={`One more ${l.title}`}>
                    +
                  </button>
                  <span className="w-20 text-right font-semibold">{rupees(l.unitPrice * l.quantity)}</span>
                </form>
              </li>
            ))}
          </ul>
        </section>

        <section className="katori katori-lg katori-invert span-2" aria-label="Total">
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
            <dt className="text-ink-soft">Dishes</dt>
            <dd>{rupees(cart.subtotal)}</dd>
            {cart.storeDiscount > 0 && (
              <>
                <dt className="text-ink-soft">Store offer, {cart.storeDiscountPercent}% off</dt>
                <dd>−{rupees(cart.storeDiscount)}</dd>
              </>
            )}
            <dt className="text-ink-soft">Delivery</dt>
            <dd>Free</dd>
          </dl>
          <p className="mt-3 flex items-baseline justify-between border-t border-current/20 pt-3">
            <span className="font-semibold">Total</span>
            <span className="font-display text-4xl font-extrabold">{rupees(cart.total)}</span>
          </p>

          <div className="mt-5">
            {!ordering ? (
              <>
                <button className="btn w-full" disabled>
                  {assignment.variant === "express" ? "Order now" : "Checkout"}
                </button>
                <p role="status" className="mt-2 text-sm">
                  Ordering is paused right now. Your cart is saved, so you can order as soon as it&rsquo;s back.
                </p>
              </>
            ) : assignment.variant === "express" ? (
              <ExpressCheckout total={rupees(cart.total)} storeName={cart.storeName ?? ""} itemCount={cart.itemCount} />
            ) : (
              <form action={goToReview}>
                <button className="btn w-full">Checkout</button>
              </form>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
