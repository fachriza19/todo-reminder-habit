"use client";

import { useEffect, useState } from "react";

/**
 * Track a CSS media query on the client. Returns false on the server + first
 * render (SSR-safe); the real value lands after mount. Safe for modals since
 * they only open after user interaction (post-mount).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
