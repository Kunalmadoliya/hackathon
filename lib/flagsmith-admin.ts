import "server-only";

/**
 * Flagsmith Admin API (server only). The admin key never reaches the browser.
 * Endpoints follow the Flagsmith OpenAPI schema (api.flagsmith.com/api/v1/swagger.json).
 * This environment uses v2 feature versioning, so flag changes publish a new version.
 */

const API = (process.env.FLAGSMITH_API_URL || "https://api.flagsmith.com/api/v1/").replace(/\/?$/, "/");
const KEY = process.env.FLAGSMITH_ADMIN_API_KEY;
const PROJECT = process.env.FLAGSMITH_PROJECT_ID;
const ENV_KEY = process.env.FLAGSMITH_ENVIRONMENT_KEY;
export const EXPERIMENT_ID = process.env.FLAGSMITH_EXPERIMENT_ID;

export const adminConfigured = Boolean(KEY && PROJECT && ENV_KEY);

export const dashboardUrl = (() => {
  const base = API.includes("api.flagsmith.com") ? "https://app.flagsmith.com" : API.replace(/\/api\/v1\/$/, "");
  return {
    flags: `${base}/project/${PROJECT}/environment/${ENV_KEY}/features`,
    experiment: `${base}/project/${PROJECT}/environment/${ENV_KEY}/experiments/${EXPERIMENT_ID}`,
  };
})();

export class AdminApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!adminConfigured) throw new AdminApiError(0, "The Flagsmith admin key is not set.");
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Api-Key ${KEY}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 300);
    try {
      const j = JSON.parse(text);
      detail = j.detail ?? (Array.isArray(j) ? j.join(" ") : JSON.stringify(j));
    } catch {}
    throw new AdminApiError(res.status, detail);
  }
  return (text ? JSON.parse(text) : null) as T;
}

type Feature = { id: number; name: string; type: string; description: string | null };
type Environment = { id: number; api_key: string; name: string };

let envCache: Environment | null = null;
async function environment() {
  envCache ??= await api<Environment>("GET", `environments/${ENV_KEY}/`);
  return envCache;
}

export async function listFeatures(): Promise<Feature[]> {
  const r = await api<{ results: Feature[] }>("GET", `projects/${PROJECT}/features/?page_size=100`);
  return r.results;
}

/** Turns a flag on or off for the whole environment by publishing a new version. */
export async function setFlagEnabled(featureName: string, enabled: boolean) {
  const [features, env] = await Promise.all([listFeatures(), environment()]);
  const f = features.find((x) => x.name === featureName);
  if (!f) throw new AdminApiError(404, `No flag named ${featureName}.`);
  await api("POST", `environments/${env.id}/features/${f.id}/versions/`, {
    publish_immediately: true,
    description: `Platter admin console: ${enabled ? "on" : "off"}`,
    feature_states_to_update: [
      { feature_segment: null, enabled, feature_state_value: { type: "unicode", string_value: null } },
    ],
  });
}

export type Experiment = {
  id: number;
  name: string;
  hypothesis: string;
  status: string;
  feature: number;
  experiment_rollout?: {
    rollout_percentage: number;
    multivariate_feature_state_values: { multivariate_feature_option: number; percentage_allocation: number }[];
  };
};

export async function getExperiment(): Promise<Experiment> {
  return api<Experiment>("GET", `environments/${ENV_KEY}/experiments/${EXPERIMENT_ID}/`);
}

export type VariantResult = { variant: string; evaluations: number; conversions: number; conversion_rate: number };
export type ExperimentStats = {
  chance_to_win?: Record<string, number>;
  lift?: string; // formatted, e.g. "+21.3%"
  liftValue?: number;
  ciLow?: number; // 95% credible interval of the lift
  ciHigh?: number;
  winner?: string | null;
  recommendation?: string;
  sample_size_warning?: string | null;
  srmPValue?: number | null;
};
export type ParsedResults = { asOf: string | null; variants: VariantResult[]; statistics: ExperimentStats | null } | null;

const signedPct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;

type RawMetric = {
  metric_id?: number;
  variants?: Record<string, { n: number; sum: number }>;
  inference?: Record<string, { lift: number; ci_low: number; ci_high: number; chance_to_win: number }>;
};
type RawResults = {
  results?: { as_of?: string; payload?: { metrics?: RawMetric[]; srm_p_value?: number | null } } | null;
};

/**
 * Reads the results response as Flagsmith Cloud returns it (observed 2026-11-24, beta):
 * results.payload.metrics[].variants = { control: { n, sum } }, .inference = { express: { lift, ci_low, ci_high, chance_to_win } }.
 * For an occurrence metric, n is exposed identities and sum is converted identities.
 */
function parseResults(raw: unknown): ParsedResults {
  const r = (raw as RawResults)?.results;
  const metric = r?.payload?.metrics?.[0];
  if (!r || !metric?.variants) return null;

  const order = (k: string) => (k === "control" ? 0 : 1);
  const variants: VariantResult[] = Object.entries(metric.variants)
    .sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b))
    .map(([variant, v]) => ({ variant, evaluations: v.n, conversions: v.sum, conversion_rate: v.n ? v.sum / v.n : 0 }));

  let statistics: ExperimentStats | null = null;
  const inf = Object.entries(metric.inference ?? {})[0];
  if (inf) {
    const [name, x] = inf;
    const ctw = x.chance_to_win;
    // The docs' rule: recommend when a variation reaches a 95% chance of beating control.
    const winner = ctw >= 0.95 ? name : ctw <= 0.05 ? "control" : null;
    const minN = Math.min(...variants.map((v) => v.evaluations));
    statistics = {
      chance_to_win: { [name]: ctw, control: 1 - ctw },
      lift: signedPct(x.lift),
      liftValue: x.lift,
      ciLow: x.ci_low,
      ciHigh: x.ci_high,
      winner,
      recommendation: winner
        ? `Ship ${winner}. It has a ${Math.round(Math.max(ctw, 1 - ctw) * 100)}% chance to be best, above the 95% bar.`
        : "Keep running. Neither version has reached a 95% chance to be best.",
      sample_size_warning: minN < 50 ? "Fewer than 50 customers in a version. Collecting data." : null,
      srmPValue: r.payload?.srm_p_value ?? null,
    };
  }
  return { asOf: r.as_of ?? null, variants, statistics };
}

export const formatCi = (s: ExperimentStats) =>
  s.ciLow !== undefined && s.ciHigh !== undefined ? `${signedPct(s.ciLow)} to ${signedPct(s.ciHigh)}` : null;

export async function getResults(): Promise<{ parsed: ParsedResults; raw: unknown }> {
  const raw = await api<unknown>("GET", `environments/${ENV_KEY}/experiments/${EXPERIMENT_ID}/results/`);
  return { parsed: parseResults(raw), raw };
}

/** Flagsmith allows this about once every 5 minutes. */
export async function refreshResults() {
  await api("POST", `environments/${ENV_KEY}/experiments/${EXPERIMENT_ID}/results/refresh/`);
}

export async function getExposures(): Promise<Record<string, number>> {
  const r = await api<{ exposures?: { payload?: { timeseries?: { points?: { new_identities: Record<string, number> }[] } } } }>(
    "GET",
    `environments/${ENV_KEY}/experiments/${EXPERIMENT_ID}/exposures/`,
  );
  const totals: Record<string, number> = {};
  for (const p of r?.exposures?.payload?.timeseries?.points ?? []) {
    for (const [k, n] of Object.entries(p.new_identities ?? {})) totals[k] = (totals[k] ?? 0) + n;
  }
  return totals;
}

export async function refreshExposures() {
  await api("POST", `environments/${ENV_KEY}/experiments/${EXPERIMENT_ID}/exposures/refresh/`);
}

/** The multivariate option id for a variation key on the experiment's flag. */
export async function variantOptionId(featureId: number, key: string): Promise<number | null> {
  const r = await api<{ results: { id: number; key: string | null; string_value: string | null }[] }>(
    "GET",
    `projects/${PROJECT}/features/${featureId}/mv-options/`,
  );
  return r.results.find((o) => o.key === key || o.string_value === key)?.id ?? null;
}

/** Ends the experiment and serves one version to everyone. */
export async function completeExperiment(decision: "control" | "variant", variantOptionId?: number) {
  await api("POST", `environments/${ENV_KEY}/experiments/${EXPERIMENT_ID}/complete/`, {
    rollout_decision: decision,
    ...(decision === "variant" ? { rollout_variant: variantOptionId } : {}),
  });
}
