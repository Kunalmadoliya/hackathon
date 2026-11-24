"use client";

import { useSyncExternalStore } from "react";

type Mode = "light" | "dark";
const KEY = "platter-theme";

// The attribute on <html> is the source of truth; the inline script in the
// root layout sets it from localStorage before first paint.
function read(): Mode {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  // Keep tabs in sync when the choice changes in another tab.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY && (e.newValue === "dark" || e.newValue === "light")) {
      document.documentElement.setAttribute("data-theme", e.newValue);
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function choose(mode: Mode) {
  document.documentElement.setAttribute("data-theme", mode);
  try {
    localStorage.setItem(KEY, mode);
  } catch {}
  listeners.forEach((l) => l());
}

const OPTIONS: { mode: Mode; label: string }[] = [
  { mode: "light", label: "White" },
  { mode: "dark", label: "Dark" },
];

/** Two-option switch: the filled option is the one in use. */
export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribe, read, () => "light" as Mode);
  return (
    <div role="group" aria-label="Colour theme" className="inline-flex rounded-full p-1 shadow-[inset_0_0_0_1.5px_var(--line)]">
      {OPTIONS.map((o) => {
        const active = mode === o.mode;
        return (
          <button
            key={o.mode}
            type="button"
            aria-pressed={active}
            onClick={() => choose(o.mode)}
            className={`h-8 rounded-full px-3 text-sm font-semibold transition-colors ${
              active ? "bg-ink text-page" : "text-ink-soft hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
