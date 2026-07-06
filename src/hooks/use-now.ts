"use client";

import { useEffect, useState } from "react";

/**
 * A ticking clock for due detection (PRD 7.2: a client interval compares now vs
 * remind_at). Updates every `intervalMs` (default 30s). Starts from a fixed
 * epoch on the first render so SSR + hydration match; the real time lands after
 * mount.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
