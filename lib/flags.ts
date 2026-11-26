/**
 * FILE GUIDE
 * THE FLAGSMITH CONNECTION (Node SDK, server only). Reads flags for a user, works out the checkout
 * version, records exposures, sends events (add_to_cart, checkout_started, order_placed), flushes them.
 * If Flagsmith is down it returns safe defaults. Used by: almost every page and action.
 */
import "server-only";
import { Flagsmith, DefaultFlag, type Flag, type Flags } from "@flagsmith/nodejs";

/**
 * Server-side Flagsmith access. Signatures follow @flagsmith/nodejs 9.5 type
 * definitions and https://docs.flagsmith.com/experimentation/run-an-experiment.
 * Flagsmith decides what is allowed; the database remembers what people chose.
 */

export const FLAG = {
  checkoutButton: "checkout_button",
  orderingEnabled: "ordering_enabled",
  sellerThemesEnabled: "seller_themes_enabled",
  themeOptions: "theme_options",
  leaderboardEnabled: "leaderboard_enabled",
  sellerAbTitlesEnabled: "seller_ab_titles_enabled",
} as const;

export const EVENT = {
  orderPlaced: "order_placed",
  addToCart: "add_to_cart",
  checkoutStarted: "checkout_started",
} as const;

export type CheckoutVariant = "control" | "express";

import { DEFAULT_THEME_OPTIONS, type ThemeOptions } from "./flags-types";
export { DEFAULT_THEME_OPTIONS, type ThemeOptions };

// Safe defaults when Flagsmith cannot be reached (PRD 5.2).
const DEFAULTS: Record<string, { enabled: boolean; value: string | null }> = {
  [FLAG.checkoutButton]: { enabled: true, value: "control" },
  [FLAG.orderingEnabled]: { enabled: true, value: null },
  [FLAG.sellerThemesEnabled]: { enabled: true, value: null },
  [FLAG.leaderboardEnabled]: { enabled: true, value: null },
  [FLAG.sellerAbTitlesEnabled]: { enabled: true, value: null },
  [FLAG.themeOptions]: { enabled: true, value: JSON.stringify(DEFAULT_THEME_OPTIONS) },
};

export const flagsmithConfigured = Boolean(process.env.FLAGSMITH_SERVER_KEY);

const globalForFs = globalThis as unknown as { flagsmith?: Flagsmith };

function client(): Flagsmith | null {
  if (!flagsmithConfigured) return null;
  if (!globalForFs.flagsmith) {
    globalForFs.flagsmith = new Flagsmith({
      environmentKey: process.env.FLAGSMITH_SERVER_KEY!,
      enableEvents: true,
      requestTimeoutSeconds: 3,
      defaultFlagHandler: (name) => {
        const d = DEFAULTS[name];
        return new DefaultFlag(d?.value ?? null, d?.enabled ?? false);
      },
    });
  }
  return globalForFs.flagsmith;
}

export const identifierFor = (userId: number) => `user_${userId}`;

export type FlagSnapshot = {
  orderingEnabled: boolean;
  sellerThemesEnabled: boolean;
  leaderboardEnabled: boolean;
  sellerAbTitlesEnabled: boolean;
  themeOptions: ThemeOptions;
  source: "flagsmith" | "defaults";
};

function parseThemeOptions(raw: unknown): ThemeOptions {
  if (typeof raw !== "string" || !raw) return DEFAULT_THEME_OPTIONS;
  try {
    const parsed = JSON.parse(raw) as Partial<ThemeOptions>;
    return { ...DEFAULT_THEME_OPTIONS, ...parsed };
  } catch {
    return DEFAULT_THEME_OPTIONS;
  }
}

function snapshotFrom(flags: Flags | null): FlagSnapshot {
  const on = (k: string) => (flags ? flags.isFeatureEnabled(k) : DEFAULTS[k].enabled);
  return {
    orderingEnabled: on(FLAG.orderingEnabled),
    sellerThemesEnabled: on(FLAG.sellerThemesEnabled),
    leaderboardEnabled: on(FLAG.leaderboardEnabled),
    sellerAbTitlesEnabled: on(FLAG.sellerAbTitlesEnabled),
    themeOptions: parseThemeOptions(
      flags ? flags.getFeatureValue(FLAG.themeOptions) : DEFAULTS[FLAG.themeOptions].value,
    ),
    source: flags ? "flagsmith" : "defaults",
  };
}

/** Flags for a signed-in person (identity), or environment flags when anonymous. */
export async function getFlags(user?: { id: number; role: string } | null): Promise<FlagSnapshot> {
  const fs = client();
  if (!fs) return snapshotFrom(null);
  try {
    const flags = user
      ? await fs.getIdentityFlags(identifierFor(user.id), { role: user.role })
      : await fs.getEnvironmentFlags();
    return snapshotFrom(flags);
  } catch (err) {
    console.warn("[flagsmith] falling back to defaults:", (err as Error).message);
    return snapshotFrom(null);
  }
}

export type CheckoutAssignment = { variant: CheckoutVariant; inExperiment: boolean };

/**
 * Evaluates checkout_button WITHOUT recording an exposure (deferred pattern from
 * docs.flagsmith.com/experimentation/run-an-experiment). Server renders and
 * prefetches call this; the exposure is recorded by recordCheckoutExposure only
 * when the cart is actually on screen.
 */
export async function getCheckoutAssignment(user: { id: number; role: string }): Promise<CheckoutAssignment> {
  const fs = client();
  if (!fs) return { variant: "control", inExperiment: false };
  try {
    const flags = await fs.getIdentityFlags(identifierFor(user.id), { role: user.role });
    const flag = flags.getFlag(FLAG.checkoutButton) as Flag;
    const key = flag.variant || (typeof flag.value === "string" ? flag.value : undefined);
    return { variant: key === "express" ? "express" : "control", inExperiment: Boolean(flag.experiment?.inExperiment) };
  } catch (err) {
    console.warn("[flagsmith] checkout_button fallback:", (err as Error).message);
    return { variant: "control", inExperiment: false };
  }
}

/** Records the exposure for an enrolled identity. Safe to repeat: Flagsmith counts each identity once. */
export async function recordCheckoutExposure(user: { id: number; role: string }): Promise<CheckoutAssignment> {
  const a = await getCheckoutAssignment(user);
  const fs = client();
  if (fs && a.inExperiment) {
    try {
      fs.trackExposureEvent(FLAG.checkoutButton, { identifier: identifierFor(user.id), value: a.variant });
    } catch (err) {
      console.warn("[flagsmith] trackExposureEvent failed:", (err as Error).message);
    }
  }
  return a;
}

/** Sends an experiment event. Event names are case-sensitive and must match the metric. */
export function trackEvent(name: (typeof EVENT)[keyof typeof EVENT], userId: number, value?: number) {
  const fs = client();
  if (!fs) return;
  try {
    fs.trackEvent(name, { identifier: identifierFor(userId), value });
  } catch (err) {
    console.warn("[flagsmith] trackEvent failed:", (err as Error).message);
  }
}

/** Flush buffered events, e.g. from next/server `after()` so the response is not delayed. */
export async function flushEvents() {
  const fs = client();
  if (fs) await fs.flushEvents().catch(() => {});
}
