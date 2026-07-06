"use client";

import { useEffect, useState } from "react";

/**
 * Returns false on the server + the first client render, true after mount.
 * Use to gate client-only state (e.g. persisted Zustand) so the first render
 * matches the server HTML and avoids hydration mismatches.
 */
export function useIsMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  return mounted;
}
