# Platter

A food ordering marketplace where Flagsmith runs the important decisions. Sellers design their own store pages, customers order, and an admin runs a real A/B test on the checkout button, then ships the winner from inside the app.

Built for the Flagsmith Toggle Wars hackathon, **Track 01: Test Something Real**. For a visual tour of what happens behind the scenes, module by module, see **[docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md)**. For what's in each folder and how the files connect, see **[docs/FOLDER-GUIDE.md](docs/FOLDER-GUIDE.md)**, and for every file in one table, **[docs/FILE-INDEX.md](docs/FILE-INDEX.md)**. Full requirements are in [docs/PRD.md](docs/PRD.md). The demo video script is in [docs/DEMO.md](docs/DEMO.md).

> **The experiment traffic is simulated.** 2,000 simulated customers were sent through Flagsmith by [scripts/simulate.ts](scripts/simulate.ts). The conversion rates the script used are listed [below](#simulated-traffic), so you can check that Flagsmith found what was put in.

## The experiment

**Question.** Does a one-step checkout get more people to order?

**Hypothesis.** A one-step "Order now" checkout button increases completed orders by at least 10% compared with the two-step checkout.

| | `control` | `express` |
|---|---|---|
| Cart button | Checkout | Order now |
| What happens | Opens a review page, then **Place order** | Opens a small confirm sheet that places the order directly |
| Steps | 2 | 1 |

- **Flag:** `checkout_button`, multivariate, with values `control` and `express`. The experiment splits customers 50/50.
- **Metric:** `order_placed`, occurrence, higher is better. The order total is sent as the event value.
- **Supporting events:** `add_to_cart`, `checkout_started`.
- **Identity:** `user_<id>`, with the role sent as a trait. Each customer gets the same version on every visit.
- **Exposure:** recorded only when the cart is actually on screen. The server evaluates the flag without recording anything, using `getIdentityFlags`. A small client component then calls a Server Action that runs `trackExposureEvent`, but only when `flag.experiment.inExperiment` is true. This is the deferred-exposure pattern from the Flagsmith docs. It means a link prefetch never counts as being shown the cart.
- **Conversion:** `order_placed` is sent from the order Server Action after the order is saved, so it can't be faked from the browser.

### Result

See [Experiment results](#experiment-results) at the end of this file.

## How Flagsmith is used

Flagsmith decides what is allowed and which version a person sees. Postgres remembers what each person chose.

| Flag | Type | What it does in the app |
|---|---|---|
| `checkout_button` | Experiment (`control`, `express`) | Two-step vs one-step checkout |
| `ordering_enabled` | Kill switch | Off: checkout buttons are disabled, and the order Server Action refuses every order |
| `seller_themes_enabled` | Boolean | Off: the theme studio locks, and every store shows the Platter look |
| `theme_options` | Remote config (JSON) | Fonts, corner sizes, button shapes and the per-store limit sellers can use. Checked on the server when a look is saved |
| `leaderboard_enabled` | Boolean | Off: leaderboard pages are hidden from customers and sellers |
| `seller_ab_titles_enabled` | Boolean | Off: dishes show their normal title, and title tests are hidden |

**Admin console** (`/admin/flags`). The admin flips these switches from inside Platter. The server calls the Flagsmith Admin API, which publishes a new feature version because this environment uses v2 versioning, and the change reaches customers within seconds. The same page reads the experiment's results, can trigger a refresh, and has **Ship to everyone**. That button calls the experiment's `complete` endpoint, ending the test and serving the winning version to every customer.

**Where the SDK calls are:**
- [lib/flags.ts](lib/flags.ts): the Node SDK, with flags, the experiment assignment, the exposure, events and safe defaults.
- [lib/flagsmith-admin.ts](lib/flagsmith-admin.ts): the Admin API, server only.
- [scripts/flagsmith-setup.mjs](scripts/flagsmith-setup.mjs): creates the flags, the metric and the experiment.

If Flagsmith can't be reached, the app uses safe defaults: ordering on, themes on, leaderboard on, title tests on, and checkout = `control`.

## Simulated traffic

[scripts/simulate.ts](scripts/simulate.ts) creates new Flagsmith identities (`sim_<run>_<n>`, with the trait `simulated: true`). Each simulated customer:
1. asks Flagsmith which checkout version they get,
2. records the exposure when they "see the cart" (the same pattern as the app),
3. sends the same events the app sends.

The script decides each customer's behaviour with a fixed random seed, using these rates:

| Step | Control | Express |
|---|---|---|
| Adds a dish and sees the cart | 70% | 70% |
| Of those, starts checkout | 60% | 62% |
| Of those, completes the order | 55% | 65% |
| **Expected order rate of cart viewers** | **33.0%** | **40.3%** (+22% relative) |

**Sample size.** A power calculation for 33.0% vs 40.3% (95% confidence, 80% power) needs about 680 cart viewers per version, about 2,000 customers. Traffic was sent in two runs:

| Run | Seed | Customers | Control: cart viewers → orders | Express: cart viewers → orders |
|---|---|---|---|---|
| 1 | 20261126 | 600 | 228 → 83 (36.4%) | 194 → 73 (37.6%) |
| 2 | 20261127 | 1,400 | 491 → 152 (31.0%) | 496 → 200 (40.3%) |
| **Total** | | **2,000** | **719 → 235 (32.7%)** | **690 → 273 (39.6%)** |

Run 1 was too small to separate the versions: the gap was mostly noise. Run 2 brought the total to the planned 2,000. Both runs are included, and nothing was dropped.

A handful of real orders placed through the app while testing are also in the experiment.

```bash
npm run simulate -- --dry-run          # print the plan, send nothing
npm run simulate                       # 2,000 customers, seed 20261126
npm run simulate -- --users 500 --seed 7
```

## Setup

Requires Node 24+, Docker and a Flagsmith Cloud account.

```bash
npm install
cp .env.example .env.local        # fill in the Flagsmith keys, see below
npm run db:up                     # Postgres 16 on localhost:5433
npm run db:push                   # create tables
npm run db:seed                   # demo data: 1 admin, 3 sellers, 5 customers, 3 weeks of orders
npm run flagsmith:setup           # create the flags, the metric and the experiment (not started)
npm run dev                       # http://localhost:3000
```

Once the checkout code is running, start the experiment with `node --env-file=.env.local scripts/flagsmith-setup.mjs --start`. Starting it locks the flag. The environment needs a warehouse connected, which you can check in Flagsmith under the environment's settings.

### Environment variables

| Name | Where | What |
|---|---|---|
| `DATABASE_URL` | server | Postgres connection string |
| `FLAGSMITH_SERVER_KEY` | server | Server-side environment key (`ser.…`) |
| `NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_ID` | browser | Client-side environment key |
| `FLAGSMITH_ADMIN_API_KEY` | server only | Organisation API key for the admin console and setup script. Never commit it |
| `FLAGSMITH_PROJECT_ID`, `FLAGSMITH_ENVIRONMENT_KEY` | server | Used by the Admin API calls and dashboard links |
| `FLAGSMITH_EXPERIMENT_ID` | server | Printed by `npm run flagsmith:setup` |
| `FLAGSMITH_API_URL` | server | Defaults to Flagsmith Cloud |

All `.env*` files except `.env.example` are git-ignored.

### Demo accounts

Open `/login` and pick an account; there are no passwords.
- **Customers:** Riya, Arjun and Meera get `control`; Zara and Dev get `express`.
- **Sellers:** Harpreet runs Tandoor Tales, which has its own look. Lakshmi runs Dosa Republic, which uses the Fresh look. Kenji runs Bowl & Bao, which hides its name on leaderboards.
- **Admin:** Asha.

## What else is in the app

- **Seller theme studio** (`/seller/themes`): colours, font, corners, button shape, banner image and text, and an offer badge, with a live preview and a contrast warning below 4.5:1. Sellers can save several looks and make one live.
- **Storefronts** (`/store/[id]`): drawn in the seller's look. Customers can switch one store's look off, or choose "always use the Platter look". Both choices are saved.
- **Seller title tests:** two titles for a dish, a stable 50/50 split by a hash of user and test, counted in customers, and "too early to call" under 30 per title. These run inside the app rather than in Flagsmith Experimentation, because Flagsmith reports results per experiment rather than per item.
- **Leaderboards:** weekly and monthly, for sellers and customers. A seller can hide their name and appear as "Anonymous seller #N".
- **Success metrics** (`/admin/metrics`): only the checkout experiment is labelled *Randomised*. Theme impact and leaderboard growth compare sellers who chose different settings, so they are labelled *Descriptive*.
- **White and dark themes** for the whole app. The Platter look follows them too.

## Tech

Next.js 16 (App Router, Cache Components) and TypeScript only: Server Components, Server Actions and route handlers, with no TanStack and no tRPC. Postgres with Drizzle ORM. Tailwind CSS v4. Flagsmith Node SDK `@flagsmith/nodejs` 9.5.

## Experiment results

From Flagsmith, results as of 24 Nov 2026, 11:33 pm IST. The experiment is still running, and the flag is locked.

| Version | Customers exposed | Ordered | Order rate |
|---|---|---|---|
| Control, two-step | 719 | 235 | 32.7% |
| Express, one-step | 691 | 274 | 39.7% |

- **Lift, express vs control: +21.3%.** The 95% credible interval is +4.4% to +38.3%.
- **Chance express is best: 99.3%.** That's above the 95% threshold Flagsmith's docs use for a recommendation.
- **Verdict:** the hypothesis (at least +10%) is supported. The whole credible interval is above zero, and its middle is above 10%. The lower end, +4.4%, is below 10%, so "at least 10%" is likely but not certain.
- **Check against the input:** the simulator was set to 33.0% vs 40.3%, a +22% relative lift. Flagsmith measured +21.3%, so the pipeline (exposures, then `order_placed`, then the warehouse, then the analysis) recovers the effect that was put in.

**What this does and doesn't show.** The traffic is simulated, so this proves the experiment is wired correctly and analysed properly. It doesn't show how real customers would behave. With real traffic, the same flag, metric and code would measure the real effect.
