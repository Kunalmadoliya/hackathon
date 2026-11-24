# Platter (working title "Asset Manager"): POC Product Requirements and Build Prompt

> Brand used in the build: **Platter**. The original working title was "Asset Manager". No Zomato branding.

Version 0.1 (proof of concept)
Event: Flagsmith "Toggle Wars" Experimentation Hackathon, Track 01 (Test Something Real)
Stack: Next.js only

---

## 0. How to use this file

1. Save this file as `docs/PRD.md` in the repo root.
2. Give your coding agent the prompt in Section 1 and tell it to read this whole file first.
3. Build in the milestone order in Section 13. The agent stops at each checkpoint.

**Start gate.** Hacking opens at 8:00 AM IST on Nov 26, 2026, and submissions close at 8:00 PM IST on Nov 29, 2026.
Rules tab checked on Nov 24, 2026: Rule 04 allows a head start ("try Flagsmith and start building your idea with it before the hackathon begins. That's allowed."). Rule 08: public GitHub repo, README with setup steps and how Flagsmith is used, and a short demo video.

---

## 1. The prompt

```
You are building a proof of concept (POC) called "Asset Manager": a food ordering
marketplace with three panels (admin, seller, user). Flagsmith controls the main
behaviour of the app.

Read docs/PRD.md fully before you write any code. Follow it exactly. If the PRD and
your own assumptions differ, the PRD wins.

Hard rules:
1. Use Next.js (App Router) and TypeScript only. Do NOT use any TanStack library
   (no Query, Router, Table or Form). Do not use tRPC, because its React client
   depends on TanStack Query. Fetch and change data with Server Components,
   Server Actions and route handlers.
2. Use Flagsmith for: the checkout button experiment, kill switches, feature flags
   and remote config. Never guess Flagsmith SDK calls. Fetch the docs listed in
   Section 12 and follow them. If a doc contradicts this PRD, follow the doc and
   tell me.
3. Never put the Flagsmith admin API key in client code or in the repo.
4. Build in the milestones from Section 13. After each milestone, stop, summarise
   what changed, tell me how to run and click through it, and wait for my go-ahead.
5. Keep it a POC: no payments, no real auth provider, no real location data.
   Seed realistic demo data.
6. Ask me before you add any dependency that is not listed in Section 3.
7. Server code must never trust the client. Check roles and flag values on the
   server for every action.
```

---

## 2. Context and goals

**What it is.** A food ordering marketplace. Sellers put their food and store look on the app. Users browse and order. An admin watches the whole marketplace.

**Why it exists.** It is the entry for the Toggle Wars hackathon. Judges score four things: use of Flagsmith, impact, creativity, and the demo video. For Track 01, one experiment done well beats many features. The experiment needs a clear hypothesis, versions behind a flag, a metric from real events, and results you can explain.

**What the POC must prove.**
1. A seller can design their own store theme.
2. A user sees that theme, and can switch it off.
3. A real Flagsmith experiment on the checkout button produces results.
4. An admin can see leaderboards and success metrics.

**Priorities, in order.**
1. Seller theme studio
2. User storefront with theme, banner and discounts, plus theme opt-out
3. Checkout button experiment with Flagsmith (the core Flagsmith feature)
4. Admin console: kill switch, leaderboards, success metrics
5. Seller title A/B test
6. Seller leaderboard name toggle

If time runs short, cut from the bottom of this list.

---

## 3. Tech stack for the POC

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router), TypeScript | No TanStack anywhere |
| Styling | Tailwind CSS with CSS variables | Themes are CSS variables |
| Data access | Server Components, Server Actions, route handlers | No tRPC |
| Database | PostgreSQL with Drizzle ORM | Local Docker or a hosted database |
| Auth (POC) | Demo role switcher saved in a cookie | Seeded accounts: 1 admin, 3 sellers, 5 users |
| Flagsmith | Flagsmith Cloud | JS/React SDK in the browser, Node.js SDK on the server, Flagsmith CLI for setup |
| Images | File upload saved under `public/uploads`, or an image URL field | Max 2 MB, png/jpg/webp only |
| Charts | Tables and simple CSS bars | No chart library |
| Simulator | `scripts/simulate.ts` | Pretends to be a few hundred users |

SDK versions named on Flagsmith's experiment setup page: `@flagsmith/flagsmith` 12.4.0 or later and `@flagsmith/nodejs` 9.1.0 or later.

---

## 4. Roles and panels

### 4.1 Seller panel (priority 1)

**Theme studio**
- Shows 3 platform default themes (read only). A seller can duplicate one to edit it.
- A seller can create a theme with: a name, colours (primary, background, surface, text, accent), a font from the allowed list, a corner radius, a button style (square, rounded or pill), a banner (image upload, headline and sub-text), and a discount badge style and text.
- A live preview shows a mock storefront as the seller edits.
- A seller can save several themes, set one as active, and delete any theme that is not active.
- A "Use default" button sets the active theme back to a platform default.
- A contrast check warns the seller when text on background is hard to read (ratio below 4.5).
- Allowed fonts and limits come from the Flagsmith remote config `theme_options` (Section 5.6). If Flagsmith cannot be reached, use the same values hardcoded as a fallback.

**Items and discounts**
- Add and edit food items: title, description, price, image, category, an "available" toggle, and an optional item discount percent.
- A store-wide discount: a percent plus banner text, shown on the storefront.

**Title A/B test** (Section 6)
- For an item, the seller enters two titles (A and B), starts the test, watches results, and picks a winner.

**Leaderboard setting**
- A toggle: "Show my store name on leaderboards". Default is on. When it is off, the seller still ranks, but appears as "Anonymous seller" with their rank number.

**Stats page**
- Orders, revenue, theme opt-out rate, and A/B results.

### 4.2 User panel (priorities 2 and 3)

- **Home:** a list of seller cards on the platform default theme.
- **Storefront:** a seller's page, drawn with that seller's active theme, banner and discounts. If the user has turned the theme off for that seller, the storefront uses the platform default theme.
- **Theme switch:** "Use this seller's theme" on or off, per seller, saved in the database. There is also a global "Always use the default theme" switch.
- **Cart, checkout and orders:** the checkout flow is controlled by the Flagsmith experiment in Section 5.3.
- **Leaderboards:** a read-only page.
- A user cannot create themes, items or tests.

### 4.3 Admin panel (priority 4)

- **Leaderboards:** weekly and monthly, for sellers and for users. The admin always sees real seller names, plus each seller's leaderboard visibility.
- **Seller table:** seller, leaderboard name visible, has a custom theme, active title tests, orders, revenue.
- **Success metrics:** the dashboard in Section 9.
- **Feature console:** shows current Flagsmith values for `ordering_enabled`, `seller_themes_enabled`, `leaderboard_enabled` and `seller_ab_titles_enabled`, and lets the admin change them from the app using the server only. If the Admin API cannot do this, link to the Flagsmith dashboard instead.
- **Experiment results panel:** shows the checkout experiment results from Flagsmith (win probability and lift). If reading results through the API is not possible, show a link to the Flagsmith results page.
- **Home for new features:** any extra feature gets its own flag and appears in this console.

---

## 5. Flagsmith integration (the core)

### 5.1 Principle

Flagsmith decides what is allowed and which version a user sees. The database remembers what each person chose. Do not store per-seller or per-user data in Flagsmith.

### 5.2 Flag catalogue

| Flag | Type | Values | Controlled by | Used for |
|---|---|---|---|---|
| `checkout_button` | Multivariate (experiment) | `control`, `express` | Flagsmith experiment | Checkout flow |
| `ordering_enabled` | Boolean (kill switch) | on / off | Admin | Disables checkout |
| `seller_themes_enabled` | Boolean | on / off | Admin | Theme studio and storefront themes |
| `theme_options` | Remote config (JSON) | See 5.6 | Admin | Allowed fonts and limits |
| `leaderboard_enabled` | Boolean | on / off | Admin | Leaderboard pages |
| `seller_ab_titles_enabled` | Boolean | on / off | Admin | Seller title A/B test |
| `leaderboard_home` (stretch) | Multivariate (experiment) | `control`, `show_board` | Flagsmith experiment | Leaderboard on the user home screen |

If Flagsmith cannot be reached, use safe defaults: ordering on, themes on, leaderboard on, A/B on, `checkout_button` = `control`.

### 5.3 The core experiment: checkout button

- **Hypothesis:** A one-step "Order now" checkout button increases completed orders by at least 10% across the simulated sessions.
- **Version A (`control`):** two steps. "Checkout" opens a review page, then "Place order".
- **Version B (`express`):** one step. "Order now" opens a small confirm sheet and places the order directly.
- **Metric:** `order_placed` (order total as the event value).
- **Other events:** `add_to_cart`, `checkout_started`.
- **Identity:** the user ID is the Flagsmith identifier; role is sent as a trait. Same version on every visit.
- **Exposure:** recorded when the cart renders.
- **Event names** are case-sensitive and must exactly match the metric in Flagsmith.

### 5.4 Kill switch behaviour

When `ordering_enabled` is off, the checkout button is disabled and shows a short message. The order Server Action must also reject orders.

### 5.5 Where the other flags are used

- `seller_themes_enabled` off: every storefront uses the platform default theme, and the theme studio shows a "disabled" message.
- `leaderboard_enabled` off: leaderboard pages and dashboard blocks are hidden.
- `seller_ab_titles_enabled` off: the A/B test section is hidden, and items show their normal title.

### 5.6 Remote config example

```json
{
  "fonts": ["Inter", "Poppins", "Merriweather", "Space Grotesk"],
  "maxThemesPerSeller": 5,
  "radiusOptions": [0, 8, 16, 24],
  "buttonStyles": ["square", "rounded", "pill"]
}
```

### 5.7 Setting up the experiment

- Follow Flagsmith's "Set up an experiment with a coding agent" page. Use the Flagsmith CLI or the API to create the flag, metric and experiment.
- The MCP server cannot start experiments.
- Create the experiment but do not start it until the code is in. Starting it locks the flag.
- Flush buffered events before a script or process exits.
- Results can be refreshed about once every 5 minutes.

### 5.8 Simulator

`scripts/simulate.ts`: a few hundred simulated users, each with a unique ID, a version from Flagsmith, add to cart, and sometimes order. Rates per version are in a config at the top of the script, with a fixed seed, and printed when the script runs. README and demo video must say traffic is simulated and list the rates.

---

## 6. Seller title A/B test (POC design)

Built inside the app, not with Flagsmith Experimentation. Assignment by a stable hash of `userId + testId`. Events in `title_events`: `view`, `add_to_cart`, `order`. "Too early to call" under 30 views per title. "Declare winner" writes the winning title into the item and ends the test. Behind `seller_ab_titles_enabled`.

---

## 7. Theme system

Tokens: colours, font, radius, button style, banner (image, headline, sub-text) and discount badge.

| Name | Primary | Background | Text |
|---|---|---|---|
| Classic | `#C2410C` | `#FFFFFF` | `#1F2937` |
| Night | `#F59E0B` | `#111827` | `#F9FAFB` |
| Fresh | `#15803D` | `#F0FDF4` | `#14532D` |

Resolution (first match wins): themes flag off → default; user opted out (per seller or global) → default; seller active theme → it; otherwise default. Tokens apply as CSS variables on the storefront wrapper only. png/jpg/webp ≤ 2 MB. Record `theme_applied` and `theme_disabled_by_user` events in the app database.

---

## 8. Leaderboards

Seller and user boards; weekly (Mon–Sun) and monthly windows in IST. Sellers by completed orders, ties by revenue; users by completed orders, ties by spend. Top 10 plus "your rank". Users by nickname; sellers by store name unless hidden ("Anonymous seller"). Admin sees real names and toggle status. Gate: `leaderboard_enabled`. SQL over orders.

---

## 9. Success metrics (admin dashboard)

| Group | Metric | Source |
|---|---|---|
| Experiment | Order conversion by checkout version | Flagsmith |
| Experiment | Win probability and lift | Flagsmith |
| Theme adoption | Sellers with a custom theme | Postgres |
| Theme health | Theme opt-out rate | Postgres |
| Theme impact | Conversion, custom vs default theme (descriptive) | Postgres |
| Leaderboard | Name visibility | Postgres |
| Leaderboard | Board views | Postgres |
| Leaderboard | Growth, visible vs hidden (descriptive) | Postgres |
| Title A/B | Tests run and completed, average uplift | Postgres |
| Guardrail | Top 3 share | Postgres |

Only the Flagsmith checkout experiment supports a "caused" claim. Label the others "descriptive".

---

## 10. Data model

```
users            id, name, nickname, role (admin | seller | user)
sellers          id, user_id, store_name, leaderboard_show_name, active_theme_id
themes           id, seller_id (null = platform default), name, is_default, tokens (json)
items            id, seller_id, title, description, price, image_url, category, available, discount_percent
store_discounts  id, seller_id, percent, banner_text, active
title_tests      id, item_id, title_a, title_b, status, winner, started_at, ended_at
title_events     id, test_id, user_id, variant, type, created_at
user_prefs       user_id, seller_id (null = global), use_seller_theme
orders           id, user_id, seller_id, total, status, created_at
order_items      id, order_id, item_id, title_shown, quantity, price
events           id, type, user_id, seller_id, city, created_at
```

Seed: 1 admin, 3 sellers (one custom theme, one default, one with leaderboard name hidden), 5 users, ~20 items, 2–3 weeks of past orders.

---

## 11. Routes

`/login`, `/`, `/store/[sellerId]`, `/cart`, `/checkout`, `/orders`, `/leaderboard`, `/seller`, `/seller/themes`, `/seller/themes/new`, `/seller/themes/[id]`, `/seller/items`, `/seller/items/[id]`, `/seller/items/[id]/ab-test`, `/seller/leaderboard`, `/admin`, `/admin/leaderboard`, `/admin/flags`, `/admin/metrics`.

---

## 12. Docs to consult

- Hackathon page: https://www.wemakedevs.org/hackathons/flagsmith
- Feature flags basics: https://docs.flagsmith.com/getting-started/feature-flags
- Experimentation overview: https://docs.flagsmith.com/experimentation
- Run an experiment: https://docs.flagsmith.com/experimentation/run-an-experiment
- Button test example: https://docs.flagsmith.com/experimentation/example-paypal-button
- Set up with a coding agent: https://docs.flagsmith.com/experimentation/set-up-with-a-coding-agent
- SDK & API reference: https://docs.flagsmith.com/sdk-api/
- Flagsmith repo: https://github.com/flagsmith/flagsmith
- Demo app: https://github.com/Flagsmith/experimentation-demo-app

---

## 13. Milestones

| # | Milestone | Done when |
|---|---|---|
| M0 | Setup | App runs, database connects, Flagsmith project and environment exist, env vars documented |
| M1 | Seed and roles | Role switcher works, seed data loads, each role sees its own panel shell |
| M2 | Seller theme studio | Create, preview, save, activate, delete themes, use defaults, contrast warning |
| M3 | User storefront | Theme, banner, discounts; theme switch works and is remembered |
| M4 | Cart, checkout and experiment | Orders work; `checkout_button` experiment running; versions differ; `order_placed` reaches Flagsmith; kill switch works |
| M5 | Admin console | Leaderboards, seller table, feature console, success metrics |
| M6 | Title A/B and name toggle | Title test runs and finishes; name toggle works |
| M7 | Simulator and handoff | Simulator fills the experiment; README and demo script written |

---

## 14. Acceptance checklist

- [ ] A seller can create a theme, preview it, set it active, and switch back to a default.
- [ ] A user opening that seller's store sees the theme, banner and discounts.
- [ ] The same user can switch the seller's theme off, and it stays off after a refresh.
- [ ] A user gets the same checkout version on every visit.
- [ ] The two checkout versions behave differently (two steps vs one step).
- [ ] `order_placed` events appear in the Flagsmith experiment.
- [ ] Turning `ordering_enabled` off blocks ordering in the UI and on the server.
- [ ] The admin sees weekly and monthly boards, and each seller's name visibility.
- [ ] A seller with the name toggle off appears as "Anonymous seller" to users and other sellers.
- [ ] The admin metrics page shows every metric in Section 9 with the descriptive label where needed.
- [ ] A seller can run a title test and declare a winner.
- [ ] No TanStack package is in `package.json`.
- [ ] The admin API key is not in client code or the repo.
- [ ] The README says the traffic is simulated and lists the conversion rates used.

---

## 15. Out of scope and open questions

Out of scope: payments, real auth, Kafka, real location tracking, mobile apps, delivery tracking, self-hosted Flagsmith.

Open: Experimentation is beta and needs a warehouse connected to the environment (check `GET api/v1/environments/<key>/warehouse-connections/`). Location data, if added later, is city level only with permission.
