/**
 * FILE GUIDE
 * The 'Add' button on each dish, drawn in the store's own button style. Runs in the browser.
 * Calls: addToCart in app/cart/actions.ts (which also sends add_to_cart to Flagsmith).
 */
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { addToCart, type CartActionState } from "@/app/cart/actions";

/** "Add" on a dish, drawn in the store's own button style. */
export function AddButton({ itemId, title }: { itemId: number; title: string }) {
  const [state, action, pending] = useActionState<CartActionState, FormData>(addToCart, {});
  return (
    <form action={action} className="flex shrink-0 flex-col items-end gap-1">
      <input type="hidden" name="itemId" value={itemId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`Add ${title} to cart`}
        className="px-4 py-2 text-sm font-semibold disabled:opacity-60"
        style={{ background: "var(--st-primary)", color: "var(--st-on-primary)", borderRadius: "var(--st-btn-radius)" }}
      >
        {pending ? "Adding…" : "Add"}
      </button>
      <p aria-live="polite" className="text-right text-xs">
        {state.added ? (
          <>
            {state.message ? `${state.message} ` : ""}
            <Link href="/cart" className="font-semibold underline">
              Cart ({state.added})
            </Link>
          </>
        ) : (
          state.message
        )}
      </p>
    </form>
  );
}
