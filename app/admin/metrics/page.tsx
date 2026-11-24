import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getAppMetrics } from "@/lib/metrics";
import { adminConfigured, formatCi, getResults } from "@/lib/flagsmith-admin";

export default function MetricsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-5xl font-bold sm:text-6xl">Success metrics</h1>
      <p className="mt-2 max-w-prose text-lg text-ink-soft">
        Only the checkout experiment can say one thing caused another, because Flagsmith assigns customers at random. Everything
        marked <em>descriptive</em> compares sellers who chose different settings, so strong sellers may simply be the ones who
        chose them.
      </p>
      <Suspense fallback={<div className="thali mt-6 h-[36rem]" aria-busy="true" />}>
        <Metrics />
      </Suspense>
    </main>
  );
}

const pct = (num: number, den: number) => (den > 0 ? `${Math.round((num / den) * 100)}%` : "–");

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
      <span className="truncate">{label}</span>
      <span className="h-3 rounded-full bg-tray" aria-hidden>
        <span className="block h-3 rounded-full bg-ink" style={{ width: `${w}%` }} />
      </span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Metric({
  group,
  title,
  value,
  detail,
  kind,
  span = "span-2",
  children,
}: {
  group: string;
  title: string;
  value?: string;
  detail?: string;
  kind: "caused" | "descriptive" | "count";
  span?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={`katori ${span} flex flex-col`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-ink-soft">{group}</p>
        {kind === "descriptive" && <span className="chip-off">Descriptive</span>}
        {kind === "caused" && <span className="chip-on">Randomised</span>}
      </div>
      <h2 className="mt-1 text-lg font-semibold">{title}</h2>
      {value && <p className="mt-2 font-display text-5xl font-extrabold tabular-nums">{value}</p>}
      {detail && <p className="mt-1 text-sm text-ink-soft">{detail}</p>}
      {children && <div className="mt-3 grid gap-2">{children}</div>}
    </section>
  );
}

async function Metrics() {
  await requireUser("admin");
  const [m, results] = await Promise.all([
    getAppMetrics(),
    adminConfigured ? getResults().catch(() => null) : null,
  ]);
  const parsed = results?.parsed ?? null;
  const stats = parsed?.statistics;

  const visitors = m.optOut.reduce((t, r) => t + r.visitors, 0);
  const optedOut = m.optOut.reduce((t, r) => t + r.opted_out, 0);
  const impact = Object.fromEntries(m.themeImpact.map((r) => [r.grp, r]));
  const growth = Object.fromEntries(m.growth.map((r) => [r.grp, r]));
  const growthText = (g?: { this_week: number; last_week: number }) =>
    !g ? "–" : g.last_week > 0 ? `${Math.round(((g.this_week - g.last_week) / g.last_week) * 100)}%` : `${g.this_week} orders`;

  return (
    <div className="thali mt-6 items-start">
      <section className="katori katori-lg katori-invert span-4 row-2">
        <div className="flex items-start justify-between">
          <p className="text-sm text-ink-soft">Experiment: checkout button</p>
          <span className="rounded-full bg-page px-2.5 py-0.5 text-sm font-semibold text-ink">Randomised</span>
        </div>
        <h2 className="mt-1 text-2xl font-semibold">Order rate by checkout version</h2>
        {parsed && parsed.variants.length > 0 ? (
          <>
            <div className="mt-4 grid gap-3">
              {parsed.variants.map((v) => (
                <div key={v.variant}>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{v.variant === "express" ? "Express, one-step" : "Control, two-step"}</span>
                    <span className="tabular-nums">
                      {(v.conversion_rate * 100).toFixed(1)}% of {v.evaluations}
                    </span>
                  </div>
                  <span className="mt-1 block h-4 rounded-full bg-page/20" aria-hidden>
                    <span className="block h-4 rounded-full bg-page" style={{ width: `${Math.max(2, v.conversion_rate * 100)}%` }} />
                  </span>
                </div>
              ))}
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-ink-soft">Lift</dt>
                <dd className="font-display text-4xl font-extrabold">{stats?.lift ?? "–"}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-soft">Chance express is best</dt>
                <dd className="font-display text-4xl font-extrabold">
                  {stats?.chance_to_win?.express !== undefined ? `${Math.round(stats.chance_to_win.express * 100)}%` : "–"}
                </dd>
              </div>
            </dl>
            {stats && formatCi(stats) && <p className="mt-2 text-sm text-ink-soft">95% credible interval of the lift: {formatCi(stats)}.</p>}
          </>
        ) : (
          <p className="mt-3 text-ink-soft">
            Flagsmith is still collecting data. Results appear once each version has about 50 customers.
          </p>
        )}
        <Link href="/admin/flags" className="btn mt-5">
          Experiment details
        </Link>
      </section>

      <Metric
        group="Theme adoption"
        title="Sellers with their own look"
        kind="count"
        value={pct(m.themeAdoption.with_custom, m.themeAdoption.sellers)}
        detail={`${m.themeAdoption.with_custom} of ${m.themeAdoption.sellers} sellers have made at least one look.`}
      />
      <Metric
        group="Leaderboard"
        title="Sellers showing their name"
        kind="count"
        value={pct(m.visibility.visible, m.visibility.sellers)}
        detail={`${m.visibility.visible} of ${m.visibility.sellers} sellers.`}
      />

      <Metric group="Theme health" title="Customers who turned a store's look off" kind="count" span="span-3" value={pct(optedOut, visitors)} detail={`${optedOut} of ${visitors} store visitors, counted per store.`}>
        {m.optOut.map((r) => (
          <Bar key={r.store_name} label={r.store_name} value={r.opted_out} max={Math.max(1, ...m.optOut.map((x) => x.visitors))} />
        ))}
      </Metric>
      <Metric
        group="Theme impact"
        title="Orders per store visit, own look vs Platter look"
        kind="descriptive"
        span="span-3"
        detail="Counted since store visits started being recorded."
      >
        {(["custom", "default"] as const).map((g) => (
          <p key={g} className="flex justify-between text-sm">
            <span>{g === "custom" ? "Stores with their own look" : "Stores on a Platter look"}</span>
            <span className="font-semibold tabular-nums">
              {impact[g] ? `${pct(impact[g].orders, impact[g].visits)} (${impact[g].orders} orders, ${impact[g].visits} visits)` : "–"}
            </span>
          </p>
        ))}
      </Metric>

      <Metric
        group="Leaderboard"
        title="Board views"
        kind="count"
        value={String(m.boardViews.views)}
        detail={`From ${m.boardViews.viewers} different people.`}
      />
      <Metric group="Leaderboard" title="Order growth this week vs last" kind="descriptive" detail="Sellers with their name shown vs hidden.">
        <p className="flex justify-between text-sm">
          <span>Name shown</span>
          <span className="font-semibold">{growthText(growth.shown)}</span>
        </p>
        <p className="flex justify-between text-sm">
          <span>Name hidden</span>
          <span className="font-semibold">{growthText(growth.hidden)}</span>
        </p>
      </Metric>
      <Metric
        group="Title tests"
        title="Seller title tests"
        kind="descriptive"
        value={String(m.titleTests.run)}
        detail={`${m.titleTests.completed} finished. Average uplift of the winning title: ${
          m.titleTests.avg_uplift !== null ? `${Math.round(m.titleTests.avg_uplift * 100)}%` : "not enough data yet"
        }.`}
      />

      <Metric
        group="Guardrail"
        title="Orders going to the top 3 sellers"
        kind="count"
        span="span-6"
        value={pct(m.topShare.top3, m.topShare.total)}
        detail={`${m.topShare.top3} of ${m.topShare.total} orders in the last 30 days.${
          m.topShare.sellers <= 3 ? " With only 3 sellers on Platter this is always 100%; it becomes useful as more kitchens join." : ""
        }`}
      />
    </div>
  );
}
