/**
 * FILE GUIDE
 * Feature console (/admin/flags): the kill switch, the other flag switches, and the EXPERIMENT PANEL
 * (order rate per version, lift, credible interval, chance to be best, Ship to everyone).
 * Uses: lib/flags (current values), lib/flagsmith-admin (results), ./console-forms.
 */
import { Suspense } from "react";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { FLAG, getFlags } from "@/lib/flags";
import {
  adminConfigured,
  dashboardUrl,
  getExperiment,
  getExposures,
  getResults,
  formatCi,
  type Experiment,
  type ParsedResults,
} from "@/lib/flagsmith-admin";
import { FlagSwitch, RefreshResults, ShipWinner } from "./console-forms";

export default function FlagsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-5xl font-bold sm:text-6xl">Features and the experiment</h1>
      <p className="mt-2 max-w-prose text-lg text-ink-soft">
        Every switch here is a Flagsmith flag. Changes go to Flagsmith from the server and reach every customer within seconds,
        with no new release.
      </p>
      <Suspense fallback={<div className="thali mt-6 h-[36rem]" aria-busy="true" />}>
        <Console />
      </Suspense>
    </main>
  );
}

const SWITCHES = [
  { flag: FLAG.sellerThemesEnabled, label: "Seller store looks", description: "Off: every store uses the Platter look, and the theme studio is locked." },
  { flag: FLAG.leaderboardEnabled, label: "Leaderboards", description: "Off: customers and sellers can't open the boards." },
  { flag: FLAG.sellerAbTitlesEnabled, label: "Seller title tests", description: "Off: dishes show their normal title and sellers can't run tests." },
] as const;

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const VARIANT_LABEL: Record<string, string> = { control: "Control, two-step", express: "Express, one-step" };

async function safe<T>(p: Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await p };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function Console() {
  await requireUser("admin");
  const flags = await getFlags(null); // environment values: what everyone gets
  const [exp, results, exposures, local] = await Promise.all([
    adminConfigured ? safe(getExperiment()) : null,
    adminConfigured ? safe(getResults()) : null,
    adminConfigured ? safe(getExposures()) : null,
    db.execute(sql`
      select checkout_variant as variant, count(*)::int as orders, coalesce(sum(total),0)::float as revenue
      from orders where checkout_variant is not null group by checkout_variant order by checkout_variant
    `),
  ]);

  const on: Record<string, boolean> = {
    [FLAG.orderingEnabled]: flags.orderingEnabled,
    [FLAG.sellerThemesEnabled]: flags.sellerThemesEnabled,
    [FLAG.leaderboardEnabled]: flags.leaderboardEnabled,
    [FLAG.sellerAbTitlesEnabled]: flags.sellerAbTitlesEnabled,
  };

  return (
    <div className="thali mt-6 items-start">
      <section className={`katori katori-lg span-2 ${flags.orderingEnabled ? "" : "katori-invert"}`}>
        <h2 className="text-sm font-semibold text-ink-soft">Kill switch</h2>
        <div className="mt-2">
          <FlagSwitch
            flag={FLAG.orderingEnabled}
            label={flags.orderingEnabled ? "Ordering is on" : "Ordering is paused"}
            on={flags.orderingEnabled}
            description="Off: checkout buttons are disabled and the server refuses every order."
          />
        </div>
      </section>

      <section className="katori katori-lg span-4 grid gap-5 sm:grid-cols-2">
        {SWITCHES.map((s) => (
          <FlagSwitch key={s.flag} flag={s.flag} label={s.label} on={on[s.flag]} description={s.description} />
        ))}
        <div>
          <p className="text-lg font-semibold">Store look options</p>
          <p className="text-sm text-ink-soft">
            Fonts: {flags.themeOptions.fonts.join(", ")}. Up to {flags.themeOptions.maxThemesPerSeller} looks per store.
          </p>
          <code className="mt-1 block text-xs text-ink-soft">{FLAG.themeOptions} (remote config)</code>
          <a href={dashboardUrl.flags} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-semibold underline">
            Edit in Flagsmith
          </a>
        </div>
      </section>

      {!adminConfigured ? (
        <section className="katori span-6">
          <p className="font-semibold">Add FLAGSMITH_ADMIN_API_KEY to .env.local to change flags and read results here.</p>
        </section>
      ) : (
        <ExperimentPanel exp={exp} results={results} exposures={exposures} local={local.rows as LocalRow[]} />
      )}

      <p className="span-6 px-2 pb-1 text-sm text-ink-soft">
        Values read from Flagsmith {flags.source === "flagsmith" ? "just now" : "failed, so the app is on safe defaults"}.
      </p>
    </div>
  );
}

type LocalRow = { variant: string; orders: number; revenue: number };
type Safe<T> = { ok: true; value: T } | { ok: false; error: string } | null;

function ExperimentPanel({
  exp,
  results,
  exposures,
  local,
}: {
  exp: Safe<Experiment>;
  results: Safe<{ parsed: ParsedResults; raw: unknown }>;
  exposures: Safe<Record<string, number>>;
  local: LocalRow[];
}) {
  const experiment = exp?.ok ? exp.value : null;
  const parsed = results?.ok ? results.value.parsed : null;
  const stats = parsed?.statistics ?? null;
  const enrolled = exposures?.ok ? exposures.value : {};
  const running = experiment?.status === "running";
  const winner = stats?.winner === "express" || stats?.winner === "control" ? stats.winner : null;

  return (
    <>
      <section className="katori katori-lg katori-invert span-4 row-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink-soft">The experiment</h2>
          {experiment && <span className="rounded-full bg-page px-2.5 py-0.5 text-sm font-semibold text-ink">{experiment.status}</span>}
        </div>
        <p className="mt-2 font-display text-3xl font-bold sm:text-4xl">Does one-step checkout get more orders?</p>
        <p className="mt-2 max-w-prose text-ink-soft">{experiment?.hypothesis ?? "Could not load the experiment from Flagsmith."}</p>

        {parsed && parsed.variants.length > 0 ? (
          <table className="mt-5 w-full text-left">
            <thead className="text-sm text-ink-soft">
              <tr>
                <th className="py-1.5 font-semibold">Version</th>
                <th className="py-1.5 text-right font-semibold">Customers</th>
                <th className="py-1.5 text-right font-semibold">Ordered</th>
                <th className="py-1.5 text-right font-semibold">Order rate</th>
                <th className="py-1.5 text-right font-semibold">Chance to be best</th>
              </tr>
            </thead>
            <tbody>
              {parsed.variants.map((v) => (
                <tr key={v.variant} className="border-t border-current/20">
                  <td className="py-2 font-semibold">{VARIANT_LABEL[v.variant] ?? v.variant}</td>
                  <td className="py-2 text-right tabular-nums">{v.evaluations}</td>
                  <td className="py-2 text-right tabular-nums">{v.conversions}</td>
                  <td className="py-2 text-right tabular-nums">{pct(v.conversion_rate)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {stats?.chance_to_win?.[v.variant] !== undefined ? pct(stats.chance_to_win[v.variant]) : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="mt-5 rounded-2xl bg-page/10 p-4">
            <p className="font-semibold">Collecting data</p>
            <p className="mt-1 text-sm text-ink-soft">
              Flagsmith shows results once each version has about 50 customers. Enrolled so far:{" "}
              {Object.keys(enrolled).length
                ? Object.entries(enrolled)
                    .map(([k, n]) => `${VARIANT_LABEL[k] ?? k} ${n}`)
                    .join(", ")
                : "none yet"}
              .
            </p>
          </div>
        )}

        {stats && (
          <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {stats.lift && (
              <>
                <dt className="text-ink-soft">Lift, express vs control</dt>
                <dd className="font-semibold">{stats.lift}</dd>
              </>
            )}
            {formatCi(stats) && (
              <>
                <dt className="text-ink-soft">95% credible interval of the lift</dt>
                <dd className="font-semibold">{formatCi(stats)}</dd>
              </>
            )}
            {stats.srmPValue != null && stats.srmPValue < 0.01 && (
              <>
                <dt className="text-ink-soft">Warning</dt>
                <dd className="font-semibold">Traffic did not split as planned. Don&rsquo;t act on these results yet.</dd>
              </>
            )}
            {stats.recommendation && (
              <>
                <dt className="text-ink-soft">Recommendation (95% rule)</dt>
                <dd className="font-semibold">{stats.recommendation}</dd>
              </>
            )}
            {stats.sample_size_warning && (
              <>
                <dt className="text-ink-soft">Warning</dt>
                <dd className="font-semibold">{stats.sample_size_warning}</dd>
              </>
            )}
          </dl>
        )}
        {parsed?.asOf && <p className="mt-3 text-xs text-ink-soft">As of {new Date(parsed.asOf).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} India time.</p>}

        <div className="mt-5 flex flex-wrap items-start gap-3">
          <RefreshResults />
          <a href={dashboardUrl.experiment} target="_blank" rel="noreferrer" className="btn">
            Open full results in Flagsmith
          </a>
        </div>
      </section>

      <section className="katori span-2">
        {running ? (
          <ShipWinner recommended={winner} />
        ) : (
          <>
            <h2 className="font-semibold">Ship the winner</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {experiment ? `The experiment is ${experiment.status}, so there's nothing to ship.` : "Experiment not loaded."}
            </p>
          </>
        )}
      </section>

      <section className="katori span-2">
        <h2 className="font-semibold">Orders in the app, by version</h2>
        <p className="text-sm text-ink-soft">From the database, for a sanity check. Flagsmith&rsquo;s numbers above are the result.</p>
        <ul className="mt-2 grid gap-1 text-sm">
          {local.length === 0 && <li>No experiment orders yet.</li>}
          {local.map((r) => (
            <li key={r.variant} className="flex justify-between">
              <span>{VARIANT_LABEL[r.variant] ?? r.variant}</span>
              <span className="tabular-nums">{r.orders} orders</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
