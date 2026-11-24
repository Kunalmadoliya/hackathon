import { Inter, Poppins, Merriweather, Space_Grotesk } from "next/font/google";

// Fonts sellers may pick. The allowed list itself comes from Flagsmith (theme_options);
// a font only renders if it is also loaded here.
const inter = Inter({ variable: "--font-store-inter", subsets: ["latin"] });
const poppins = Poppins({ variable: "--font-store-poppins", subsets: ["latin"], weight: ["400", "600", "700"] });
const merriweather = Merriweather({ variable: "--font-store-merriweather", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-store-space-grotesk", subsets: ["latin"] });

export const STORE_FONT_CLASSES = [inter, poppins, merriweather, spaceGrotesk].map((f) => f.variable).join(" ");

const FONT_VARS: Record<string, string> = {
  Inter: "var(--font-store-inter)",
  Poppins: "var(--font-store-poppins)",
  Merriweather: "var(--font-store-merriweather)",
  "Space Grotesk": "var(--font-store-space-grotesk)",
};

export function fontVar(name: string) {
  return FONT_VARS[name] ?? FONT_VARS.Inter;
}
