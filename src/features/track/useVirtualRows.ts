import { useEffect, useRef, useState } from "react";

/* Windowed rendering for the trip table.

   1,200 rows of eleven cells is roughly 13,000 DOM nodes, which React will
   mount happily and then scroll like treacle. Only the rows actually inside
   the viewport are mounted; the rest are two spacer rows holding the
   scrollbar honest. */

export interface VirtualWindow {
  /** First row index to mount. */
  start: number;
  /** One past the last row index to mount. */
  end: number;
  /** Height of the spacer above the mounted rows. */
  padTop: number;
  /** Height of the spacer below them. */
  padBottom: number;
  totalHeight: number;
}

export function useVirtualRows({
  count,
  rowHeight,
  overscan = 8,
}: {
  count: number;
  rowHeight: number;
  overscan?: number;
}): { scrollRef: React.RefObject<HTMLDivElement | null>; window: VirtualWindow } {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      // Coalesce to one update per frame: a fast wheel fires scroll events far
      // more often than the screen refreshes.
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        setScrollTop(el.scrollTop);
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(([entry]) => {
      setViewportH(entry.contentRect.height);
    });
    ro.observe(el);
    setViewportH(el.clientHeight);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, []);

  const safeRow = Math.max(1, rowHeight);
  const first = Math.max(0, Math.floor(scrollTop / safeRow) - overscan);
  const visible = Math.ceil(viewportH / safeRow) + overscan * 2;
  const last = Math.min(count, first + visible);

  return {
    scrollRef,
    window: {
      start: first,
      end: last,
      padTop: first * safeRow,
      padBottom: Math.max(0, (count - last) * safeRow),
      totalHeight: count * safeRow,
    },
  };
}

/**
 * Reads a pixel-valued custom property and keeps it current when the density
 * toggle changes it — row height is a token, not a constant.
 */
export function useCssPx(variable: string, fallback: number): number {
  const [value, setValue] = useState(fallback);

  useEffect(() => {
    const read = () => {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue(variable)
        .trim();
      const parsed = Number.parseFloat(raw);
      if (Number.isFinite(parsed) && parsed > 0) setValue(parsed);
    };
    read();

    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-density", "style"],
    });
    return () => observer.disconnect();
  }, [variable]);

  return value;
}
