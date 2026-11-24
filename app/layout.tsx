import type { Metadata } from "next";
import { Suspense } from "react";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { SiteHeader, HeaderFrame } from "@/components/site-header";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"] });

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("platter-theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export const metadata: Metadata = {
  title: "Platter",
  description: "Order from local kitchens. Every store sets its own look.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${bricolage.variable} ${instrument.variable} antialiased`}
    >
      <head>
        {/* Applies the saved white/dark choice before first paint (Next.js guide: preventing flash before hydration). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh pb-16">
        <Suspense fallback={<HeaderFrame />}>
          <SiteHeader />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
