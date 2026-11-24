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
