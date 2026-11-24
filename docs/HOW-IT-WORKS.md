# How Platter works

What happens behind the scenes, module by module. Each section is one idea, like a slide.

---

## 1. Platter in one line

> **A food app that tests its own ideas.** Flagsmith decides what each person sees, and Platter measures which version gets more orders.

```
     Sellers                 Customers                Admin
       O                        O                       O
      /|\   design a store     /|\   browse & order    /|\   flip switches,
      / \   look, run tests    / \                     / \   read results, ship
       |                        |                       |
       +------------------------+-----------------------+
                                |
                         +-------------+
                         |   PLATTER   |
                         +-------------+
```

---

## 2. The one rule

```
   +--------------------------+          +--------------------------+
   |        FLAGSMITH         |          |         POSTGRES         |
   |   decides what's allowed |          |  remembers what people   |
   |   and who sees which     |          |  chose and did           |
   |   version                |          |                          |
   |                          |          |  sellers, dishes, looks, |
   |  on/off switches         |          |  carts, orders, theme    |
   |  remote settings (JSON)  |          |  choices, title tests,   |
   |  the A/B experiment      |          |  leaderboards, events    |
   |  experiment results      |          |                          |
   +--------------------------+          +--------------------------+
```

Flagsmith never stores per-seller or per-customer data. Postgres never decides who gets which version.

---

## 3. The big picture

```
      BROWSER                      NEXT.JS SERVER                         OUTSIDE
 +---------------+         +-------------------------------+
 | pages (HTML)  | <-----  | Server Components (render)    |
 |               |         |                               |       +--------------------+
 | clicks/forms  | ----->  | Server Actions (do things)    | ----> | Postgres (Docker)  |
 |               |         |   - check who you are         |       | port 5433          |
 | tiny beacons  | ----->  |   - check flags               |       +--------------------+
 | ("cart is on  |         |   - read/write the DB         |
 |  screen")     |         |   - send events               |       +--------------------+
 +---------------+         |                               | ----> | Flagsmith Flags API|
                           |  lib/flags.ts      (Node SDK) |       | (who sees what)    |
                           |  lib/flagsmith-admin.ts       |       +--------------------+
                           |    (Admin API, server only)   | ----> | Flagsmith Events   |
                           +-------------------------------+       | -> warehouse       |
                                                                   | -> results         |
                                                                   +--------------------+
                                                             ----> | Flagsmith Admin API|
                                                                   | (flip flags, read  |
                                                                   |  results, ship)    |
                                                                   +--------------------+
```

**The browser never talks to Flagsmith directly.** Every flag check and every event goes through the server, so:
- nobody can fake an order event from the browser console,
- the server key and the admin key never leave the server,
- the same rules apply to every customer.

---

## 4. The six Flagsmith flags

| Flag | Type | Who controls it | When ON | When OFF |
|---|---|---|---|---|
| `checkout_button` | Experiment: `control` / `express` | The experiment (locked while running) | Each customer gets one version, 50/50 | n/a |
| `ordering_enabled` | Kill switch | Admin | Normal ordering | Checkout buttons greyed out, "Ordering is paused", and **the server refuses orders** |
| `seller_themes_enabled` | Switch | Admin | Stores show their own looks, studio open | Every store shows the Platter look, studio locked |
| `theme_options` | Remote config (JSON) | Admin, in Flagsmith | Lists allowed fonts, corner sizes, button shapes, max 5 looks | n/a |
| `leaderboard_enabled` | Switch | Admin | Boards visible | Customers and sellers see "switched off" |
| `seller_ab_titles_enabled` | Switch | Admin | Sellers can test two dish titles | Everyone sees normal titles, test screens hidden |

**If Flagsmith is unreachable**, [lib/flags.ts](../lib/flags.ts) falls back to safe defaults: everything on, and checkout = `control`. The app keeps working.

---

## 5. How every page reads flags

```
 Customer opens any page
          |
          v
 requireUser()  -------------------  no cookie? --> /login
 (lib/session.ts)                    wrong role? --> your own home page
          |
          v
 getFlags(user)   (lib/flags.ts)
          |
          |   flagsmith.getIdentityFlags("user_7", { role: "user" })
          v
 +-----------------------------------------------+
 | ordering on? themes on? leaderboard on?       |
 | title tests on? theme_options JSON?           |
 +-----------------------------------------------+
          |
          v
 Page renders the right thing. Server Actions check the SAME flags again
 before changing anything ("never trust the client").
```

The identity is always `user_<id>`, so a person gets the same answer everywhere.

---

## 6. The experiment: what we're testing

```
            CONTROL (two steps)                     EXPRESS (one step)
   +-------------------------------+      +-------------------------------+
   | Cart                          |      | Cart                          |
   |  2 x Butter chicken   Rs 680  |      |  2 x Butter chicken   Rs 680  |
   |              [ Checkout ]     |      |              [ Order now ]    |
   +---------------|---------------+      +---------------|---------------+
                   v                                      v
   +-------------------------------+      +-------------------------------+
   | Review your order             |      | +---------------------------+ |
   |  ...                          |      | | Place this order?         | |
   |              [ Place order ]  |      | | [ Place order, Rs 680 ]   | |
   +---------------|---------------+      | +---------------------------+ |
                   v                      +---------------|---------------+
              order placed                                v
                                                     order placed
```

- **Hypothesis:** one step gets at least 10% more orders.
- **Metric:** `order_placed`, where the event value is the order total.

---

## 7. The experiment: what happens behind the scenes

```
 CUSTOMER (Zara)          BROWSER                NEXT.JS SERVER                 FLAGSMITH
      O
     /|\  taps "Add"  ---> form submit ---> addToCart()
     / \                                    - saves dish in cart_items (DB)
                                            - trackEvent("add_to_cart") ---------> events
      |
      |   opens Cart  ---> GET /cart -----> cart page renders
      |                                     getCheckoutAssignment()
      |                                     getIdentityFlags("user_7") ----------> "express"
      |                                     (NO exposure recorded yet:              inExperiment
      |                                      prefetches must not count)              = true
      |                   <--- HTML with [ Order now ]
      |
      |   cart is on     ExposureBeacon ---> cartShown()
      |   screen          (useEffect)        trackExposureEvent("checkout_button",
      |                                        { identifier:"user_7", value:"express" }) -> EXPOSURE
      |
      |   taps            sheet opens ----> checkoutStarted()
      |   "Order now"                       trackEvent("checkout_started") ------------> events
      |
      |   taps            form submit ----> placeOrder()
      |   "Place order"                     1. ordering_enabled on? (else refuse)
      |                                     2. re-price the cart FROM THE DB
      |                                     3. save order + items (one transaction)
      |                                     4. trackEvent("order_placed",
      |                                          { value: 578 }) ---------------------> CONVERSION
      |                                     5. after(): flushEvents() ------------------> sent now
      |                  <--- redirect /orders?placed=143
      v
                                                                 +-----------------------------+
                                                                 | warehouse joins exposure +  |
                                                                 | conversion per identity     |
                                                                 | -> order rate per version   |
                                                                 | -> lift, credible interval, |
                                                                 |    chance to be best        |
                                                                 +-----------------------------+
```

Four details that make the numbers trustworthy:
1. **The exposure is recorded when the cart is actually seen**, not when the server renders it. That's the deferred-exposure pattern from Flagsmith's docs.
2. **Conversions only count after an exposure.** Flagsmith ignores `order_placed` from someone who never saw the cart.
3. **Prices are recomputed on the server**, so the order value can't be faked.
4. **Exposures are de-duplicated.** Refreshing the cart 10 times still counts as one person.

---

## 8. The experiment: reading the result and shipping it

```
 ADMIN (Asha)                NEXT.JS SERVER                       FLAGSMITH ADMIN API
    O
   /|\  opens Features ---> getExperiment()  ----------------> GET  .../experiments/434/
   / \                      getResults()     ----------------> GET  .../experiments/434/results/
    |                       draws the table, lift, interval
    |
    |   "Refresh results" -> refreshResults() ---------------> POST .../results/refresh/
    |                                                           (allowed once every 5 minutes)
    |
    |   picks Express,
    |   ticks "I understand",
    |   "Ship to everyone" -> shipWinner()
    |                          requireUser("admin")
    |                          completeExperiment("variant", express option id)
    |                                              ----------> POST .../experiments/434/complete/
    v                                                           experiment ends, flag unlocks,
                                                                EVERY customer now gets express.
                                                                No deploy, no code change.
```

---

## 9. The result

```
                      order rate of customers who saw the cart
  Control  |#################################                   32.7%   (235 of 719)
  Express  |########################################            39.7%   (274 of 691)

  Lift: +21.3%     95% credible interval: +4.4% to +38.3%     Chance express is best: 99.3%
```

**The traffic is simulated.** [scripts/simulate.ts](../scripts/simulate.ts) sent 2,000 customers, using rates of 33.0% for control vs 40.3% for express (+22%). Flagsmith measured +21.3%. That proves the pipeline measures correctly end to end. It doesn't prove how real customers behave.

---

## 10. The simulator

```
 for each of 2,000 simulated customers  ("sim_<run>_<n>", trait simulated: true)
      |
      |-- getIdentityFlags()  -> Flagsmith says: control or express
      |
      |-- roll dice (fixed seed, so a run can be repeated exactly)
      |      70% add to cart ----------> trackEvent(add_to_cart) + trackExposureEvent
      |        60% / 62% start checkout -> trackEvent(checkout_started)
      |          55% / 65% complete -----> trackEvent(order_placed, value)
      |
      +-- every 100 customers: flushEvents();   at the end: close()   (or events are lost)
```

```bash
npm run simulate -- --dry-run     # print the plan, send nothing
npm run simulate                  # 2,000 customers
```

Why 2,000? A power calculation for 33% vs 40.3% needs about 680 cart viewers per version. The first 600-customer run was too small and showed almost no gap, so it was topped up to the planned size. Both runs are listed in the README.

---

## 11. The kill switch

```
 Admin flips "Ordering" OFF in /admin/flags
        |
        v
 toggleFlag() -> setFlagEnabled("ordering_enabled", false)
        |        POST environments/<env>/features/<id>/versions/  { enabled:false, publish_immediately:true }
        |        (this environment uses v2 feature versioning, so every change is a new published version)
        v
 Flagsmith now answers ordering_enabled = OFF (within seconds)
        |
        +--> Home page:  "Ordering is paused for a moment"
        +--> Cart page:  [ Checkout ] greyed out, "Your cart is saved"
        +--> placeOrder(): checks the flag again -> "Ordering is paused right now."
                           (even a forged form post is refused)
```

---

## 12. Module: login and roles

```
 /login --> pick an account --> signInAs()  --> cookie platter_uid=<id> (httpOnly)
                                                    |
          +-----------------------------------------+------------------------+
          v                                         v                        v
      customer -> /                             seller -> /seller        admin -> /admin
```

- **Files:** [app/login](../app/login), [lib/session.ts](../lib/session.ts)
- **Guard:** every page and Server Action calls `requireUser(role)` or `requireSeller()`. This is a demo login with no passwords; a real provider can replace the cookie later.

---

## 13. Module: customer home (bento grid)

```
 +-----------------------------------------+  +------------------+
 |  Tandoor Tales      (busiest this week) |  | Your last order  |
 |  North Indian, grills                   |  | Dosa Republic    |
 |  [15% off after 7 pm]                   |  | [Order again]    |
 |  Seekh kebab | Butter chicken | Paneer  |  +------------------+
 |                         [ Open menu ]   |  +------------------+
 +-----------------------------------------+  | Dosa Republic    |
 +--------------------+                       | [ Open menu ]    |
 | Bowl & Bao         |                       +------------------+
 +--------------------+
```

- **File:** [app/page.tsx](../app/page.tsx)
- **Flags used:** `ordering_enabled` (shows a paused banner) and `seller_themes_enabled` (hides the colour previews when off).

---

## 14. Module: store page and which look is shown

```
 Customer opens /store/1
        |
        v
 resolveStoreTheme()  (lib/resolve-theme.ts)      FIRST MATCH WINS
        |
        |-- seller_themes_enabled OFF? ------------------> Platter look
        |-- customer chose "Always Platter look"? -------> Platter look
        |-- customer switched THIS store's look off? ----> Platter look
        |-- store has a live look? ----------------------> the seller's look
        +-- otherwise -----------------------------------> Platter look

 Platter look = black & white, follows the White/Dark switch.
 Seller look  = seller's colours, font, corners, banner, badge
                (applied as CSS variables on the store block ONLY).
```

- **Saved in Postgres:** `user_prefs` (per store, or global).
- **Events in Postgres:**
  - `store_view` and `theme_applied`, sent by a browser beacon so link prefetches don't count;
  - `theme_disabled_by_user`, when a customer switches a look off.
- **Files:** [app/store/[sellerId]](../app/store/[sellerId]), [components/storefront.tsx](../components/storefront.tsx)

---

## 15. Module: seller theme studio

```
 +----------------------------+  +---------------------------------------+
 | Name, 5 colours            |  |  LIVE PREVIEW (the real menu)         |
 | Font   <- theme_options    |  |  +---------------------------------+  |
 | Corners<- theme_options    |  |  | Tandoor Tales                   |  |
 | Buttons<- theme_options    |  |  | Straight from the clay oven     |  |
 | Banner image (<= 2 MB)     |  |  | [15% off tonight]               |  |
 | Offer badge                |  |  +---------------------------------+  |
 | ! Text on cards: 2.1 to 1  |  |  | Butter chicken  Rs 340   [Add]  |  |
 |   (contrast check < 4.5)   |  |  +---------------------------------+  |
 | [ Save look ]              |  +---------------------------------------+
 +----------------------------+
```

- **What `saveTheme()` checks on the server:**
  - the seller owns the look,
  - `seller_themes_enabled` is on,
  - the font, corners and buttons are in `theme_options`,
  - the store is under the max-looks limit,
  - the image is really PNG, JPG or WebP (it reads the file's first bytes),
  - text fields have HTML stripped out.
- **Files:** [app/seller/themes](../app/seller/themes), [lib/theme.ts](../lib/theme.ts)

---

## 16. Module: seller menu and title tests

```
 Seller starts a test on "Butter chicken":   A = "Butter chicken"   B = "Old Delhi butter chicken"
                                  |
 customer user_5 --> sha256("5:1") is odd  --> sees B   (always the same for this customer)
 customer user_6 --> sha256("6:1") is even --> sees A
                                  |
           saw it (view) --> added (add_to_cart) --> ordered (order)     stored in title_events
                                  |
   Results, counted in customers:   A  3 saw, 1 added, 0 ordered
                                    B  2 saw, 2 added, 2 ordered
   "Too early to call" until each title has 30 customers
                                  |
   [ Declare winner: B ] --> dish renamed for everyone, test ended
```

- **Why this isn't a Flagsmith experiment:** Flagsmith reports one result per experiment, not per dish, and creating experiments on the fly from the app would need Admin API calls to a beta product. So this runs inside the app, and the whole feature is behind `seller_ab_titles_enabled`.
- **Files:** [lib/title-tests.ts](../lib/title-tests.ts), [app/seller/items](../app/seller/items)

---

## 17. Module: leaderboards

```
            Kitchens (this week)                    Hungriest customers
   1  Tandoor Tales      5 orders  Rs 2,340     1  Foodie #2417   4 orders
   2  Dosa Republic      4 orders  Rs 1,120     2  Foodie #5830   3 orders
   3  Anonymous seller #3  2 orders             ...
        ^
        Bowl & Bao hid its name. It still ranks.
        Its own seller and the admin see the real name.
```

- **Windows:** weekly (Monday to Sunday) and monthly, India time.
- **Ranking:** by completed orders, with ties broken by revenue (sellers) or spend (customers).
- **Behind `leaderboard_enabled`.** Each page view logs `leaderboard_view` for the metrics.
- **Files:** [lib/leaderboard.ts](../lib/leaderboard.ts), [app/leaderboard](../app/leaderboard), [app/seller/leaderboard](../app/seller/leaderboard)

---

## 18. The admin dashboard, page by page

```
 /admin             Overview: this week's orders, the switches at a glance, link to the experiment
 /admin/flags       FEATURE CONSOLE
                    +------------------+  +--------------------------------------------+
                    | KILL SWITCH      |  | Seller store looks   [on]                  |
                    | Ordering   [on]  |  | Leaderboards         [on]                  |
                    +------------------+  | Seller title tests   [on]                  |
                                          | Store look options (theme_options JSON)    |
                                          +--------------------------------------------+
                    +--------------------------------------------+ +-------------------+
                    | THE EXPERIMENT                   running   | | Ship one version  |
                    | Version   Customers Ordered Rate  Best     | | (o) Express       |
                    | Control      719      235  32.7%  0.7%     | | ( ) Control       |
                    | Express      691      274  39.7% 99.3%     | | [x] I understand  |
                    | Lift +21.3%  (+4.4% to +38.3%)             | | [Ship to everyone]|
                    | [Refresh results] [Open in Flagsmith]      | +-------------------+
                    +--------------------------------------------+
 /admin/leaderboard Boards with real names + "Name shown/hidden" chips + seller table
 /admin/metrics     Success metrics (next section)
```

---

## 19. The admin metrics page

| Metric | Where it comes from | Label |
|---|---|---|
| Order rate by checkout version, lift, chance to be best | Flagsmith results | **Randomised**: can claim cause and effect |
| Sellers with their own look | Postgres `themes` | count |
| Customers who turned a store's look off | `user_prefs` ÷ `store_view` visitors | count |
| Orders per visit, own look vs Platter look | `orders` ÷ `store_view` | **Descriptive** |
| Sellers showing their name | `sellers` | count |
| Board views | `events.leaderboard_view` | count |
| Order growth, name shown vs hidden | `orders`, week over week | **Descriptive** |
| Title tests run, finished, average uplift | `title_tests`, `title_events` | **Descriptive** |
| Top-3 sellers' share of orders | `orders`, last 30 days | guardrail |

**Why the labels matter.** Only the checkout experiment assigned people at random. Stores with their own look might sell more simply because better sellers bother to design one. So those metrics are labelled *descriptive*, not *caused*.

---

## 20. A tour of the Flagsmith dashboard

```
 app.flagsmith.com
   |
   +-- Project 55383 > Environment "Development"
         |
         +-- Features ........ the 6 flags. checkout_button shows a lock while the experiment runs.
         |                     Every change from Platter's console shows up as a new version.
         +-- Experiments ..... "Checkout button: express vs two-step"
         |      +-- Results: Users enrolled, Winning variation, Chance to be best, Lift
         |      +-- Exposures: enrolment over time per version
         |      +-- End experiment (the same as Platter's "Ship to everyone")
         +-- Metrics ......... "Order placed" = event order_placed, occurrence, higher is better
         +-- Identities ...... user_5 ... user_9 (demo customers), sim_... (simulated customers)
         +-- Warehouse ....... the managed Flagsmith warehouse that stores events and computes results
```

---

## 21. Safety, in one table

| Risk | What stops it |
|---|---|
| Faking an order or its price | Prices are recomputed from the DB inside `placeOrder()` |
| Ordering while paused | `placeOrder()` checks `ordering_enabled` itself |
| A customer using admin powers | Every admin action starts with `requireUser("admin")` |
| A seller editing another store | Every seller action checks ownership |
| Leaking the admin key | Only used in `lib/flagsmith-admin.ts` (`server-only`), and checked absent from browser bundles |
| Fake images | First bytes are checked, files are served only by generated name, `nosniff` |
| Flagsmith down | Safe defaults; checkout falls back to `control` |
| Prefetches counted as views | Exposures and views are sent by browser beacons after the page shows |

---

## 22. File map

```
app/
  login/            demo sign-in
  page.tsx          customer home (bento)
  store/[sellerId]/ storefront, theme switches, Add button, view beacon
  cart/             cart, both checkout versions, exposure beacon, order actions
  checkout/         control's review page
  orders/           order history
  leaderboard/      public boards
  seller/           seller home, themes/ (studio), items/ (menu + title tests), leaderboard/ (name switch)
  admin/            overview, flags/ (console + experiment), leaderboard/, metrics/
  uploads/[file]/   serves banner images
lib/
  flags.ts          Flagsmith Node SDK: flags, experiment, events, safe defaults
  flagsmith-admin.ts Flagsmith Admin API: flip flags, results, ship (server only)
  resolve-theme.ts  which look a store shows
  cart.ts           server-side pricing
  title-tests.ts    hash split + results
  leaderboard.ts    ranking SQL + anonymous names
  metrics.ts        success-metric SQL
  db/schema.ts      tables (Drizzle)
scripts/
  flagsmith-setup.mjs  creates flags, metric, experiment (--start to start it)
  simulate.ts          simulated traffic
  seed.mts             demo data
```
