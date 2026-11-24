// Creates Platter's flags, the order_placed metric and the checkout_button experiment
// through the Flagsmith Admin API. Safe to re-run: existing items are reused.
// It does NOT start the experiment (starting locks the flag). Run with --start to start it.
//
// Endpoints and bodies follow https://docs.flagsmith.com/experimentation/set-up-with-a-coding-agent
// and the Flagsmith OpenAPI schema (api.flagsmith.com/api/v1/swagger.json).
//
// Usage: node --env-file=.env.local scripts/flagsmith-setup.mjs [--start]

const API = (process.env.FLAGSMITH_API_URL || "https://api.flagsmith.com/api/v1/").replace(/\/?$/, "/");
const KEY = process.env.FLAGSMITH_ADMIN_API_KEY;
const PROJECT = process.env.FLAGSMITH_PROJECT_ID;
const ENV = process.env.FLAGSMITH_ENVIRONMENT_KEY;
if (!KEY || !PROJECT || !ENV) {
  console.error("Set FLAGSMITH_ADMIN_API_KEY, FLAGSMITH_PROJECT_ID and FLAGSMITH_ENVIRONMENT_KEY in .env.local");
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Api-Key ${KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}
const list = (r) => (Array.isArray(r) ? r : r.results);

const THEME_OPTIONS = {
  fonts: ["Inter", "Poppins", "Merriweather", "Space Grotesk"],
  maxThemesPerSeller: 5,
  radiusOptions: [0, 8, 16, 24],
  buttonStyles: ["square", "rounded", "pill"],
};

const FLAGS = [
  { name: "ordering_enabled", description: "Kill switch. Off stops all checkout, in the UI and on the server." },
  { name: "seller_themes_enabled", description: "Theme studio and themed storefronts." },
  { name: "leaderboard_enabled", description: "Leaderboard pages and blocks." },
  { name: "seller_ab_titles_enabled", description: "Seller item title A/B tests (run inside the app)." },
  {
    name: "theme_options",
    description: "Remote config: fonts, radii, button styles and theme limit sellers can use.",
    initial_value: JSON.stringify(THEME_OPTIONS),
  },
  {
    name: "checkout_button",
    description: "Experiment: control = two-step checkout, express = one-step Order now.",
    initial_value: "control",
  },
];

const existing = list(await api("GET", `projects/${PROJECT}/features/?page_size=100`));
const byName = Object.fromEntries(existing.map((f) => [f.name, f]));

for (const f of FLAGS) {
  if (byName[f.name]) {
    console.log(`flag ${f.name}: exists (id ${byName[f.name].id})`);
    continue;
  }
  const created = await api("POST", `projects/${PROJECT}/features/`, {
    name: f.name,
    type: "STANDARD",
    default_enabled: true,
    initial_value: f.initial_value ?? null,
    description: f.description,
  });
  byName[f.name] = created;
  console.log(`flag ${f.name}: created (id ${created.id})`);
}

// checkout_button needs an "express" variation with a key. "control" is the flag's own value.
const checkout = byName.checkout_button;
const mvPath = `projects/${PROJECT}/features/${checkout.id}/mv-options/`;
let express = list(await api("GET", mvPath)).find((o) => o.string_value === "express");
if (!express) {
  express = await api("POST", mvPath, {
    feature: checkout.id,
    type: "unicode",
    string_value: "express",
    key: "express",
    default_percentage_allocation: 0,
  });
  console.log(`variation express: created (id ${express.id})`);
} else {
  console.log(`variation express: exists (id ${express.id}, key ${express.key})`);
}

// Warehouse: experiments need one connected to the environment.
const wh = await api("GET", `environments/${ENV}/warehouse-connections/`);
console.log("warehouse:", wh.map((w) => `${w.name} (${w.warehouse_type}) status=${w.status}`).join(", ") || "NONE");

// Metric: order_placed. Event name is case-sensitive and must match the code.
const metrics = list(await api("GET", `environments/${ENV}/experiment-metrics/`));
let metric = metrics.find((m) => m.definition?.event === "order_placed");
if (!metric) {
  metric = await api("POST", `environments/${ENV}/experiment-metrics/`, {
    name: "Order placed",
    description: "User placed an order (event order_placed, value = order total).",
    aggregation: "occurrence",
    direction: "up",
    definition: { version: 1, event: "order_placed" },
  });
  console.log(`metric order_placed: created (id ${metric.id})`);
} else {
  console.log(`metric order_placed: exists (id ${metric.id})`);
}

// Experiment: 50/50 across everyone. Control gets the remaining percentage.
const experiments = list(await api("GET", `environments/${ENV}/experiments/`));
let exp = experiments.find((e) => e.name === "Checkout button: express vs two-step");
if (!exp) {
  exp = await api("POST", `environments/${ENV}/experiments/`, {
    feature: checkout.id,
    name: "Checkout button: express vs two-step",
    hypothesis:
      "A one-step 'Order now' checkout button increases completed orders (order_placed) by at least 10% compared with the two-step checkout.",
    metrics: [{ metric: metric.id, expected_direction: "increase" }],
    experiment_rollout: {
      enabled: true,
      rollout_percentage: 100,
      feature_state_value: { type: "string", value: "control" },
      multivariate_feature_state_values: [{ multivariate_feature_option: express.id, percentage_allocation: 50 }],
    },
  });
  console.log(`experiment: created (id ${exp.id}, status ${exp.status})`);
} else {
  console.log(`experiment: exists (id ${exp.id}, status ${exp.status})`);
}

if (process.argv.includes("--start")) {
  const started = await api("POST", `environments/${ENV}/experiments/${exp.id}/start/`);
  console.log(`experiment started: status ${started?.status}`);
}

const dashboard = API.includes("api.flagsmith.com") ? "https://app.flagsmith.com" : API.replace(/\/api\/v1\/$/, "");
console.log(`\nResults page: ${dashboard}/project/${PROJECT}/environment/${ENV}/experiments/${exp.id}`);
console.log(`Add to .env.local: FLAGSMITH_EXPERIMENT_ID=${exp.id}`);
