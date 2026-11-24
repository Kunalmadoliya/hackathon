// Client-safe Flagsmith types and defaults (no SDK, no secrets).
export type ThemeOptions = {
  fonts: string[];
  maxThemesPerSeller: number;
  radiusOptions: number[];
  buttonStyles: ("square" | "rounded" | "pill")[];
};

export const DEFAULT_THEME_OPTIONS: ThemeOptions = {
  fonts: ["Inter", "Poppins", "Merriweather", "Space Grotesk"],
  maxThemesPerSeller: 5,
  radiusOptions: [0, 8, 16, 24],
  buttonStyles: ["square", "rounded", "pill"],
};
