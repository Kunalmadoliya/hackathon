/**
 * FILE GUIDE
 * Invisible browser helper: logs one page view after the page is really shown.
 * Calls: app/track-actions.ts. Used by: app/leaderboard/page.tsx.
 */
"use client";

import { useEffect, useRef } from "react";
import { recordPageView } from "@/app/track-actions";

export function PageView({ type }: { type: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    recordPageView(type).catch(() => {});
  }, [type]);
  return null;
}
