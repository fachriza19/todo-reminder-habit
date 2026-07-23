"use client";

import { useCallback, useRef, useState } from "react";

import { isOverflowing } from "@/lib/text";

/**
 * Reports whether the attached element's text is horizontally clipped.
 * Uses a callback ref so the ResizeObserver re-attaches if the node swaps
 * (e.g. when the element is upgraded to an interactive trigger).
 */
export function useIsTruncated<T extends HTMLElement = HTMLElement>(): {
  ref: (node: T | null) => void;
  truncated: boolean;
} {
  const [truncated, setTruncated] = useState(false);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) return;

    const measure = () => setTruncated(isOverflowing(node));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    observerRef.current = ro;
  }, []);

  return { ref, truncated };
}
