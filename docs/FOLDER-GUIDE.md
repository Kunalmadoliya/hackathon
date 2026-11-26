# Folder guide: what's where and how it connects

Plain English, folder by folder. Every code file also starts with a short `FILE GUIDE` comment saying what it does and what it's connected to. All of those notes are collected in one table in [FILE-INDEX.md](FILE-INDEX.md).

---

## The whole project on one page

```
 hackathon/
 |
 +-- app/          THE SCREENS. One folder = one web address.
 |                 Each screen has a page (what you see) and often
 |                 an actions file (what happens when you press a button).
 |
 +-- components/   SHARED PIECES used by many screens: the top bar, the store drawing,
 |                 the leaderboard lists, the White/Dark switch.
 |
 +-- lib/          THE BRAINS. No screens here, just the logic: talking to Flagsmith,
 |                 talking to the database, prices, which look a store shows, rankings.
 |
 +-- scripts/      THINGS YOU RUN BY HAND: fill demo data, set up Flagsmith, send simulated traffic.
 |
 +-- docs/         WRITING: the PRD, this guide, how-it-works, the demo video script.
 |
 +-- public/       Static files (favicon and starter images).
 +-- uploads/      Banner images sellers upload. Not in git.
 |
 +-- package.json        list of libraries and the npm commands (npm run dev, simulate, ...)
 +-- .env.local          YOUR SECRET KEYS (Flagsmith, database). Not in git.
 +-- .env.example        the same list with the values blank, safe to share
 +-- docker-compose.yml  starts the Postgres database
 +-- next.config.ts      Next.js settings
 +-- drizzle.config.ts   database tool settings
 +-- tsconfig.json       TypeScript settings
```

---

## How the three main folders talk to each other

```
     YOU (in the browser)
          O
         /|\
         / \
          |  open a page / press a button
          v
   +--------------+   uses    +---------------+
   |    app/      | --------> |  components/  |   (top bar, store drawing, boards)
   |  (screens +  |           +---------------+
   |   actions)   |
   +--------------+
          |  every screen and action asks lib/ to do the real work
          v
   +-------------------------------------------------------------+
   |                           lib/                              |
   |                                                             |
   |  session.ts ......... "who are you?"  (reads your cookie)   |
   |  flags.ts ........... "what does Flagsmith say?"            |
   |  flagsmith-admin.ts . "change Flagsmith" (admin only)       |
   |  db/ ................ "read or write the database"          |
   |  cart.ts, resolve-theme.ts, title-tests.ts,                 |
   |  leaderboard.ts, metrics.ts ... the business rules          |
   +-------------------------------------------------------------+
          |                                   |
          v                                   v
   +---------------+                 +--------------------+
   |   POSTGRES    |                 |     FLAGSMITH      |
   | (your data)   |                 | (switches, the A/B |
   |               |                 |  test, results)    |
   +---------------+                 +--------------------+
```

**The one rule:** screens never talk to the database or Flagsmith directly. They always go through `lib/`. That way the safety checks (who you are, is this allowed, is the price right) live in one place.

---

## app/: the screens

Each folder name is part of the web address. `page.tsx` is what you see. `actions.ts` runs on the server when you press a button.

### Shared by every screen

| File | What it is |
|---|---|
| `layout.tsx` | The frame around every page: fonts, styles, top bar, and the White/Dark script |
| `globals.css` | All colours (White and Dark sets), the bento grid, buttons and switches |
| `loading.tsx` | The grey blocks shown while a page loads |
| `track-actions.ts` | Saves page views (leaderboard visits) for the metrics page |
| `uploads/[file]/route.ts` | Serves seller banner images |

### `app/login/`: signing in
```
 /login  --pick a person-->  actions.ts: signInAs()  --cookie-->  your home page
```
- `page.tsx`: the list of demo accounts.
- `actions.ts`: sign in and sign out.

### `app/page.tsx`: customer home (`/`)
The kitchens in a bento grid, plus your last order. It shows "Ordering is paused" if the kill switch is off.

### `app/store/[sellerId]/`: one store's menu (`/store/1`)
| File | What it is |
|---|---|
| `page.tsx` | Draws the store in its look, the look switches, and the dishes |
| `actions.ts` | Look switches on/off, and logging a store visit |
| `add-button.tsx` | The "Add" button on each dish |
| `view-beacon.tsx` | An invisible helper that logs the visit once the page is really on screen |

### `app/cart/` and `app/checkout/`: buying (THE EXPERIMENT)
| File | What it is |
|---|---|
| `cart/page.tsx` | Asks Flagsmith "control or express?", then shows **Checkout** or **Order now** |
| `cart/actions.ts` | Add to cart, record the exposure, start checkout, place the order, send events to Flagsmith |
| `cart/checkout-controls.tsx` | The exposure beacon, the Place order button, and the express confirm sheet |
| `checkout/page.tsx` | The review page (control version only) |

### `app/orders/`: order history and the "Order placed" message

### `app/leaderboard/`: public leaderboard (`/leaderboard`)

### `app/seller/`: everything a seller sees
| Folder | Address | What it is |
|---|---|---|
| `page.tsx` | `/seller` | This week's orders, the live look, shortcuts |
| `themes/` | `/seller/themes` | The theme studio: list of looks, editor with live preview, save/activate/delete |
| `items/` | `/seller/items` | The menu: dishes, store discount, and **title tests** in `items/[id]/ab-test` |
| `leaderboard/` | `/seller/leaderboard` | The "show my name on leaderboards" switch |

### `app/admin/`: everything the admin sees
| Folder | Address | What it is |
|---|---|---|
| `page.tsx` | `/admin` | Overview |
| `flags/` | `/admin/flags` | **Feature console**: kill switch, other switches, experiment results, Ship to everyone |
| `leaderboard/` | `/admin/leaderboard` | Boards with real names, plus the seller table |
| `metrics/` | `/admin/metrics` | Success metrics (Randomised vs Descriptive) |

---

## components/: shared pieces

| File | What it is | Used by |
|---|---|---|
| `site-header.tsx` | Top bar: logo, menu for your role, Switch account, White/Dark | every page (via `layout.tsx`) |
| `theme-toggle.tsx` | The White / Dark switch | the top bar |
| `storefront.tsx` | Draws a store in the seller's colours or the Platter look | store page, theme editor preview |
| `boards.tsx` | Leaderboard lists and the week/month tabs | both leaderboard pages |
| `page-view.tsx` | Invisible helper that logs a page view | leaderboard page |

---

## lib/: the brains

```
                         +-----------------+
                         |   session.ts    |  who are you? (every page uses this first)
                         +-----------------+
                                  |
     +----------------------------+-----------------------------+
     |                            |                             |
+-----------+            +-----------------+           +-------------------+
| flags.ts  |            |     db/         |           | flagsmith-admin.ts|
| FLAGSMITH |            | index.ts  open  |           | FLAGSMITH ADMIN   |
| read flags|            | schema.ts tables|           | flip flags, read  |
| A/B group |            +-----------------+           | results, ship     |
| send      |                     ^                    | (admin key, never |
| events    |                     |                    |  in the browser)  |
+-----------+                     |                    +-------------------+
     ^          +-----------------+------------------+
     |          |          |           |             |
     |     cart.ts   resolve-theme.ts  title-tests.ts  leaderboard.ts / metrics.ts / queries.ts
     |     prices    which look to     A or B title    rankings, numbers,
     |               show a store      per customer    small shared queries
     |
     +---- resolve-theme.ts also asks flags.ts "are store looks switched on?"

 Helpers with no database:  theme.ts (contrast, colours, text cleaning),
                            themes-default.ts (the 3 Platter looks),
                            store-fonts.ts (the 4 fonts),
                            flags-types.ts (theme_options shape, browser-safe)
```

| File | In one line |
|---|---|
| `session.ts` | Reads your login cookie, and blocks pages you're not allowed on |
| `flags.ts` | **The Flagsmith connection**: flags, your A/B group, exposures, events, safe defaults |
| `flagsmith-admin.ts` | **Changes Flagsmith**: flip a flag, read or refresh results, ship the winner |
| `db/index.ts` | Opens the database connection |
| `db/schema.ts` | The 12 tables |
| `cart.ts` | Builds the cart and works out prices from the database |
| `resolve-theme.ts` | Picks a store's look, first match wins |
| `theme.ts` | Contrast check, store colour variables, text cleaning, checks against `theme_options` |
| `themes-default.ts` | The Classic, Night and Fresh looks |
| `store-fonts.ts` | Loads the 4 fonts sellers can pick |
| `store-data.ts` | Loads one store: menu, discount, looks |
| `title-tests.ts` | Title tests: who sees A or B, logging, results |
| `leaderboard.ts` | Ranking queries, and "Anonymous seller #N" |
| `metrics.ts` | Numbers for the metrics page |
| `queries.ts` | Kitchen cards, last order, India week start, ₹ formatting |
| `flags-types.ts` | `theme_options` shape and defaults (safe for the browser) |

---

## scripts/: things you run by hand

| File | Command | What it does |
|---|---|---|
| `seed.mts` | `npm run db:seed` | Wipes and refills the database with demo data |
| `flagsmith-setup.mjs` | `npm run flagsmith:setup` | Creates the 6 flags, the metric and the experiment in Flagsmith (`--start` starts it) |
| `simulate.ts` | `npm run simulate` | Sends simulated customers through the experiment |

---

## The main flows

### Flow 1: opening any page
```
  O    opens /store/1
 /|\ ---------------> app/store/[sellerId]/page.tsx
 / \                        |
                            |-- lib/session.ts ......... are you signed in, and a customer?
                            |-- lib/flags.ts ........... ask Flagsmith: which switches are on?
                            |-- lib/store-data.ts ...... get the menu from Postgres
                            |-- lib/resolve-theme.ts ... seller's look or Platter look?
                            +-- components/storefront .. draw it
                            |
  O  <----------------------+  page appears
 /|\    then view-beacon.tsx quietly says "I'm on screen" -> visit saved in Postgres
 / \
```

### Flow 2: buying something (the experiment)
```
  O  "Add"        add-button.tsx -> cart/actions.ts addToCart()
 /|\ ----------->   saves to cart (Postgres) + tells Flagsmith "add_to_cart"
 / \
  |  opens Cart   cart/page.tsx -> lib/flags.ts: "control or express?"  (Flagsmith answers)
  |
  |  cart shows   checkout-controls.tsx ExposureBeacon -> cartShown()
  |               -> tells Flagsmith "this person SAW this version"   (exposure)
  |
  |  control:  [Checkout] -> /checkout review page -> [Place order]
  |  express:  [Order now] -> confirm sheet -> [Place order]
  |
  |  Place order  cart/actions.ts placeOrder():
  |                 1. kill switch on?           (asks Flagsmith)
  |                 2. prices from the database  (lib/cart.ts)
  |                 3. save the order            (Postgres)
  |                 4. tell Flagsmith "order_placed", with the total   (conversion)
  v
 /orders  "Order placed"

 Flagsmith then adds up: who saw which version, and who ordered -> the result
```

### Flow 3: the admin flips a switch
```
  O  flips "Leaderboards" off on /admin/flags
 /|\ ---------> console-forms.tsx -> admin/flags/actions.ts toggleFlag()
 / \                -> are you the admin?            (lib/session.ts)
                    -> lib/flagsmith-admin.ts -> FLAGSMITH: publish "off"
                                                        |
  O  a customer opens /leaderboard                      |
 /|\ ---------> lib/flags.ts asks Flagsmith  <----------+
 / \            "leaderboard_enabled = off" -> "switched off right now"

 No code change, no redeploy. Seconds later, everyone sees the change.
```

### Flow 4: the admin reads the result and ships the winner
```
  O  opens /admin/flags
 /|\ ---------> lib/flagsmith-admin.ts -> FLAGSMITH: "give me the results"
 / \            <- control 32.7%, express 39.7%, lift +21.3%, 99.3% chance express is best
  |
  |  ticks "I understand", presses [Ship to everyone]
  +---------> shipWinner() -> FLAGSMITH: end the experiment, serve express to everyone
```

### Flow 5: a seller designs a look
```
  O  /seller/themes/new
 /|\ ---------> editor.tsx: pick colours, font, banner ... live preview (components/storefront)
 / \            [Save look] -> seller/themes/actions.ts saveTheme()
                    -> do you own it?                       (lib/session.ts)
                    -> store looks switched on? allowed fonts?  (lib/flags.ts: Flagsmith)
                    -> real image? clean text?              (lib/theme.ts)
                    -> save                                 (Postgres)
  O  customer opens the store -> lib/resolve-theme.ts picks the new look
 /|\
 / \
```

### Flow 6: a seller tests two dish titles
```
  O  seller: /seller/items/1/ab-test -> start test "Butter chicken" vs "Old Delhi butter chicken"
 /|\                                          (saved in Postgres: title_tests)
 / \
  O  customer opens the store -> lib/title-tests.ts: hash(customer + test) -> A or B
 /|\ always the same title for that customer
 / \ saw / added / ordered are logged in title_events
  |
  O  seller sees results -> [Declare winner] -> dish renamed for everyone
```

---

## Where your secrets are, and where they're used

```
 .env.local  (never in git)
   |
   +-- DATABASE_URL ................... lib/db/index.ts
   +-- FLAGSMITH_SERVER_KEY ........... lib/flags.ts, scripts/simulate.ts
   +-- FLAGSMITH_ADMIN_API_KEY ........ lib/flagsmith-admin.ts, scripts/flagsmith-setup.mjs
   +-- FLAGSMITH_PROJECT_ID / ENVIRONMENT_KEY / EXPERIMENT_ID ... the same two admin files
   +-- NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_ID ... the browser-safe key (not used by the app today)
```

All of these are read only on the server. They don't appear in any of the browser bundles; this was checked when the app was built.
