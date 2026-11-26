/**
 * FILE GUIDE
 * Theme studio list (/seller/themes): your looks and the 3 Platter looks. Make live, copy, delete.
 * Locked when the seller_themes_enabled flag is off.
 * Uses: lib/store-data, lib/theme (contrast check), ./actions.
 */
import { Suspense } from "react";
import Link from "next/link";
import { requireSeller } from "@/lib/session";
import { getFlags } from "@/lib/flags";
import { getStore } from "@/lib/store-data";
import { contrastChecks } from "@/lib/theme";
import type { ThemeTokens } from "@/lib/db/schema";
import { activateTheme, deleteTheme, resetToDefault } from "./actions";

export default function ThemesPage({ searchParams }: PageProps<"/seller/themes">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<div className="thali mt-6 h-96" aria-busy="true" />}>
        <Studio searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function Swatches({ t }: { t: ThemeTokens }) {
  return (
    <div className="flex h-20 overflow-hidden rounded-xl" style={{ background: t.background }} aria-hidden>
      <div className="flex w-2/3 flex-col justify-end p-3" style={{ background: t.primary }}>
        <span className="h-2 w-16 rounded-full" style={{ background: t.accent }} />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <span className="px-2 py-1 text-xs font-bold" style={{ background: t.surface, color: t.text, borderRadius: t.radius / 2 }}>
          Aa
        </span>
      </div>
    </div>
  );
}

async function Studio({ searchParams }: { searchParams: PageProps<"/seller/themes">["searchParams"] }) {
  const me = await requireSeller();
  const [flags, store, sp] = await Promise.all([getFlags(me), getStore(me.sellerId), searchParams]);
  if (!store) return null;
  const activeId = store.seller.activeThemeId;
  const max = flags.themeOptions.maxThemesPerSeller;
  const full = store.ownThemes.length >= max;

  if (!flags.sellerThemesEnabled) {
    return (
      <>
        <h1 className="text-5xl font-bold">Store look</h1>
        <div className="thali mt-6">
          <section className="katori katori-lg katori-invert span-6" role="status">
            <h2 className="text-2xl font-semibold">The theme studio is switched off right now</h2>
            <p className="mt-2 max-w-prose text-ink-soft">
              Platter has paused custom store looks for everyone, so customers see the default look. Your saved looks are kept and
              come back when the studio is switched on again.
            </p>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl font-bold sm:text-6xl">Store look</h1>
          <p className="mt-2 max-w-prose text-lg text-ink-soft">
            Pick how {store.seller.storeName} looks to customers. Start from a Platter look or one of yours.
          </p>
        </div>
        {full ? (
          <p className="text-sm text-ink-soft">You have {max} of {max} looks. Delete one to make a new one.</p>
        ) : (
          <Link href="/seller/themes/new" className="btn">
            New look
          </Link>
        )}
      </div>

      {sp.saved && (
        <p role="status" className="mt-4 font-semibold">
          Look saved.
        </p>
      )}
      {sp.error === "active" && (
        <p role="alert" className="mt-4 font-semibold text-danger">
          That look is live, so it can&rsquo;t be deleted. Make another one live first.
        </p>
      )}

      <div className="thali mt-6">
        <section className="katori katori-lg span-6">
          <h2 className="text-xl font-semibold">Your looks</h2>
          {store.ownThemes.length === 0 ? (
            <p className="mt-2 text-ink-soft">No looks of your own yet. Copy a Platter look below, or start a new one.</p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {store.ownThemes.map((t) => {
                const live = t.id === activeId;
                const weak = contrastChecks(t.tokens).some((c) => !c.ok);
                return (
                  <li key={t.id} className={`rounded-2xl p-3 ${live ? "shadow-[inset_0_0_0_2px_var(--ink)]" : "shadow-[inset_0_0_0_1px_var(--line)]"}`}>
                    <Swatches t={t.tokens} />
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="font-semibold">{t.name}</p>
                      {live && <span className="chip-on">Live</span>}
                    </div>
                    <p className="text-sm text-ink-soft">
                      {t.tokens.font}
                      {weak ? ". Some text is hard to read" : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm">
                      <Link href={`/seller/themes/${t.id}`} className="btn btn-quiet min-h-9! px-3!">
                        Edit
                      </Link>
                      {!live && (
                        <form action={activateTheme}>
                          <input type="hidden" name="id" value={t.id} />
                          <button className="btn min-h-9! px-3!">Make live</button>
                        </form>
                      )}
                      {!full && (
                        <Link href={`/seller/themes/new?from=${t.id}`} className="btn btn-quiet min-h-9! px-3!">
                          Copy
                        </Link>
                      )}
                      {!live && (
                        <form action={deleteTheme}>
                          <input type="hidden" name="id" value={t.id} />
                          <button className="min-h-9 px-2 font-semibold text-danger underline">Delete</button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {store.defaultThemes.map((t) => {
          const live = t.id === activeId || (activeId === null && t.name === "Classic");
          return (
            <section key={t.id} className="katori span-2">
              <Swatches t={t.tokens} />
              <div className="mt-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t.name}</h2>
                {live && <span className="chip-on">Live</span>}
              </div>
              <p className="text-sm text-ink-soft">Platter look. You can&rsquo;t edit it, but you can copy it.</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {!live && (
                  <form action={resetToDefault}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="btn min-h-9! px-3!">Use {t.name}</button>
                  </form>
                )}
                {!full && (
                  <Link href={`/seller/themes/new?from=${t.id}`} className="btn btn-quiet min-h-9! px-3!">
                    Copy and edit
                  </Link>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
