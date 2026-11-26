/**
 * FILE GUIDE
 * The theme editor (runs in the browser): colour pickers, font, corners, buttons, banner, badge,
 * a live preview of your real menu, and the 'hard to read' contrast warning.
 * Uses: components/storefront (preview), lib/theme (contrast), ./actions (saveTheme).
 */
"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { ThemeTokens } from "@/lib/db/schema";
import type { ThemeOptions } from "@/lib/flags-types";
import { contrastChecks } from "@/lib/theme";
import { Storefront, type StoreItem } from "@/components/storefront";
import { saveTheme, type SaveState } from "./actions";

const COLOR_FIELDS: { key: keyof ThemeTokens; label: string; hint: string }[] = [
  { key: "primary", label: "Main colour", hint: "Header and buttons" },
  { key: "background", label: "Page background", hint: "Behind the menu" },
  { key: "surface", label: "Card colour", hint: "Behind each dish" },
  { key: "text", label: "Text", hint: "Dish names and prices" },
  { key: "accent", label: "Highlight", hint: "Offer badges" },
];

const BUTTON_LABEL = { square: "Square", rounded: "Rounded", pill: "Pill" } as const;

export function ThemeEditor({
  id,
  initialName,
  initialTokens,
  options,
  storeName,
  cuisine,
  items,
  storeDiscountText,
}: {
  id: number | null;
  initialName: string;
  initialTokens: ThemeTokens;
  options: ThemeOptions;
  storeName: string;
  cuisine: string;
  items: StoreItem[];
  storeDiscountText: string | null;
}) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveTheme, {});
  const [name, setName] = useState(initialName);
  const [t, setT] = useState<ThemeTokens>(initialTokens);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [removeBanner, setRemoveBanner] = useState(false);

  const set = <K extends keyof ThemeTokens>(k: K, v: ThemeTokens[K]) => setT((prev) => ({ ...prev, [k]: v }));
  const checks = contrastChecks(t);
  const failing = checks.filter((c) => !c.ok);
  const err = state.errors ?? {};
  const shownBanner = removeBanner ? null : (bannerPreview ?? t.bannerUrl ?? null);

  return (
    <form action={action} className="thali mt-6 items-start">
      <input type="hidden" name="id" value={id ?? ""} />
      <input type="hidden" name="bannerUrl" value={t.bannerUrl ?? ""} />
      <input type="hidden" name="removeBanner" value={removeBanner ? "1" : "0"} />

      <div className="span-2 grid gap-2 lg:sticky lg:top-4">
        <section className="katori">
          <label htmlFor="name" className="font-semibold">
            Name of this look
          </label>
          <input id="name" name="name" className="field mt-2" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
          {err.name && <p className="mt-1 text-sm text-danger">{err.name}</p>}
        </section>

        <fieldset className="katori">
          <legend className="sr-only">Colours</legend>
          <p className="font-semibold">Colours</p>
          <div className="mt-3 grid gap-3">
            {COLOR_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-3">
                <input
                  type="color"
                  name={f.key}
                  value={t[f.key] as string}
                  onChange={(e) => set(f.key, e.target.value.toUpperCase() as never)}
                  className="h-10 w-12 shrink-0 cursor-pointer rounded-lg bg-transparent"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{f.label}</span>
                  <span className="block text-xs text-ink-soft">{f.hint}</span>
                </span>
                <code className="text-xs text-ink-soft">{t[f.key] as string}</code>
              </label>
            ))}
          </div>

          <div role="status" aria-live="polite" className={`mt-4 rounded-xl p-3 text-sm ${failing.length ? "bg-tray" : ""}`}>
            {failing.length ? (
              <>
                <p className="font-semibold text-danger">Some text will be hard to read</p>
                <ul className="mt-1 space-y-0.5">
                  {failing.map((c) => (
                    <li key={c.pair}>
                      {c.pair}: {c.ratio.toFixed(1)} to 1. Aim for 4.5 to 1 or more.
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-ink-soft">All text passes the 4.5 to 1 contrast check.</p>
            )}
          </div>
        </fieldset>

        <fieldset className="katori grid gap-4">
          <legend className="sr-only">Shape and type</legend>
          <label className="grid gap-1.5">
            <span className="font-semibold">Font</span>
            <select name="font" className="field" value={t.font} onChange={(e) => set("font", e.target.value)}>
              {options.fonts.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <div>
            <p className="font-semibold">Corners</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {options.radiusOptions.map((r) => (
                <label key={r} className="cursor-pointer">
                  <input type="radio" name="radius" value={r} checked={t.radius === r} onChange={() => set("radius", r)} className="peer sr-only" />
                  <span className="block px-3 py-1.5 text-sm font-semibold shadow-[inset_0_0_0_1.5px_var(--line)] peer-checked:bg-ink peer-checked:text-page peer-focus-visible:outline-2" style={{ borderRadius: r }}>
                    {r === 0 ? "Sharp" : `${r}px`}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="font-semibold">Button shape</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {options.buttonStyles.map((b) => (
                <label key={b} className="cursor-pointer">
                  <input type="radio" name="buttonStyle" value={b} checked={t.buttonStyle === b} onChange={() => set("buttonStyle", b)} className="peer sr-only" />
                  <span
                    className="block px-3 py-1.5 text-sm font-semibold shadow-[inset_0_0_0_1.5px_var(--line)] peer-checked:bg-ink peer-checked:text-page"
                    style={{ borderRadius: b === "pill" ? 999 : b === "rounded" ? 10 : 0 }}
                  >
                    {BUTTON_LABEL[b]}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset className="katori grid gap-3">
          <legend className="sr-only">Banner</legend>
          <p className="font-semibold">Banner</p>
          <label className="grid gap-1 text-sm">
            Headline
            <input name="bannerHeadline" className="field" maxLength={60} value={t.bannerHeadline ?? ""} onChange={(e) => set("bannerHeadline", e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Line under it
            <input name="bannerSubtext" className="field" maxLength={120} value={t.bannerSubtext ?? ""} onChange={(e) => set("bannerSubtext", e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Image (PNG, JPG or WebP, up to 2 MB)
            <input
              type="file"
              name="bannerFile"
              accept="image/png,image/jpeg,image/webp"
              className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-3 file:py-1.5 file:font-semibold file:text-page"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (bannerPreview) URL.revokeObjectURL(bannerPreview);
                setBannerPreview(f ? URL.createObjectURL(f) : null);
                setRemoveBanner(false);
              }}
            />
          </label>
          {err.bannerUrl && <p className="text-sm text-danger">{err.bannerUrl}</p>}
          {(t.bannerUrl || bannerPreview) && !removeBanner && (
            <button type="button" className="justify-self-start text-sm font-semibold underline" onClick={() => setRemoveBanner(true)}>
              Remove image
            </button>
          )}
        </fieldset>

        <fieldset className="katori grid gap-3">
          <legend className="sr-only">Offer badge</legend>
          <p className="font-semibold">Offer badge</p>
          <label className="grid gap-1 text-sm">
            Badge text
            <input name="discountBadgeText" className="field" maxLength={30} placeholder="15% off tonight" value={t.discountBadgeText ?? ""} onChange={(e) => set("discountBadgeText", e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Badge style
            <select name="discountBadgeStyle" className="field" value={t.discountBadgeStyle ?? "pill"} onChange={(e) => set("discountBadgeStyle", e.target.value as ThemeTokens["discountBadgeStyle"])}>
              <option value="pill">Pill</option>
              <option value="ribbon">Ribbon</option>
              <option value="stamp">Stamp</option>
            </select>
          </label>
        </fieldset>

        <section className="katori katori-invert grid gap-3">
          {state.message && (
            <p role="alert" className="text-sm font-semibold">
              {state.message}
            </p>
          )}
          {!id && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="activate" value="1" defaultChecked className="h-4 w-4" />
              Show it to customers as soon as it is saved
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn" disabled={pending}>
              {pending ? "Saving…" : "Save look"}
            </button>
            <Link href="/seller/themes" className="btn btn-quiet" style={{ color: "var(--page)", boxShadow: "inset 0 0 0 1.5px var(--page)" }}>
              Cancel
            </Link>
          </div>
        </section>
      </div>

      <section className="katori span-4 p-2!" aria-label="Live preview">
        <p className="px-3 pb-2 pt-1 text-sm text-ink-soft">Live preview. This is what customers see on your store page.</p>
        <Storefront
          tokens={{ ...t, bannerUrl: shownBanner }}
          storeName={storeName}
          cuisine={cuisine}
          items={items}
          storeDiscountText={storeDiscountText}
          compact
        />
      </section>
    </form>
  );
}
