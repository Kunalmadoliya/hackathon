# Demo video script (about 3 minutes)

The judges score four things: use of Flagsmith, impact, creativity and the demo. Track 01 rewards one experiment done well, so most of the time goes to the experiment. Record at 1280×800 or larger, in the White theme, with the Flagsmith dashboard open in a second tab.

**Before recording:**
- Run `npm run dev`.
- Make sure ordering is on.
- In Flagsmith, refresh the experiment results so they're current.
- Sign out, so you start on `/login`.

---

## 1. The problem (0:00 to 0:20)

**Screen:** `/login`, then sign in as **Riya**. Show the home page.

**Say:** "Food apps lose people at checkout. Every extra step is a chance to give up. Platter is a food marketplace I built to test one question with Flagsmith: does a one-step checkout get more people to order?"

## 2. Two versions behind one flag (0:20 to 1:00)

**Screen:**
1. As Riya, open **Tandoor Tales**, add a dish, and open **Cart**. The button says **Checkout**. Click it to show the review page.
2. Switch account to **Zara**. Add a dish and open **Cart**. The button says **Order now**. Click it to show the confirm sheet.

**Say:** "Flagsmith puts every customer in one of two versions of the `checkout_button` flag. Riya gets control: Checkout, then a review page, then Place order. Zara gets express: one button and a confirm sheet. Each person always gets the same version. The app records an exposure only when the cart is actually on screen, and it sends `order_placed`, with the order total, from the server after the order is saved."

**Screen:** Place Zara's order.

## 3. The result (1:00 to 1:50)

**Screen:** Sign in as **Asha (admin)**, then open **Features**. Point at the experiment panel: customers per version, order rate, chance to be best, and lift. Then switch to the Flagsmith tab and show the same experiment there.

**Say:** "The traffic here is simulated, and I want to be upfront about that. A script sent 2,000 simulated customers through Flagsmith. I gave control a 33% order rate and express 40%, about a 22% lift. The rates are printed by the script and listed in the README. Flagsmith measured a 21.3% lift, with a 99.3% chance that express is better, and a credible interval of plus 4 to plus 38%. That's close to what I put in, which shows the measurement works end to end. The first 600 customers alone weren't enough to tell the versions apart, so I sized the run with a power calculation and sent the rest. Both runs are in the README."

**Screen:** Tick the confirm box and press **Ship to everyone** with Express selected. Or, if you want to keep the experiment running, just point at the button.

**Say:** "When the result is clear, the admin ships the winner from inside the app. That ends the experiment in Flagsmith, and every customer gets express, with no new release."

## 4. Flagsmith beyond the experiment (1:50 to 2:35)

**Screen:** On the Features page, switch **Ordering** off. Switch to Riya's cart and show the disabled button and the "paused" message. Switch Ordering back on.

**Say:** "Ordering has a kill switch. Off, the button is disabled, and the server refuses orders even if someone forges the request."

**Screen:** Sign in as **Harpreet** and open **Store look**. Change a colour and show the live preview. Then show the contrast warning.

**Say:** "Sellers design their own store pages. Flagsmith's `theme_options` remote config decides which fonts and shapes are allowed, and `seller_themes_enabled` can turn the whole feature off. The database only remembers what each seller chose."

**Screen:** As Riya on the Tandoor Tales store, switch **Use this store's look** off, and show the Platter look.

## 5. Honest metrics and close (2:35 to 3:00)

**Screen:** As the admin, open **Metrics**. Point at the *Randomised* label on the experiment and the *Descriptive* labels on the others.

**Say:** "Only the checkout experiment can claim cause and effect, because Flagsmith assigned people at random. Metrics like theme impact compare sellers who chose different settings, so the app labels them descriptive. Platter: a food app that tests its own ideas, with Flagsmith deciding what each person sees and measuring what works."

---

**Checklist for the video:**
- [ ] It says the traffic is simulated, and states the rates used.
- [ ] It shows both checkout versions.
- [ ] It shows the result in Flagsmith itself, not just in the app.
- [ ] It shows a flag change taking effect without a deploy.
