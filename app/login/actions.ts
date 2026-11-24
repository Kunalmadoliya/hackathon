"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { HOME_FOR, SESSION_COOKIE } from "@/lib/session";

export async function signInAs(formData: FormData) {
  const id = Number(formData.get("userId"));
  if (!Number.isInteger(id)) redirect("/login");
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  if (!user) redirect("/login");
  (await cookies()).set(SESSION_COOKIE, String(user.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(HOME_FOR[user.role]);
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
