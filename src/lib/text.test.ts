import { describe, it, expect } from "vitest";
import { isOverflowing } from "./text";

describe("isOverflowing", () => {
  it("is true when content is wider than the box", () => {
    expect(isOverflowing({ scrollWidth: 300, clientWidth: 200 })).toBe(true);
  });

  it("is false when content fits exactly", () => {
    expect(isOverflowing({ scrollWidth: 200, clientWidth: 200 })).toBe(false);
  });

  it("is false when content is narrower than the box", () => {
    expect(isOverflowing({ scrollWidth: 120, clientWidth: 200 })).toBe(false);
  });
});
