/**
 * FILE GUIDE
 * Server actions for looks: saveTheme (checks theme_options from Flagsmith, checks the image,
 * strips HTML), activateTheme, resetToDefault, deleteTheme. Each one checks you own the look.
 * Uses: lib/flags, lib/theme, lib/db. Writes images to uploads/.
 */
"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, count, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSeller } from "@/lib/session";
import { getFlags } from "@/lib/flags";
import { parseTokens, type TokenErrors } from "@/lib/theme";

const { themes, sellers } = schema;

export type SaveState = { errors?: TokenErrors; message?: string };

const MAX_BYTES = 2 * 1024 * 1024;
// Check the file's first bytes, not just its name or browser-reported type.
function sniff(buf: Buffer): "png" | "jpg" | "webp" | null {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

async function gate() {
  const me = await requireSeller();
  const flags = await getFlags(me);
  return { me, flags };
}

async function ownTheme(sellerId: number, id: number) {
  const [t] = await db.select().from(themes).where(and(eq(themes.id, id), eq(themes.sellerId, sellerId))).limit(1);
  return t ?? null;
}

export async function saveTheme(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const { me, flags } = await gate();
  if (!flags.sellerThemesEnabled) return { message: "Store looks are switched off across Platter right now." };

  const id = Number(formData.get("id")) || null;
  const raw = Object.fromEntries(formData.entries());

  // Banner upload (optional). Keeps the existing banner unless a new file or "remove" is sent.
  const file = formData.get("bannerFile");
  if (formData.get("removeBanner") === "1") raw.bannerUrl = "";
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return { errors: { bannerUrl: "The banner must be 2 MB or smaller." } };
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = sniff(buf);
    if (!ext) return { errors: { bannerUrl: "Use a PNG, JPG or WebP image." } };
    const dir = path.join(process.cwd(), "uploads");
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}.${ext}`;
    await writeFile(path.join(dir, name), buf);
    raw.bannerUrl = `/uploads/${name}`;
  }

  const { tokens, name, errors } = parseTokens(raw, flags.themeOptions);
  if (Object.keys(errors).length) return { errors, message: "Check the highlighted fields." };

  if (id) {
    const existing = await ownTheme(me.sellerId, id);
    if (!existing) return { message: "That look does not belong to your store." };
    await db.update(themes).set({ name, tokens }).where(eq(themes.id, id));
  } else {
    const [{ n }] = await db.select({ n: count() }).from(themes).where(eq(themes.sellerId, me.sellerId));
    if (n >= flags.themeOptions.maxThemesPerSeller) {
      return { message: `You can keep up to ${flags.themeOptions.maxThemesPerSeller} looks. Delete one to make room.` };
    }
    const [created] = await db.insert(themes).values({ sellerId: me.sellerId, name, isDefault: false, tokens }).returning();
    if (formData.get("activate") === "1") {
      await db.update(sellers).set({ activeThemeId: created.id }).where(eq(sellers.id, me.sellerId));
    }
  }
  revalidatePath("/seller/themes");
  redirect("/seller/themes?saved=1");
}

export async function activateTheme(formData: FormData) {
  const { me, flags } = await gate();
  if (!flags.sellerThemesEnabled) redirect("/seller/themes");
  const id = Number(formData.get("id"));
  // A seller may activate their own look or a platform default, nothing else.
  const [t] = await db.select().from(themes).where(eq(themes.id, id)).limit(1);
  if (!t || (t.sellerId !== null && t.sellerId !== me.sellerId) || (t.sellerId === null && !t.isDefault)) {
    redirect("/seller/themes");
  }
  await db.update(sellers).set({ activeThemeId: t.id }).where(eq(sellers.id, me.sellerId));
  revalidatePath("/seller/themes");
  redirect("/seller/themes");
}

export async function resetToDefault(formData: FormData) {
  const { me } = await gate();
  // Allowed even when themes are off: going back to a default is always safe.
  const id = Number(formData.get("id"));
  const [t] = await db
    .select()
    .from(themes)
    .where(and(eq(themes.id, id), isNull(themes.sellerId), eq(themes.isDefault, true)))
    .limit(1);
  await db.update(sellers).set({ activeThemeId: t ? t.id : null }).where(eq(sellers.id, me.sellerId));
  revalidatePath("/seller/themes");
  redirect("/seller/themes");
}

export async function deleteTheme(formData: FormData) {
  const { me } = await gate();
  const id = Number(formData.get("id"));
  const t = await ownTheme(me.sellerId, id);
  const [seller] = await db.select().from(sellers).where(eq(sellers.id, me.sellerId)).limit(1);
  if (!t || seller.activeThemeId === t.id) redirect("/seller/themes?error=active");
  await db.delete(themes).where(eq(themes.id, id));
  revalidatePath("/seller/themes");
  redirect("/seller/themes");
}
