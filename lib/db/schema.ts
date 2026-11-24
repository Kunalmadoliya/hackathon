import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  jsonb,
  numeric,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "seller", "user"]);
export const testStatusEnum = pgEnum("test_status", ["running", "ended"]);
export const variantEnum = pgEnum("title_variant", ["a", "b"]);
export const titleEventTypeEnum = pgEnum("title_event_type", ["view", "add_to_cart", "order"]);

export type ThemeTokens = {
  primary: string;
  background: string;
  surface: string;
  text: string;
  accent: string;
  font: string;
  radius: number;
  buttonStyle: "square" | "rounded" | "pill";
  bannerUrl?: string | null;
  bannerHeadline?: string | null;
  bannerSubtext?: string | null;
  discountBadgeText?: string | null;
  discountBadgeStyle?: "ribbon" | "stamp" | "pill";
};

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nickname: text("nickname").notNull(),
  role: roleEnum("role").notNull(),
});

export const sellers = pgTable("sellers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  storeName: text("store_name").notNull(),
  cuisine: text("cuisine").notNull().default(""),
  leaderboardShowName: boolean("leaderboard_show_name").notNull().default(true),
  activeThemeId: integer("active_theme_id"),
});

export const themes = pgTable("themes", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").references(() => sellers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  tokens: jsonb("tokens").$type<ThemeTokens>().notNull(),
});

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull().references(() => sellers.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  price: numeric("price", { precision: 10, scale: 2, mode: "number" }).notNull(),
  imageUrl: text("image_url"),
  category: text("category").notNull().default("Mains"),
  available: boolean("available").notNull().default(true),
  discountPercent: integer("discount_percent").notNull().default(0),
});

export const storeDiscounts = pgTable("store_discounts", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull().references(() => sellers.id, { onDelete: "cascade" }),
  percent: integer("percent").notNull(),
  bannerText: text("banner_text").notNull().default(""),
  active: boolean("active").notNull().default(true),
});

export const titleTests = pgTable("title_tests", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  titleA: text("title_a").notNull(),
  titleB: text("title_b").notNull(),
  status: testStatusEnum("status").notNull().default("running"),
  winner: variantEnum("winner"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const titleEvents = pgTable(
  "title_events",
  {
    id: serial("id").primaryKey(),
    testId: integer("test_id").notNull().references(() => titleTests.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id),
    variant: variantEnum("variant").notNull(),
    type: titleEventTypeEnum("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("title_events_test_idx").on(t.testId)],
);

export const userPrefs = pgTable(
  "user_prefs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    // null = the global "always use the default theme" switch
    sellerId: integer("seller_id").references(() => sellers.id, { onDelete: "cascade" }),
    useSellerTheme: boolean("use_seller_theme").notNull(),
  },
  (t) => [index("user_prefs_user_seller_idx").on(t.userId, t.sellerId)],
);

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    sellerId: integer("seller_id").notNull().references(() => sellers.id),
    total: numeric("total", { precision: 10, scale: 2, mode: "number" }).notNull(),
    status: text("status").notNull().default("completed"),
    checkoutVariant: text("checkout_variant"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("orders_created_idx").on(t.createdAt)],
);

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  itemId: integer("item_id").notNull().references(() => items.id),
  titleShown: text("title_shown").notNull(),
  quantity: integer("quantity").notNull(),
  price: numeric("price", { precision: 10, scale: 2, mode: "number" }).notNull(),
});

// Cart lives in the DB so the server never trusts client-side prices.
export const cartItems = pgTable(
  "cart_items",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    itemId: integer("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
  },
  (t) => [uniqueIndex("cart_user_item_uq").on(t.userId, t.itemId)],
);

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(),
    userId: integer("user_id"),
    sellerId: integer("seller_id"),
    city: text("city"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_type_idx").on(t.type)],
);
