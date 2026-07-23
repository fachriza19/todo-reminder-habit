/** True when an element's content is horizontally clipped (ellipsis shown). */
export function isOverflowing(el: {
  scrollWidth: number;
  clientWidth: number;
}): boolean {
  return el.scrollWidth > el.clientWidth;
}
