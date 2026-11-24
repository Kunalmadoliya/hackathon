"use client";

import { useActionState, useEffect, useRef } from "react";
import { cartShown, checkoutStarted, placeOrder, type PlaceOrderState } from "./actions";

/** Records the experiment exposure once the cart is actually on screen. */
export function ExposureBeacon() {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    cartShown().catch(() => {});
  }, []);
  return null;
}

export function PlaceOrderButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState<PlaceOrderState, FormData>(placeOrder, {});
  return (
    <form action={action} className="grid gap-2">
      <button type="submit" className="btn w-full" disabled={disabled || pending}>
        {pending ? "Placing your order…" : label}
      </button>
      {state.message && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}

/** Version B (express): one button opens a small confirm sheet that places the order directly. */
export function ExpressCheckout({ total, storeName, itemCount }: { total: string; storeName: string; itemCount: number }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        className="btn w-full"
        onClick={() => {
          ref.current?.showModal();
          checkoutStarted().catch(() => {});
        }}
      >
        Order now
      </button>
      <dialog
        ref={ref}
        aria-labelledby="confirm-title"
        className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-3xl bg-cell p-6 text-ink shadow-2xl backdrop:bg-black/50"
      >
        <h2 id="confirm-title" className="text-2xl font-bold">
          Place this order?
        </h2>
        <p className="mt-2 text-ink-soft">
          {itemCount} {itemCount === 1 ? "dish" : "dishes"} from {storeName}. You pay {total} when it arrives.
        </p>
        <div className="mt-5 grid gap-2">
          <PlaceOrderButton label={`Place order, ${total}`} />
          <button type="button" className="btn btn-quiet w-full" onClick={() => ref.current?.close()}>
            Keep shopping
          </button>
        </div>
      </dialog>
    </>
  );
}
