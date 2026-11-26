/**
 * FILE GUIDE
 * Draws a store: banner, offer badge, sections and dishes, in the seller's colours (CSS variables)
 * or in the black-and-white Platter look. Used by: the store page AND the theme editor preview.
 * Uses: lib/theme (colour variables), lib/store-fonts.
 */
import type { ThemeTokens } from "@/lib/db/schema";
import { themeStyle } from "@/lib/theme";
import { STORE_FONT_CLASSES, fontVar } from "@/lib/store-fonts";

export type StoreItem = {
  id: number | string;
  title: string;
  description: string;
  price: number;
  category: string;
  discountPercent: number;
  available?: boolean;
};

// The Platter look uses the app tokens, so it is white or dark with the rest of the app.
const PLATTER_LOOK = {
  "--st-primary": "var(--ink)",
  "--st-on-primary": "var(--page)",
  "--st-bg": "var(--cell)",
  "--st-surface": "var(--tray)",
  "--st-text": "var(--ink)",
  "--st-accent": "var(--ink)",
  "--st-on-accent": "var(--page)",
  "--st-radius": "16px",
  "--st-btn-radius": "999px",
  "--st-font": "var(--font-instrument)",
  "--st-header": "var(--tray)",
  "--st-on-header": "var(--ink)",
} as React.CSSProperties;

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

/**
 * A seller's storefront drawn with their theme tokens. Tokens are applied as CSS
 * variables on this wrapper only (PRD section 7). Used by the theme studio preview
 * and by the real storefront.
 */
export function Storefront({
  tokens,
  storeName,
  cuisine,
  items,
  storeDiscountText,
  itemAction,
  toolbar,
  compact = false,
  platterLook = false,
}: {
  tokens: ThemeTokens;
  storeName: string;
  cuisine: string;
  items: StoreItem[];
  storeDiscountText?: string | null;
  itemAction?: (item: StoreItem) => React.ReactNode;
  toolbar?: React.ReactNode;
  compact?: boolean;
  /** The Platter look: follows the app white/dark theme instead of seller colours. */
  platterLook?: boolean;
}) {
  const categories = [...new Set(items.map((i) => i.category))];
  const badge = tokens.discountBadgeText || storeDiscountText;
  const badgeStyle = tokens.discountBadgeStyle ?? "pill";

  return (
    <div
      className={`${STORE_FONT_CLASSES} storefront overflow-hidden`}
      style={{
        ...themeStyle(tokens, fontVar(tokens.font)),
        ...(platterLook ? PLATTER_LOOK : {}),
        background: "var(--st-bg)",
        color: "var(--st-text)",
        fontFamily: "var(--st-font)",
        borderRadius: "calc(var(--st-radius) + 8px)",
      }}
    >
      <header
        className={`relative ${compact ? "p-5" : "p-6 sm:p-10"}`}
        style={{
          background: tokens.bannerUrl
            ? `linear-gradient(0deg, rgb(0 0 0 / 0.55), rgb(0 0 0 / 0.15)), url(${tokens.bannerUrl}) center / cover`
            : "var(--st-header, var(--st-primary))",
          color: tokens.bannerUrl ? "#ffffff" : "var(--st-on-header, var(--st-on-primary))",
        }}
      >
        {toolbar && <div className="mb-4 flex justify-end">{toolbar}</div>}
        <p className="text-sm font-semibold opacity-85">{cuisine}</p>
        <h2 className={`${compact ? "text-3xl" : "text-4xl sm:text-6xl"} mt-1 font-bold`} style={{ fontFamily: "var(--st-font)" }}>
          {storeName}
        </h2>
        {(tokens.bannerHeadline || tokens.bannerSubtext) && (
          <div className="mt-4 max-w-xl">
            {tokens.bannerHeadline && <p className={`${compact ? "text-lg" : "text-2xl"} font-semibold`}>{tokens.bannerHeadline}</p>}
            {tokens.bannerSubtext && <p className="mt-1 opacity-90">{tokens.bannerSubtext}</p>}
          </div>
        )}
        {badge && (
          <p
            className={`mt-5 inline-block px-4 py-1.5 font-bold ${
              badgeStyle === "stamp" ? "-rotate-3 border-2 border-dashed" : ""
            }`}
            style={{
              background: badgeStyle === "stamp" ? "transparent" : "var(--st-accent)",
              color: badgeStyle === "stamp" ? "inherit" : "var(--st-on-accent)",
              borderColor: "currentColor",
              borderRadius: badgeStyle === "pill" ? "999px" : badgeStyle === "ribbon" ? "0 999px 999px 0" : "6px",
            }}
          >
            {badge}
          </p>
        )}
      </header>

      <div className={compact ? "space-y-5 p-5" : "space-y-8 p-6 sm:p-10"}>
        {categories.map((cat) => (
          <section key={cat}>
            <h3 className="text-xl font-bold" style={{ fontFamily: "var(--st-font)" }}>
              {cat}
            </h3>
            <ul className={`mt-3 grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
              {items
                .filter((i) => i.category === cat)
                .map((item) => {
                  const final = item.discountPercent ? Math.round(item.price * (1 - item.discountPercent / 100)) : item.price;
                  return (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-4 p-4"
                      style={{ background: "var(--st-surface)", borderRadius: "var(--st-radius)", opacity: item.available === false ? 0.5 : 1 }}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold">{item.title}</p>
                        <p className="mt-0.5 text-sm opacity-75">{item.description}</p>
                        <p className="mt-2 font-semibold">
                          {inr(final)}
                          {item.discountPercent > 0 && (
                            <>
                              <s className="ml-2 text-sm font-normal opacity-60">{inr(item.price)}</s>
                              <span
                                className="ml-2 rounded-full px-2 py-0.5 text-xs font-bold"
                                style={{ background: "var(--st-accent)", color: "var(--st-on-accent)" }}
                              >
                                {item.discountPercent}% off
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      {itemAction ? (
                        itemAction(item)
                      ) : (
                        <span
                          className="shrink-0 px-4 py-2 text-sm font-semibold"
                          style={{ background: "var(--st-primary)", color: "var(--st-on-primary)", borderRadius: "var(--st-btn-radius)" }}
                        >
                          Add
                        </span>
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
