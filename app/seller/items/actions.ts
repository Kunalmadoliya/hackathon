/**
 * FILE GUIDE
 * Server actions for the seller: saveItem, saveStoreDiscount, startTitleTest, declareWinner,
 * setLeaderboardName. Each one checks the dish or test belongs to your store.
 * Uses: lib/db, lib/flags, lib/theme (cleanText).
 */
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSeller } from "@/lib/session";
import { getFlags } from "@/lib/flags";
import { cleanText } from "@/lib/theme";

const { items, storeDiscounts, titleTests, sellers } = schema;

export type FormState = { message?: string; ok?: boolean };

async function ownItem(sellerId: number, id: number) {
  const [i] = await db.select().from(items).where(and(eq(items.id, id), eq(items.sellerId, sellerId))).limit(1);
  return i ?? null;
}

function readItem(formData: FormData) {
  const title = cleanText(formData.get("title"), 60);
  const description = cleanText(formData.get("description"), 200) ?? "";
  const category = cleanText(formData.get("category"), 30) ?? "Mains";
  const price = Math.round(Number(formData.get("price")) * 100) / 100;
  const discountPercent = Math.floor(Number(formData.get("discountPercent") || 0));
  const available = formData.get("available") === "on";
  if (!title) return { error: "Give the dish a name." } as const;
  if (!Number.isFinite(price) || price <= 0 || price > 100000) return { error: "Enter a price above ₹0." } as const;
  if (!Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 90) return { error: "Discount must be 0 to 90%." } as const;
  return { value: { title, description, category, price, discountPercent, available } } as const;
}

export async function saveItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireSeller();
  const parsed = readItem(formData);
  if ("error" in parsed) return { message: parsed.error };
  const id = Number(formData.get("id")) || null;
  if (id) {
    if (!(await ownItem(me.sellerId, id))) return { message: "That dish is not on your menu." };
    await db.update(items).set(parsed.value).where(eq(items.id, id));
  } else {
    await db.insert(items).values({ ...parsed.value, sellerId: me.sellerId });
  }
  revalidatePath("/seller/items");
  redirect("/seller/items?saved=1");
}

export async function saveStoreDiscount(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireSeller();
  const percent = Math.floor(Number(formData.get("percent") || 0));
  const bannerText = cleanText(formData.get("bannerText"), 80) ?? "";
  const active = formData.get("active") === "on";
  if (!Number.isInteger(percent) || percent < 0 || percent > 90) return { message: "Store discount must be 0 to 90%." };
  if (active && percent > 0 && !bannerText) return { message: "Add a line customers will see, like “15% off after 7 pm”." };
  const [existing] = await db
    .select()
    .from(storeDiscounts)
    .where(eq(storeDiscounts.sellerId, me.sellerId))
    .orderBy(desc(storeDiscounts.id))
    .limit(1);
  const value = { percent, bannerText, active: active && percent > 0 };
  if (existing) await db.update(storeDiscounts).set(value).where(eq(storeDiscounts.id, existing.id));
  else await db.insert(storeDiscounts).values({ ...value, sellerId: me.sellerId });
  revalidatePath("/seller/items");
  return { ok: true, message: value.active ? "Store discount is live." : "Store discount is off." };
}

/** Title A/B test (PRD section 6). Built in the app, gated by seller_ab_titles_enabled. */
export async function startTitleTest(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireSeller();
  const flags = await getFlags(me);
  if (!flags.sellerAbTitlesEnabled) return { message: "Title tests are switched off across Platter right now." };
  const item = await ownItem(me.sellerId, Number(formData.get("itemId")));
  if (!item) return { message: "That dish is not on your menu." };
  const titleA = cleanText(formData.get("titleA"), 60);
  const titleB = cleanText(formData.get("titleB"), 60);
  if (!titleA || !titleB) return { message: "Enter both titles." };
  if (titleA.toLowerCase() === titleB.toLowerCase()) return { message: "The two titles must be different." };
  const [running] = await db
    .select({ id: titleTests.id })
    .from(titleTests)
    .where(and(eq(titleTests.itemId, item.id), eq(titleTests.status, "running")))
    .limit(1);
  if (running) return { message: "This dish already has a test running." };
  await db.insert(titleTests).values({ itemId: item.id, titleA, titleB });
  revalidatePath(`/seller/items/${item.id}/ab-test`);
  return { ok: true, message: "Test started. Half of customers now see each title." };
}

export async function declareWinner(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireSeller();
  const testId = Number(formData.get("testId"));
  const winner = formData.get("winner");
  if (winner !== "a" && winner !== "b") return { message: "Pick the winning title." };
  const [t] = await db
    .select({ test: titleTests, sellerId: items.sellerId })
    .from(titleTests)
    .innerJoin(items, eq(items.id, titleTests.itemId))
    .where(eq(titleTests.id, testId))
    .limit(1);
  if (!t || t.sellerId !== me.sellerId) return { message: "That test is not on your menu." };
  if (t.test.status !== "running") return { message: "That test has already ended." };
  const title = winner === "a" ? t.test.titleA : t.test.titleB;
  await db.transaction(async (tx) => {
    await tx.update(titleTests).set({ status: "ended", winner, endedAt: new Date() }).where(eq(titleTests.id, testId));
    await tx.update(items).set({ title }).where(eq(items.id, t.test.itemId));
  });
  revalidatePath(`/seller/items/${t.test.itemId}/ab-test`);
  return { ok: true, message: `“${title}” is now the dish’s title for everyone.` };
}

export async function setLeaderboardName(formData: FormData) {
  const me = await requireSeller();
  const show = formData.get("show") === "1";
  await db.update(sellers).set({ leaderboardShowName: show }).where(eq(sellers.id, me.sellerId));
  revalidatePath("/seller/leaderboard");
  revalidatePath("/leaderboard");
}
