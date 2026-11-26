/**
 * FILE GUIDE
 * The 3 Platter looks (Classic, Night, Fresh). Used by: the seed script and the theme resolver.
 */
import type { ThemeTokens } from "./db/schema.ts";

// Platform default themes (PRD section 7). Shared by the seed script and the app.
export const PLATFORM_THEMES: { name: string; tokens: ThemeTokens }[] = [
  {
    name: "Classic",
    tokens: {
      primary: "#C2410C",
      background: "#FFFFFF",
      surface: "#F8F5F2",
      text: "#1F2937",
      accent: "#FBBF24",
      font: "Inter",
      radius: 8,
      buttonStyle: "rounded",
      bannerHeadline: null,
      bannerSubtext: null,
      discountBadgeText: null,
      discountBadgeStyle: "pill",
    },
  },
  {
    name: "Night",
    tokens: {
      primary: "#F59E0B",
      background: "#111827",
      surface: "#1F2937",
      text: "#F9FAFB",
      accent: "#FCD34D",
      font: "Space Grotesk",
      radius: 16,
      buttonStyle: "pill",
      bannerHeadline: null,
      bannerSubtext: null,
      discountBadgeText: null,
      discountBadgeStyle: "pill",
    },
  },
  {
    name: "Fresh",
    tokens: {
      primary: "#15803D",
      background: "#F0FDF4",
      surface: "#FFFFFF",
      text: "#14532D",
      accent: "#84CC16",
      font: "Poppins",
      radius: 24,
      buttonStyle: "pill",
      bannerHeadline: null,
      bannerSubtext: null,
      discountBadgeText: null,
      discountBadgeStyle: "ribbon",
    },
  },
];

export const FALLBACK_THEME = PLATFORM_THEMES[0];
