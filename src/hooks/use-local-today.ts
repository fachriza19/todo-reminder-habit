"use client";

import { useEffect, useState } from "react";
import { getLocalToday } from "@/lib/utils";

/**
 * The browser's local calendar date as `YYYY-MM-DD`, kept current across
 * midnight.
 *
 * "Today" is a per-user, timezone-dependent concept. The server runs in its own
 * timezone (UTC in the Docker image), so it cannot derive the user's local date
 * — only the browser can. Habit reads and writes must both be keyed to this
 * value or they address different rows.
 *
 * Re-rendering on the day boundary also keeps `todayCount` from going stale on
 * a page left open overnight: consumers put this in their query key, so the day
 * flipping refetches instead of serving yesterday's count.
 */
export function useLocalToday(): string {
  const [today, setToday] = useState(getLocalToday);

  useEffect(() => {
    // Re-check rather than sleeping until midnight: the tab may have been
    // suspended, and the clock can jump (DST, manual change, travel).
    const id = setInterval(() => {
      setToday((prev) => {
        const next = getLocalToday();
        return next === prev ? prev : next;
      });
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  return today;
}
