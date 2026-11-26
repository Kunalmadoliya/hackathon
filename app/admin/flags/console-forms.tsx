/**
 * FILE GUIDE
 * Browser parts of the console: FlagSwitch, RefreshResults, ShipWinner.
 * Calls: ./actions.
 */
"use client";

import { useActionState } from "react";
import { refreshExperiment, shipWinner, toggleFlag, type ConsoleState } from "./actions";

function Message({ state }: { state: ConsoleState }) {
  if (!state.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={`mt-2 text-sm font-semibold ${state.ok ? "" : "text-danger"}`}>
      {state.message}
    </p>
  );
}

export function FlagSwitch({ flag, label, on, description }: { flag: string; label: string; on: boolean; description: string }) {
  const [state, action, pending] = useActionState<ConsoleState, FormData>(toggleFlag, {});
  return (
    <form action={action}>
      <input type="hidden" name="flag" value={flag} />
      <input type="hidden" name="enabled" value={on ? "0" : "1"} />
      <button type="submit" role="switch" aria-checked={on} disabled={pending} className="flex w-full items-start justify-between gap-4 text-left disabled:opacity-60">
        <span>
          <span className="block text-lg font-semibold">{label}</span>
          <span className="block text-sm text-ink-soft">{description}</span>
          <code className="mt-1 block text-xs text-ink-soft">{flag}</code>
        </span>
        <span aria-hidden className={`relative mt-1 h-7 w-12 shrink-0 rounded-full ${on ? "bg-ink" : "bg-line"}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-page transition-[left] ${on ? "left-6" : "left-1"}`} />
        </span>
      </button>
      {pending && <p className="mt-2 text-sm">Saving in Flagsmith…</p>}
      <Message state={state} />
    </form>
  );
}

export function RefreshResults() {
  const [state, action, pending] = useActionState<ConsoleState, FormData>(refreshExperiment, {});
  return (
    <form action={action}>
      <button className="btn btn-quiet" disabled={pending}>
        {pending ? "Asking Flagsmith…" : "Refresh results"}
      </button>
      <Message state={state} />
    </form>
  );
}

export function ShipWinner({ recommended }: { recommended: "control" | "express" | null }) {
  const [state, action, pending] = useActionState<ConsoleState, FormData>(shipWinner, {});
  return (
    <form action={action} className="grid gap-3">
      <fieldset className="grid gap-2">
        <legend className="font-semibold">Ship one version to everyone</legend>
        {(["express", "control"] as const).map((v) => (
          <label key={v} className="flex items-center gap-2">
            <input type="radio" name="choice" value={v} defaultChecked={recommended === v} className="h-4 w-4" />
            {v === "express" ? "Express: one-step Order now" : "Control: two-step checkout"}
            {recommended === v && <span className="chip-on">Recommended</span>}
          </label>
        ))}
      </fieldset>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirm" value="1" className="mt-0.5 h-4 w-4" />
        I understand this ends the experiment and its results become final.
      </label>
      <button className="btn justify-self-start" disabled={pending}>
        {pending ? "Shipping…" : "Ship to everyone"}
      </button>
      <Message state={state} />
    </form>
  );
}
