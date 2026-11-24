// Simulated traffic for the checkout_button experiment.
//
// THIS TRAFFIC IS SIMULATED. Each simulated customer is a new Flagsmith identity.
// Flagsmith assigns the checkout version; this script then behaves like a customer
// with the conversion rates below. The same rates are printed on every run and are
// listed in the README, so the result can be read honestly: Flagsmith should find
// roughly the lift that was put in, with its own uncertainty.
//
// Usage: npm run simulate -- [--users 600] [--seed 42] [--dry-run]

import { Flagsmith, type Flag } from "@flagsmith/nodejs";

// ---- Simulation config (edit these, they are printed on every run) -------------
const CONFIG = {
  // Sample size from a power calculation: 33.0% vs 40.3% at 95% confidence and 80% power needs
  // about 680 cart viewers per version, so about 2,000 customers in total (70% reach the cart).
  users: 2000,
  seed: 20261126,
  concurrency: 8,
  // Share of customers who add a dish and see the cart (same for both versions).
  addToCart: 0.7,
  // Of customers who see the cart: share who start checkout, then share who finish.
  // Control has two steps (review page), so more people drop between start and order.
  rates: {
    control: { startCheckout: 0.6, completeOrder: 0.55 }, // 0.60 * 0.55 = 33.0% of cart viewers order
    express: { startCheckout: 0.62, completeOrder: 0.65 }, // 0.62 * 0.65 = 40.3% of cart viewers order (+22% relative)
  },
  // Order totals in rupees, uniform between these values.
  orderValue: { min: 180, max: 900 },
};
// ----------------------------------------------------------------------------------

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const users = Number(arg("users") ?? CONFIG.users);
const seed = Number(arg("seed") ?? CONFIG.seed);
const dryRun = args.includes("--dry-run");

if (!process.env.FLAGSMITH_SERVER_KEY) {
  console.error("Set FLAGSMITH_SERVER_KEY in .env.local (run with: npm run simulate).");
  process.exit(1);
}

// Mulberry32: small seeded random generator, so a run can be repeated exactly.
function rng(s: number) {
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(seed);

const runId = `${seed}-${Date.now().toString(36)}`;
const flagsmith = new Flagsmith({ environmentKey: process.env.FLAGSMITH_SERVER_KEY, enableEvents: true });

type Variant = "control" | "express";
const tally = {
  control: { customers: 0, enrolled: 0, carts: 0, checkouts: 0, orders: 0 },
  express: { customers: 0, enrolled: 0, carts: 0, checkouts: 0, orders: 0 },
};
let errors = 0;

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
console.log("Platter traffic simulator. THIS TRAFFIC IS SIMULATED.");
console.log(`Run ${runId}: ${users} customers, seed ${seed}${dryRun ? ", dry run (no events sent)" : ""}`);
for (const v of ["control", "express"] as const) {
  const r = CONFIG.rates[v];
  console.log(
    `  ${v.padEnd(8)} add to cart ${pct(CONFIG.addToCart)}, start checkout ${pct(r.startCheckout)}, complete ${pct(r.completeOrder)}` +
      ` -> expected order rate ${pct(r.startCheckout * r.completeOrder)} of cart viewers (what Flagsmith measures)`,
  );
}

// Decide each customer's behaviour up front so results do not depend on network timing.
const plans = Array.from({ length: users }, (_, i) => ({
  identifier: `sim_${runId}_${i + 1}`,
  rolls: [rand(), rand(), rand(), rand()],
}));

async function simulate(plan: (typeof plans)[number]) {
  const { identifier, rolls } = plan;
  // Same call as the app: evaluate without recording, then record the exposure when the cart is shown.
  const flags = await flagsmith.getIdentityFlags(identifier, { role: "user", simulated: true });
  const flag = flags.getFlag("checkout_button") as Flag;
  const key = flag.variant || flag.value;
  const variant: Variant = key === "express" ? "express" : "control";
  const enrolled = Boolean(flag.experiment?.inExperiment);
  const t = tally[variant];
  t.customers++;
  if (enrolled) t.enrolled++;

  if (rolls[0] >= CONFIG.addToCart) return;
  t.carts++;
  if (!dryRun) {
    flagsmith.trackEvent("add_to_cart", { identifier });
    if (enrolled) flagsmith.trackExposureEvent("checkout_button", { identifier, value: variant });
  }

  const r = CONFIG.rates[variant];
  if (rolls[1] >= r.startCheckout) return;
  t.checkouts++;
  if (!dryRun) flagsmith.trackEvent("checkout_started", { identifier });

  if (rolls[2] >= r.completeOrder) return;
  t.orders++;
  const value = Math.round(CONFIG.orderValue.min + rolls[3] * (CONFIG.orderValue.max - CONFIG.orderValue.min));
  if (!dryRun) flagsmith.trackEvent("order_placed", { identifier, value });
}

let next = 0;
let done = 0;
async function worker() {
  while (next < plans.length) {
    const plan = plans[next++];
    try {
      await simulate(plan);
    } catch (e) {
      errors++;
      if (errors <= 3) console.warn(`  ${plan.identifier}: ${(e as Error).message}`);
    }
    if (++done % 100 === 0) {
      console.log(`  ${done}/${plans.length} customers`);
      if (!dryRun) await flagsmith.flushEvents();
    }
  }
}
await Promise.all(Array.from({ length: CONFIG.concurrency }, worker));

// Buffered events are lost if the process exits first (docs: close before exit).
if (!dryRun) await flagsmith.close();

console.log("\nWhat the simulated customers did:");
for (const v of ["control", "express"] as const) {
  const t = tally[v];
  console.log(
    `  ${v.padEnd(8)} ${String(t.customers).padStart(4)} customers (${t.enrolled} enrolled), ${t.carts} saw the cart, ` +
      `${t.checkouts} started checkout, ${t.orders} ordered = ${t.carts ? pct(t.orders / t.carts) : "-"} of cart viewers`,
  );
}
if (errors) console.log(`  ${errors} customers failed (network or rate limit) and were skipped.`);
console.log(
  dryRun
    ? "\nDry run: nothing was sent to Flagsmith."
    : "\nEvents sent. In Flagsmith, wait a few minutes, then press Refresh results (allowed once every 5 minutes).",
);
