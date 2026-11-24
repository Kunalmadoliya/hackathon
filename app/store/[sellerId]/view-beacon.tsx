"use client";

import { useEffect, useRef } from "react";
import { recordStoreView } from "./actions";

/** Records one store visit per page view. Renders nothing. */
export function ViewBeacon({ sellerId }: { sellerId: number }) {
  const sent = useRef<number | null>(null);
  useEffect(() => {
    if (sent.current === sellerId) return;
    sent.current = sellerId;
    recordStoreView(sellerId).catch(() => {});
  }, [sellerId]);
  return null;
}
