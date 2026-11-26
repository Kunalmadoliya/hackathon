/**
 * FILE GUIDE
 * Look helpers (server and browser): contrast ratio, colour variables for a store, text cleaning,
 * and checking a look against theme_options. Used by: studio, storefront, seller actions.
 */
// Theme helpers shared by server and client code (no server-only imports here).
import type { ThemeTokens } from "./db/schema";
import type { ThemeOptions } from "./flags-types";
import type { CSSProperties } from "react";

const HEX = /^#[0-9a-fA-F]{6}$/;

function channel(v: number) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
/** WCAG contrast ratio between two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
  if (!HEX.test(a) || !HEX.test(b)) return 1;
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Text colour (black or white) that reads best on a fill. */
export function onColor(fill: string) {
  return contrastRatio(fill, "#000000") >= contrastRatio(fill, "#ffffff") ? "#000000" : "#ffffff";
}

export type ContrastCheck = { pair: string; ratio: number; ok: boolean };
export function contrastChecks(t: ThemeTokens): ContrastCheck[] {
  return [
    { pair: "Text on background", ratio: contrastRatio(t.text, t.background) },
    { pair: "Text on cards", ratio: contrastRatio(t.text, t.surface) },
    { pair: "Button text on main colour", ratio: contrastRatio(onColor(t.primary), t.primary) },
  ].map((c) => ({ ...c, ok: c.ratio >= 4.5 }));
}

export const BUTTON_RADIUS = { square: "0px", rounded: "10px", pill: "999px" } as const;

/** CSS variables applied on the storefront wrapper only, never on the app. */
export function themeStyle(t: ThemeTokens, fontVar: string): CSSProperties {
  return {
    "--st-primary": t.primary,
    "--st-on-primary": onColor(t.primary),
    "--st-bg": t.background,
    "--st-surface": t.surface,
    "--st-text": t.text,
    "--st-accent": t.accent,
    "--st-on-accent": onColor(t.accent),
    "--st-radius": `${t.radius}px`,
    "--st-btn-radius": BUTTON_RADIUS[t.buttonStyle] ?? BUTTON_RADIUS.rounded,
    "--st-font": fontVar,
  } as CSSProperties;
}

/** Strip tags and control characters, collapse whitespace, cap length. */
export function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return s || null;
}

export type TokenErrors = Partial<Record<keyof ThemeTokens | "name", string>>;

/** Validates raw form values against the Flagsmith theme_options remote config. */
export function parseTokens(
  raw: Record<string, unknown>,
  options: ThemeOptions,
): { tokens: ThemeTokens; name: string; errors: TokenErrors } {
  const errors: TokenErrors = {};
  const color = (k: keyof ThemeTokens) => {
    const v = String(raw[k] ?? "");
    if (!HEX.test(v)) errors[k] = "Use a colour like #1A2B3C.";
    return v.toUpperCase();
  };
  const name = cleanText(raw.name, 40) ?? "";
  if (!name) errors.name = "Give the look a name.";

  const font = String(raw.font ?? "");
  if (!options.fonts.includes(font)) errors.font = "Pick one of the listed fonts.";
  const radius = Number(raw.radius);
  if (!options.radiusOptions.includes(radius)) errors.radius = "Pick one of the listed corner sizes.";
  const buttonStyle = String(raw.buttonStyle ?? "") as ThemeTokens["buttonStyle"];
  if (!options.buttonStyles.includes(buttonStyle)) errors.buttonStyle = "Pick a button shape.";
  const badge = String(raw.discountBadgeStyle ?? "pill") as NonNullable<ThemeTokens["discountBadgeStyle"]>;

  const tokens: ThemeTokens = {
    primary: color("primary"),
    background: color("background"),
    surface: color("surface"),
    text: color("text"),
    accent: color("accent"),
    font,
    radius,
    buttonStyle,
    bannerUrl: typeof raw.bannerUrl === "string" && /^\/uploads\/[a-z0-9-]+\.(png|jpg|webp)$/.test(raw.bannerUrl) ? raw.bannerUrl : null,
    bannerHeadline: cleanText(raw.bannerHeadline, 60),
    bannerSubtext: cleanText(raw.bannerSubtext, 120),
    discountBadgeText: cleanText(raw.discountBadgeText, 30),
    discountBadgeStyle: ["ribbon", "stamp", "pill"].includes(badge) ? badge : "pill",
  };
  return { tokens, name, errors };
}
