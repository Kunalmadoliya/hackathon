/**
 * FILE GUIDE
 * Top bar on every page: logo, menu links for your role, who you are, Switch account, White/Dark.
 * Uses: lib/session, app/login/actions (signOut), ./theme-toggle. Used by: app/layout.tsx.
 */
import Link from "next/link";
import { getCurrentUser, type Role } from "@/lib/session";
import { signOut } from "@/app/login/actions";
import { ThemeToggle } from "./theme-toggle";

const NAV: Record<Role, { href: string; label: string }[]> = {
  user: [
    { href: "/", label: "Kitchens" },
    { href: "/cart", label: "Cart" },
    { href: "/orders", label: "Orders" },
    { href: "/leaderboard", label: "Leaderboard" },
  ],
  seller: [
    { href: "/seller", label: "Overview" },
    { href: "/seller/themes", label: "Store look" },
    { href: "/seller/items", label: "Menu" },
    { href: "/leaderboard", label: "Leaderboard" },
  ],
  admin: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/flags", label: "Features" },
    { href: "/admin/metrics", label: "Metrics" },
    { href: "/admin/leaderboard", label: "Leaderboard" },
  ],
};

export function HeaderFrame({ children }: { children?: React.ReactNode }) {
  return (
    <header className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 pt-5">
      <Link href="/" className="font-display text-2xl font-extrabold tracking-tight">
        <span aria-hidden className="mr-1.5 inline-block h-4 w-4 translate-y-px rounded-full bg-ink" />
        Platter
      </Link>
      {children ?? <span className="ml-auto" />}
      <ThemeToggle />
    </header>
  );
}

export async function SiteHeader() {
  const user = await getCurrentUser();
  if (!user) return <HeaderFrame />;
  return (
    <HeaderFrame>
      <nav aria-label="Main" className="flex flex-wrap gap-1">
        {NAV[user.role].map((n) => (
          <Link key={n.href} href={n.href} className="rounded-full px-3 py-1.5 font-medium hover:bg-tray">
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3 text-sm">
        <span className="text-ink-soft">
          Signed in as <strong className="text-ink">{user.name}</strong>
        </span>
        <form action={signOut}>
          <button className="rounded-full px-3 py-1.5 font-semibold shadow-[inset_0_0_0_1.5px_var(--ink)] hover:bg-tray">
            Switch account
          </button>
        </form>
      </div>
    </HeaderFrame>
  );
}
