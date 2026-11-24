"use client";

import { useActionState } from "react";
import Link from "next/link";
import { declareWinner, saveItem, saveStoreDiscount, startTitleTest, type FormState } from "./actions";

function Message({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={`text-sm font-semibold ${state.ok ? "" : "text-danger"}`}>
      {state.message}
    </p>
  );
}

export type ItemFormValue = {
  id?: number;
  title: string;
  description: string;
  category: string;
  price: number;
  discountPercent: number;
  available: boolean;
};

export function ItemForm({ item, categories }: { item: ItemFormValue | null; categories: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveItem, {});
  const v = item ?? { title: "", description: "", category: categories[0] ?? "Mains", price: 0, discountPercent: 0, available: true };
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <label className="grid gap-1.5">
        <span className="font-semibold">Dish name</span>
        <input name="title" className="field" defaultValue={v.title} maxLength={60} required />
      </label>
      <label className="grid gap-1.5">
        <span className="font-semibold">Description</span>
        <textarea name="description" className="field min-h-20" defaultValue={v.description} maxLength={200} />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-1.5">
          <span className="font-semibold">Section</span>
          <input name="category" className="field" defaultValue={v.category} list="categories" maxLength={30} />
          <datalist id="categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="grid gap-1.5">
          <span className="font-semibold">Price (₹)</span>
          <input name="price" type="number" min="1" step="0.5" className="field" defaultValue={v.price || ""} required />
        </label>
        <label className="grid gap-1.5">
          <span className="font-semibold">Dish discount (%)</span>
          <input name="discountPercent" type="number" min="0" max="90" className="field" defaultValue={v.discountPercent} />
        </label>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="available" defaultChecked={v.available} className="h-4 w-4" />
        Available to order
      </label>
      <Message state={state} />
      <div className="flex gap-2">
        <button className="btn" disabled={pending}>
          {pending ? "Saving…" : item ? "Save dish" : "Add dish"}
        </button>
        <Link href="/seller/items" className="btn btn-quiet">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function StoreDiscountForm({ percent, bannerText, active }: { percent: number; bannerText: string; active: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveStoreDiscount, {});
  return (
    <form action={action} className="grid gap-3">
      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <label className="grid gap-1 text-sm">
          Percent
          <input name="percent" type="number" min="0" max="90" className="field" defaultValue={percent} />
        </label>
        <label className="grid gap-1 text-sm">
          What customers see
          <input name="bannerText" className="field" defaultValue={bannerText} maxLength={80} placeholder="15% off after 7 pm" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={active} className="h-4 w-4" />
        Discount is live
      </label>
      <Message state={state} />
      <button className="btn btn-quiet justify-self-start" disabled={pending}>
        {pending ? "Saving…" : "Save store discount"}
      </button>
    </form>
  );
}

export function StartTestForm({ itemId, currentTitle }: { itemId: number; currentTitle: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(startTitleTest, {});
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="itemId" value={itemId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="font-semibold">Title A</span>
          <input name="titleA" className="field" defaultValue={currentTitle} maxLength={60} required />
        </label>
        <label className="grid gap-1.5">
          <span className="font-semibold">Title B</span>
          <input name="titleB" className="field" maxLength={60} placeholder="Try a different name" required />
        </label>
      </div>
      <Message state={state} />
      <button className="btn justify-self-start" disabled={pending}>
        {pending ? "Starting…" : "Start test"}
      </button>
    </form>
  );
}

export function DeclareWinnerForm({ testId, titles, suggested }: { testId: number; titles: { a: string; b: string }; suggested: "a" | "b" | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(declareWinner, {});
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="testId" value={testId} />
      <fieldset className="grid gap-2">
        <legend className="font-semibold">Keep one title for everyone</legend>
        {(["a", "b"] as const).map((v) => (
          <label key={v} className="flex items-center gap-2">
            <input type="radio" name="winner" value={v} defaultChecked={suggested === v} className="h-4 w-4" />
            {v.toUpperCase()}: {titles[v]}
          </label>
        ))}
      </fieldset>
      <Message state={state} />
      <button className="btn justify-self-start" disabled={pending}>
        {pending ? "Saving…" : "Declare winner"}
      </button>
    </form>
  );
}
