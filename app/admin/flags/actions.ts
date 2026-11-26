/**
 * FILE GUIDE
 * Server actions that change Flagsmith: toggleFlag, refreshExperiment, shipWinner.
 * Admin only. They call lib/flagsmith-admin.ts, which holds the secret admin key.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { FLAG } from "@/lib/flags";
import {
  AdminApiError,
  completeExperiment,
  getExperiment,
  refreshExposures,
  refreshResults,
  setFlagEnabled,
  variantOptionId,
} from "@/lib/flagsmith-admin";

export type ConsoleState = { message?: string; ok?: boolean };

// Only these switches can be changed from the app. checkout_button is run by the experiment.
const SWITCHABLE = new Set<string>([FLAG.orderingEnabled, FLAG.sellerThemesEnabled, FLAG.leaderboardEnabled, FLAG.sellerAbTitlesEnabled]);

const explain = (e: unknown) =>
  e instanceof AdminApiError ? `Flagsmith said: ${e.message}` : "Could not reach Flagsmith. Try again in a moment.";

export async function toggleFlag(_prev: ConsoleState, formData: FormData): Promise<ConsoleState> {
  await requireUser("admin");
  const name = String(formData.get("flag"));
  const enabled = formData.get("enabled") === "1";
  if (!SWITCHABLE.has(name)) return { message: "That flag can't be changed here." };
  try {
    await setFlagEnabled(name, enabled);
  } catch (e) {
    return { message: explain(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: `${enabled ? "Switched on" : "Switched off"}. Live for everyone within a few seconds.` };
}

export async function refreshExperiment(_prev: ConsoleState, _formData: FormData): Promise<ConsoleState> {
  await requireUser("admin");
  try {
    await Promise.allSettled([refreshExposures()]);
    await refreshResults();
  } catch (e) {
    if (e instanceof AdminApiError && e.status === 429) {
      return { message: "Flagsmith refreshes results at most once every 5 minutes. Try again shortly." };
    }
    return { message: explain(e) };
  }
  revalidatePath("/admin/flags");
  return { ok: true, message: "Refresh requested. New numbers appear here in a minute or so." };
}

export async function shipWinner(_prev: ConsoleState, formData: FormData): Promise<ConsoleState> {
  await requireUser("admin");
  const choice = formData.get("choice");
  if (formData.get("confirm") !== "1") return { message: "Tick the box to confirm. This ends the experiment." };
  if (choice !== "control" && choice !== "express") return { message: "Pick a version to ship." };
  try {
    if (choice === "express") {
      const exp = await getExperiment();
      const id = await variantOptionId(exp.feature, "express");
      if (!id) return { message: "Could not find the express version on the flag." };
      await completeExperiment("variant", id);
    } else {
      await completeExperiment("control");
    }
  } catch (e) {
    return { message: explain(e) };
  }
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `Experiment ended. Every customer now gets the ${choice === "express" ? "one-step Order now" : "two-step"} checkout.`,
  };
}
