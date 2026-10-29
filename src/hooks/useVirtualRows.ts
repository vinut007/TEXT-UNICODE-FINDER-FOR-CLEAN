import { useEffect, useMemo, useRef, useState } from 'react';

export interface VirtualRange {
  start: number;
  end: number;
  padTop: number;
  padBottom: number;
  totalHeight: number;
}

/**
 * Fixed-size row windowing for very large lists. Keeps DOM nodes bounded
 * regardless of file size.
 */
export function useVirtualRows(
  containerRef: React.RefObject<HTMLElement | null>,
  rowCount: number,
  rowHeight: number,
  overscan = 12,
): VirtualRange & { scrollToRow: (row: number) => void } {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(600);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        setScrollTop(el.scrollTop);
      });
    };
    const ro = new ResizeObserver(() => setViewport(el.clientHeight || 600));
    setViewport(el.clientHeight || 600);
    setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [containerRef]);

  const range = useMemo(() => {
    const visible = Math.ceil(viewport / rowHeight) + 1;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const end = Math.min(rowCount, start + visible + overscan * 2);
    return {
      start,
      end,
      padTop: start * rowHeight,
      padBottom: Math.max(0, (rowCount - end) * rowHeight),
      totalHeight: rowCount * rowHeight,
    };
  }, [scrollTop, viewport, rowCount, rowHeight, overscan]);

  const scrollToRow = (row: number) => {
    const el = containerRef.current;
    if (!el) return;
    const top = Math.max(0, row * rowHeight - el.clientHeight / 3);
    el.scrollTo({ top, behavior: 'smooth' });
  };

  return { ...range, scrollToRow };
}

/** Observe element height (for auto-height containers). */
export function useElementHeight(ref: React.RefObject<HTMLElement | null>): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    setH(el.clientHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return h;
}
