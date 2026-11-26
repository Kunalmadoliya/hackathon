/**
 * FILE GUIDE
 * Decides which look a store shows, first match wins: flag off, customer opted out, seller's look, default.
 * Used by: the store page and recordStoreView.
 */
import "server-only";
import { and, eq, isNull, or } from "drizzle-orm";
import { db, schema } from "./db";
import type { ThemeTokens } from "./db/schema";
import type { FlagSnapshot } from "./flags";
import { FALLBACK_THEME } from "./themes-default";

const { themes, userPrefs } = schema;

export type ThemeReason = "flag_off" | "user_store_off" | "user_global_off" | "seller" | "no_theme";

export async function getThemePrefs(userId: number, sellerId: number) {
  const rows = await db
    .select()
    .from(userPrefs)
    .where(and(eq(userPrefs.userId, userId), or(eq(userPrefs.sellerId, sellerId), isNull(userPrefs.sellerId))));
  const store = rows.find((r) => r.sellerId === sellerId);
  const global = rows.find((r) => r.sellerId === null);
  return {
    useStoreTheme: store ? store.useSellerTheme : true,
    // The global row stores "use seller themes"; false means "always use the default".
    alwaysDefault: global ? !global.useSellerTheme : false,
  };
}

/** PRD section 7: which theme a storefront uses. First match wins. */
export async function resolveStoreTheme(opts: {
  flags: FlagSnapshot;
  userId: number;
  sellerId: number;
  activeThemeId: number | null;
}): Promise<{ tokens: ThemeTokens; reason: ThemeReason; prefs: Awaited<ReturnType<typeof getThemePrefs>> }> {
  const prefs = await getThemePrefs(opts.userId, opts.sellerId);
  const platformDefault = async () => {
    const [t] = await db
      .select()
      .from(themes)
      .where(and(isNull(themes.sellerId), eq(themes.isDefault, true), eq(themes.name, FALLBACK_THEME.name)))
      .limit(1);
    return t?.tokens ?? FALLBACK_THEME.tokens;
  };

  if (!opts.flags.sellerThemesEnabled) return { tokens: await platformDefault(), reason: "flag_off", prefs };
  if (prefs.alwaysDefault) return { tokens: await platformDefault(), reason: "user_global_off", prefs };
  if (!prefs.useStoreTheme) return { tokens: await platformDefault(), reason: "user_store_off", prefs };
  if (opts.activeThemeId) {
    const [t] = await db.select().from(themes).where(eq(themes.id, opts.activeThemeId)).limit(1);
    // Only the seller's own look or a platform default may be live for a store.
    if (t && (t.sellerId === opts.sellerId || (t.sellerId === null && t.isDefault))) {
      return { tokens: t.tokens, reason: "seller", prefs };
    }
  }
  return { tokens: await platformDefault(), reason: "no_theme", prefs };
}
