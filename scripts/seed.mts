/**
 * FILE GUIDE
 * Fills the database with demo data (wipes it first): 1 admin, 3 sellers, 5 customers,
 * 20 dishes, 3 weeks of orders. Run: npm run db:seed.
 */
// Seeds demo data: 1 admin, 3 sellers, 5 users, ~20 items, 3 weeks of past orders.
// Run: npm run db:seed   (wipes and refills every table)
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as s from "../lib/db/schema.ts";
import { PLATFORM_THEMES } from "../lib/themes-default.ts";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: s });

// Fixed seed so the demo data is the same on every run.
let seed = 20261126;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

await db.execute(sql`truncate table order_items, orders, cart_items, title_events, title_tests,
  user_prefs, store_discounts, items, themes, sellers, users, events restart identity cascade`);

const [admin] = await db.insert(s.users).values({ name: "Asha Admin", nickname: "Admin", role: "admin" }).returning();

const sellerUsers = await db
  .insert(s.users)
  .values([
    { name: "Harpreet Singh", nickname: "Harpreet", role: "seller" },
    { name: "Lakshmi Iyer", nickname: "Lakshmi", role: "seller" },
    { name: "Kenji Rao", nickname: "Kenji", role: "seller" },
  ])
  .returning();

const people = await db
  .insert(s.users)
  .values([
    { name: "Riya Sharma", nickname: "Foodie #2417", role: "user" },
    { name: "Arjun Mehta", nickname: "Foodie #5830", role: "user" },
    { name: "Zara Khan", nickname: "Foodie #1094", role: "user" },
    { name: "Dev Patel", nickname: "Foodie #7762", role: "user" },
    { name: "Meera Nair", nickname: "Foodie #3381", role: "user" },
  ])
  .returning();

const defaults = await db
  .insert(s.themes)
  .values(PLATFORM_THEMES.map((t) => ({ sellerId: null, name: t.name, isDefault: true, tokens: t.tokens })))
  .returning();
const fresh = defaults.find((t) => t.name === "Fresh")!;

const sellers = await db
  .insert(s.sellers)
  .values([
    { userId: sellerUsers[0].id, storeName: "Tandoor Tales", cuisine: "North Indian, grills and breads" },
    { userId: sellerUsers[1].id, storeName: "Dosa Republic", cuisine: "South Indian breakfast all day", activeThemeId: fresh.id },
    { userId: sellerUsers[2].id, storeName: "Bowl & Bao", cuisine: "Ramen, bao and rice bowls", leaderboardShowName: false },
  ])
  .returning();

// Seller 1 has a custom theme and it is active.
const [custom] = await db
  .insert(s.themes)
  .values({
    sellerId: sellers[0].id,
    name: "Clay oven",
    isDefault: false,
    tokens: {
      primary: "#9A2A12",
      background: "#FFF6EC",
      surface: "#FFFFFF",
      text: "#2B1608",
      accent: "#E0A526",
      font: "Merriweather",
      radius: 16,
      buttonStyle: "pill",
      bannerUrl: null,
      bannerHeadline: "Straight from the clay oven",
      bannerSubtext: "Charcoal tandoor, fired at 480°C since 1998.",
      discountBadgeText: "15% off tonight",
      discountBadgeStyle: "stamp",
    },
  })
  .returning();
await db.execute(sql`update sellers set active_theme_id = ${custom.id} where id = ${sellers[0].id}`);

await db.insert(s.storeDiscounts).values([
  { sellerId: sellers[0].id, percent: 15, bannerText: "15% off every order after 7 pm", active: true },
  { sellerId: sellers[1].id, percent: 10, bannerText: "Breakfast combo: 10% off", active: true },
]);

const menu: Record<number, [string, string, number, string, number?][]> = {
  [sellers[0].id]: [
    ["Butter chicken", "Tandoori chicken in a tomato, butter and fenugreek gravy.", 340, "Mains"],
    ["Dal makhani", "Black lentils slow-cooked overnight with cream.", 260, "Mains"],
    ["Paneer tikka", "Charred cottage cheese, peppers, mint chutney.", 290, "Starters", 10],
    ["Garlic naan", "Tandoor bread with garlic and coriander.", 70, "Breads"],
    ["Laccha paratha", "Flaky layered wholewheat bread.", 65, "Breads"],
    ["Seekh kebab", "Minced lamb skewers, onion rings, lemon.", 360, "Starters"],
    ["Mango lassi", "Alphonso mango and yoghurt.", 120, "Drinks"],
  ],
  [sellers[1].id]: [
    ["Masala dosa", "Crisp rice crepe, spiced potato, sambar and chutneys.", 140, "Dosa"],
    ["Ghee roast dosa", "Paper-thin dosa roasted in ghee.", 170, "Dosa", 15],
    ["Idli (3)", "Steamed rice cakes with coconut chutney.", 90, "Tiffin"],
    ["Medu vada (2)", "Lentil doughnuts, sambar.", 95, "Tiffin"],
    ["Pongal", "Rice and moong dal with pepper and cumin.", 130, "Tiffin"],
    ["Filter coffee", "Chicory-blend coffee, frothed by pouring.", 60, "Drinks"],
    ["Rava kesari", "Semolina sweet with saffron and cashew.", 80, "Sweets"],
  ],
  [sellers[2].id]: [
    ["Tonkotsu ramen", "Pork bone broth, chashu, soft egg, noodles.", 420, "Ramen"],
    ["Miso veg ramen", "Miso broth, corn, bok choy, tofu.", 360, "Ramen"],
    ["Pork belly bao (2)", "Braised belly, pickles, peanut.", 280, "Bao", 20],
    ["Crispy tofu bao (2)", "Sesame tofu, slaw, sriracha mayo.", 240, "Bao"],
    ["Chicken katsu bowl", "Panko chicken, curry sauce, rice.", 330, "Bowls"],
    ["Iced yuzu soda", "Yuzu, honey, soda.", 140, "Drinks"],
  ],
};

const allItems = [];
for (const [sellerId, rows] of Object.entries(menu)) {
  const inserted = await db
    .insert(s.items)
    .values(
      rows.map(([title, description, price, category, discount]) => ({
        sellerId: Number(sellerId),
        title,
        description,
        price,
        category,
        discountPercent: discount ?? 0,
      })),
    )
    .returning();
  allItems.push(...inserted);
}

// Three weeks of past orders. Weighted so the boards have a clear order.
const sellerWeight = [0.45, 0.35, 0.2];
const now = Date.now();
let orderCount = 0;
for (let d = 21; d >= 1; d--) {
  const perDay = 4 + Math.floor(rand() * 5);
  for (let k = 0; k < perDay; k++) {
    const r = rand();
    const seller = r < sellerWeight[0] ? sellers[0] : r < sellerWeight[0] + sellerWeight[1] ? sellers[1] : sellers[2];
    const user = pick(people);
    const sellerItems = allItems.filter((i) => i.sellerId === seller.id);
    const lines = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => ({ item: pick(sellerItems), qty: 1 + Math.floor(rand() * 2) }));
    const total = lines.reduce((t, l) => t + l.item.price * l.qty, 0);
    const createdAt = new Date(now - d * 86400000 + Math.floor(rand() * 12 * 3600000));
    const [order] = await db
      .insert(s.orders)
      .values({ userId: user.id, sellerId: seller.id, total, status: "completed", createdAt })
      .returning();
    await db.insert(s.orderItems).values(
      lines.map((l) => ({ orderId: order.id, itemId: l.item.id, titleShown: l.item.title, quantity: l.qty, price: l.item.price })),
    );
    orderCount++;
  }
}

console.log(
  `Seeded: admin #${admin.id}, ${sellers.length} sellers, ${people.length} users, ${allItems.length} items, ${orderCount} orders, ${defaults.length} platform themes.`,
);
await pool.end();
