/**
 * FILE GUIDE
 * Who is signed in: reads the login cookie, and requireUser / requireSeller guards.
 * Every page and server action calls these first. Uses: lib/db.
 */
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";

// POC auth: a demo role switcher stores the user id in a cookie (PRD section 3).
export const SESSION_COOKIE = "platter_uid";

export type Role = "admin" | "seller" | "user";
export type CurrentUser = { id: number; name: string; nickname: string; role: Role; sellerId: number | null };

export const HOME_FOR: Record<Role, string> = { admin: "/admin", seller: "/seller", user: "/" };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  const id = Number(raw);
  if (!raw || !Number.isInteger(id)) return null;
  const [row] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      nickname: schema.users.nickname,
      role: schema.users.role,
      sellerId: schema.sellers.id,
    })
    .from(schema.users)
    .leftJoin(schema.sellers, eq(schema.sellers.userId, schema.users.id))
    .where(eq(schema.users.id, id))
    .limit(1);
  return row ?? null;
}

/** Server-side gate. Never trust the client: every page and action calls this. */
export async function requireUser(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles.length && !roles.includes(user.role)) redirect(HOME_FOR[user.role]);
  return user;
}

export async function requireSeller(): Promise<CurrentUser & { sellerId: number }> {
  const user = await requireUser("seller");
  if (!user.sellerId) redirect("/login");
  return user as CurrentUser & { sellerId: number };
}
