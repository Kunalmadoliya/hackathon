/**
 * FILE GUIDE
 * Login page (/login): pick a demo account. No passwords, it's a demo.
 * Uses: lib/db (list of accounts), ./actions (signInAs).
 */
import { Suspense } from "react";
import { connection } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { signInAs } from "./actions";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-5xl font-bold sm:text-6xl">Pick who you are</h1>
      <p className="mt-3 max-w-prose text-lg text-ink-soft">
        This is a demo, so there are no passwords. Choose an account to see the app the way that person sees it.
      </p>
      <Suspense fallback={<div className="thali mt-8 h-80" aria-busy="true" />}>
        <Accounts />
      </Suspense>
    </main>
  );
}

const ROLE_COPY = {
  user: { title: "Hungry people", body: "Browse kitchens, switch store themes off, and order." },
  seller: { title: "Kitchens", body: "Design your store, manage your menu, and test item titles." },
  admin: { title: "Running the marketplace", body: "Kill switches, experiment results, leaderboards." },
} as const;

async function Accounts() {
  await connection();
  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      nickname: schema.users.nickname,
      role: schema.users.role,
      storeName: schema.sellers.storeName,
    })
    .from(schema.users)
    .leftJoin(schema.sellers, eq(schema.sellers.userId, schema.users.id))
    .orderBy(asc(schema.users.id));

  if (rows.length === 0) {
    return (
      <div className="katori mt-8">
        <p className="font-semibold">No accounts yet.</p>
        <p className="mt-1 text-ink-soft">
          Run <code className="rounded bg-tray px-1.5 py-0.5">npm run db:seed</code> to add the demo accounts, then reload.
        </p>
      </div>
    );
  }

  const groups = (["user", "seller", "admin"] as const).map((role) => ({ role, people: rows.filter((r) => r.role === role) }));

  return (
    <div className="thali mt-8">
      {groups.map(({ role, people }) => (
        <section
          key={role}
          className={`katori katori-lg ${role === "user" ? "span-3 row-2" : "span-3"}`}
          aria-labelledby={`role-${role}`}
        >
          <h2 id={`role-${role}`} className="text-2xl font-semibold">
            {ROLE_COPY[role].title}
          </h2>
          <p className="mt-1 text-ink-soft">{ROLE_COPY[role].body}</p>
          <ul className="mt-4 grid gap-2">
            {people.map((p) => (
              <li key={p.id}>
                <form action={signInAs}>
                  <input type="hidden" name="userId" value={p.id} />
                  <button
                    type="submit"
                    className="flex w-full items-center justify-between gap-3 rounded-xl bg-cell px-4 py-3 text-left shadow-[inset_0_0_0_1.5px_var(--line)] hover:shadow-[inset_0_0_0_2px_var(--ink)]"
                  >
                    <span>
                      <span className="block font-semibold">{p.storeName ?? p.name}</span>
                      <span className="block text-sm text-ink-soft">
                        {role === "seller" ? p.name : role === "user" ? `Shows on boards as ${p.nickname}` : "Admin"}
                      </span>
                    </span>
                    <span className="text-sm font-semibold">Sign in</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
